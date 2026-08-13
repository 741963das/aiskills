import os
import re
import json
import hashlib
import logging
import threading
from typing import List, Dict, Any, Optional, Generator

from ..config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# OpenAI-compatible client (SiliconFlow)
# ---------------------------------------------------------------------------

def _get_client():
    """Create OpenAI-compatible client for SiliconFlow."""
    from openai import OpenAI
    import httpx

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        raise RuntimeError(
            "SILICONFLOW_API_KEY 未配置，请在 backend/.env 中设置真实 Key\n"
            "获取地址：https://cloud.siliconflow.cn/account/ak"
        )

    return OpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(120.0, connect=10.0),
        max_retries=2,
    )


# ---------------------------------------------------------------------------
# Chroma Vector DB helpers
# ---------------------------------------------------------------------------

_chroma_client = None
_chroma_lock = threading.Lock()


def _get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        with _chroma_lock:
            # 双重检查，避免并发上传时 repeated 初始化导致 tenant 竞争
            if _chroma_client is None:
                import chromadb
                _chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
    return _chroma_client


def _get_collection(agent_id: int):
    """获取或创建 Chroma collection（按 agent 隔离）：agent_{agent_id}"""
    client = _get_chroma_client()
    return client.get_or_create_collection(
        name=f"agent_{agent_id}",
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Embedding (SiliconFlow: BAAI/bge-m3)
# ---------------------------------------------------------------------------

def generate_embedding(text: str) -> List[float]:
    """Call SiliconFlow embedding API (BAAI/bge-m3). Returns None on failure."""
    try:
        client = _get_client()
        response = client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return None


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Batch generate embeddings for multiple texts."""
    client = _get_client()
    response = client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Chroma: store & retrieve
# ---------------------------------------------------------------------------

def store_chunks_to_chroma(
    agent_id: int,
    file_id: int,
    filename: str,
    chunks: List[Dict[str, Any]],
) -> int:
    """Generate embeddings and store into Chroma collection agent_{agent_id}."""
    if not chunks:
        return 0

    texts = [c["text"] for c in chunks]
    embeddings = generate_embeddings_batch(texts)

    collection = _get_collection(agent_id)

    ids = [f"file{file_id}_chunk{idx}" for idx in range(len(chunks))]
    metadatas = [
        {
            "file_id": file_id,
            "filename": filename,
            "chunk_index": idx,
        }
        for idx in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )
    return len(chunks)


def delete_file_from_chroma(agent_id: int, file_id: int) -> None:
    """Delete all chunks of a file from Chroma (by agent_id collection)."""
    collection = _get_collection(agent_id)
    results = collection.get(where={"file_id": file_id})
    if results["ids"]:
        collection.delete(ids=results["ids"])


def retrieve_for_rag(
    db,
    user_id: int,
    agent_id: int,
    query: str,
    top_k: int = 5,
    similarity_threshold: float = 0.45,
) -> List[Dict[str, Any]]:
    """向量检索：embed query → Chroma 搜索 agent_{agent_id} → 相似度过滤."""
    from ..models.knowledge import KnowledgeFile

    # 直接按 agent_id 关联文件（不再依赖 config.knowledgeFileIds）
    # 注意：内置助手（SYSTEM 创建）的知识库可能由其他教师用户上传，
    # 因此只按 agent_id 和 status 过滤，不约束 user_id
    files = db.query(KnowledgeFile).filter(
        KnowledgeFile.agent_id == agent_id,
        KnowledgeFile.status == "done",
    ).all()
    if not files:
        return []

    # Generate query embedding via SiliconFlow
    query_embedding = generate_embedding(query)
    if not query_embedding:
        return []

    # Search Chroma collection agent_{agent_id}
    collection = _get_collection(agent_id)
    file_ids = [f.id for f in files]
    where_filter = {"file_id": {"$in": file_ids}}

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k * 2,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"] or not results["ids"][0]:
        return []

    retrieved = []
    for i, doc_id in enumerate(results["ids"][0]):
        distance = results["distances"][0][i]
        # Chroma cosine distance → similarity = 1 - distance
        similarity = 1.0 - distance

        if similarity < similarity_threshold:
            continue

        metadata = results["metadatas"][0][i]
        document = results["documents"][0][i]

        retrieved.append({
            "content": document,
            "similarity": round(similarity, 4),
            "filename": metadata.get("filename", "unknown"),
            "file_id": metadata.get("file_id", 0),
            "chunk_index": metadata.get("chunk_index", 0),
            "chunk_id": doc_id,
        })

        if len(retrieved) >= top_k:
            break

    return retrieved


# ---------------------------------------------------------------------------
# Context assembly
# ---------------------------------------------------------------------------

def build_context(retrieved_chunks: List[Dict[str, Any]]) -> str:
    if not retrieved_chunks:
        return ""

    context_parts = []
    for chunk in retrieved_chunks:
        source_label = f"【来源：{chunk['filename']} 第{chunk['chunk_index'] + 1}段】"
        context_parts.append(f"{source_label}\n{chunk['content']}")

    return "\n\n---\n\n".join(context_parts)


# ---------------------------------------------------------------------------
# LLM Generation (SiliconFlow: DeepSeek-V3)
# ---------------------------------------------------------------------------

def generate_answer(
    query: str,
    context: str,
    system_prompt: str,
    retrieved_chunks: List[Dict[str, Any]],
    model: str = None,
) -> Dict[str, Any]:
    """非流式 LLM 生成。返回回答 + 来源."""
    if not retrieved_chunks:
        return {
            "answer": "知识库中暂无相关内容，建议联系教师补充资料。",
            "sources": [],
        }

    sources = [
        {
            "file": chunk["filename"],
            "chunk": chunk["chunk_index"],
            "similarity": chunk["similarity"],
        }
        for chunk in retrieved_chunks
    ]

    context_for_prompt = "\n".join(
        f"[{i+1}] {chunk['content'][:500]}"
        for i, chunk in enumerate(retrieved_chunks)
    )

    user_message = f"""--- 知识库参考内容 ---
{context_for_prompt}

--- 用户问题 ---
{query}

--- 回答要求 ---
1. 基于知识库内容回答，如知识库没有相关内容，坦诚说明
2. 使用中文回答，语言通俗易懂
3. 回答结尾标注参考来源编号
"""

    answer = _call_llm(system_prompt, user_message, model=model)

    return {
        "answer": answer,
        "sources": sources,
    }


def stream_llm_answer(
    system_prompt: str,
    context: str,
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    model: str = None,
) -> Generator[str, None, None]:
    """流式 LLM 生成。逐 token yield。即使无知识库也调用 LLM。"""
    if retrieved_chunks:
        context_for_prompt = "\n".join(
            f"[{i+1}] {chunk['content'][:500]}"
            for i, chunk in enumerate(retrieved_chunks)
        )
        user_message = f"""## 当前知识库参考内容
{context_for_prompt}

请根据以上知识库内容回答学生的问题。如果知识库中有相关信息，请引用并标注来源（文件名）。
如果知识库中未找到相关内容，结合你的专业知识补充，但要说明"知识库中未找到相关内容"。

## 学生问题
{query}"""
    else:
        user_message = f"""知识库中暂无相关内容。请根据你的专业知识回答学生的问题，并在回答开头说明"知识库中未找到相关内容，以下回答基于专业知识"。

## 学生问题
{query}"""

    yield from _stream_llm(system_prompt, user_message, model=model)


def _call_llm(system_prompt: str, user_message: str, model: str = None) -> str:
    """调用 SiliconFlow Chat API (非流式)."""
    client = _get_client()
    response = client.chat.completions.create(
        model=model or settings.CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content


def _stream_llm(system_prompt: str, user_message: str, model: str = None) -> Generator[str, None, None]:
    """调用 SiliconFlow Chat API (流式). 逐 token yield."""
    client = _get_client()
    stream = client.chat.completions.create(
        model=model or settings.CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        stream=True,
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


# ---------------------------------------------------------------------------
# Text chunking (real implementation, not mock)
# ---------------------------------------------------------------------------

def chunk_text_semantic(text: str, chunk_size: int = 512, overlap: int = 50) -> List[Dict[str, Any]]:
    text = text.strip()
    if not text:
        return []

    sentences = _split_sentences(text)
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += sentence
        else:
            if current_chunk:
                chunks.append({
                    "text": current_chunk.strip(),
                    "size": len(current_chunk.strip()),
                })

            if len(sentence) > chunk_size:
                for i in range(0, len(sentence), chunk_size - overlap):
                    sub = sentence[i : i + chunk_size].strip()
                    if sub:
                        chunks.append({
                            "text": sub,
                            "size": len(sub),
                        })
                current_chunk = ""
            else:
                current_chunk = sentence

    if current_chunk.strip():
        chunks.append({
            "text": current_chunk.strip(),
            "size": len(current_chunk.strip()),
        })

    return chunks


def _split_sentences(text: str) -> List[str]:
    sentences = re.split(r'(?<=[。！？.!?\n])', text)
    result = []
    for s in sentences:
        s = s.strip()
        if s:
            result.append(s)
    return result


def filter_chunks(chunks: List[Dict[str, Any]], existing_hashes: Optional[set] = None) -> tuple:
    if existing_hashes is None:
        existing_hashes = set()

    filtered = []
    skipped = 0
    seen_hashes = set(existing_hashes)

    for chunk in chunks:
        text = chunk["text"]

        if len(text) < 20:
            skipped += 1
            continue

        if _is_low_quality(text):
            skipped += 1
            continue

        chunk_hash = hashlib.md5(text.encode()).hexdigest()
        if chunk_hash in seen_hashes:
            skipped += 1
            continue

        seen_hashes.add(chunk_hash)
        filtered.append(chunk)

    return filtered, skipped


def _is_low_quality(text: str) -> bool:
    if not text:
        return True

    digit_symbol_count = sum(1 for c in text if c.isdigit() or c in '.,;:!?@#$%^&*()_+-=[]{}|\\/<>`~\'"\n\r\t')
    if len(text) > 0 and digit_symbol_count / len(text) > 0.8:
        return True

    meaningful_chars = sum(1 for c in text if c.isalpha() or '\u4e00' <= c <= '\u9fff')
    if len(text) > 0 and meaningful_chars / len(text) < 0.2:
        return True

    return False


# ---------------------------------------------------------------------------
# Chroma collection copy (for Agent download)
# ---------------------------------------------------------------------------

def copy_chroma_collection(
    src_agent_id: int,
    dst_agent_id: int,
    file_id_map: Dict[int, int] | None = None,
) -> int:
    """复制源 agent 的 Chroma 向量数据到目标 agent。返回写入的 chunk 数量。

    file_id_map: 源 file_id → 目标 file_id 的映射。
    下载助手时新建了 KnowledgeFile（新 file_id），必须把向量 metadata 中的
    file_id 重写为目标 file_id，否则 retrieve_for_rag 用新 file_id 做 where
    过滤时永远匹配不到，导致下载副本检索不到知识库内容。
    """
    try:
        src_collection = _get_collection(src_agent_id)
        data = src_collection.get(include=["embeddings", "documents", "metadatas"])
        if not data["ids"]:
            return 0

        # 重写 metadata 中的 file_id（若提供映射）
        out_metadatas = data["metadatas"]
        if file_id_map:
            out_metadatas = []
            for meta in data["metadatas"]:
                meta = dict(meta or {})
                old_fid = meta.get("file_id")
                if old_fid is not None and old_fid in file_id_map:
                    meta["file_id"] = file_id_map[old_fid]
                out_metadatas.append(meta)

        dst_collection = _get_collection(dst_agent_id)
        dst_collection.add(
            ids=data["ids"],
            embeddings=data["embeddings"],
            documents=data["documents"],
            metadatas=out_metadatas,
        )
        return len(data["ids"])
    except Exception as e:
        logger.warning(f"复制向量数据失败 src={src_agent_id} dst={dst_agent_id}: {e}")
        return 0
