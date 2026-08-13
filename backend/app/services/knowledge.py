import re
import os
from typing import Dict, Any, List


def parse_document(file_path: str, file_type: str) -> Dict[str, Any]:
    file_type = file_type.lower()
    if file_type == "pdf":
        result = _parse_pdf(file_path)
    elif file_type in ("docx", "doc"):
        result = _parse_word(file_path)
    elif file_type in ("txt", "md"):
        result = _parse_text(file_path, file_type)
    else:
        raise ValueError(f"不支持的文件类型: {file_type}")

    cleaned = clean_text(result["raw_text"])
    result["cleaned_text"] = cleaned
    result["char_count"] = len(cleaned)
    del result["raw_text"]
    return result


def _parse_pdf(file_path: str) -> Dict[str, Any]:
    from PyPDF2 import PdfReader
    reader = PdfReader(file_path)
    page_texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text and text.strip():
            page_texts.append(text.strip())

    raw_text = "\n".join(page_texts)
    return {
        "full_text": raw_text,
        "page_count": len(reader.pages),
        "char_count": len(raw_text),
        "raw_text": raw_text,
    }


def _parse_word(file_path: str) -> Dict[str, Any]:
    from docx import Document
    doc = Document(file_path)
    texts = []
    for para in doc.paragraphs:
        if para.text.strip():
            texts.append(para.text)

    raw_text = "\n".join(texts)
    return {
        "full_text": raw_text,
        "page_count": 1,
        "char_count": len(raw_text),
        "raw_text": raw_text,
    }


def _parse_text(file_path: str, file_type: str) -> Dict[str, Any]:
    raw_text = ""
    encodings = ["utf-8", "gbk", "gb18030", "latin-1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                raw_text = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if not raw_text:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text = f.read()

    if file_type == "md":
        raw_text = _preserve_markdown_structure(raw_text)

    return {
        "full_text": raw_text,
        "page_count": 1,
        "char_count": len(raw_text),
        "raw_text": raw_text,
    }


def _preserve_markdown_structure(text: str) -> str:
    lines = text.split("\n")
    processed = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            processed.append(f"\n{stripped}\n")
        else:
            processed.append(line)
    return "\n".join(processed)


def clean_text(text: str) -> str:
    if not text:
        return ""

    lines = text.split("\n")

    lines = _remove_headers_footers(lines)

    lines = [_merge_broken_line(line) for line in lines]

    processed_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            if processed_lines and processed_lines[-1] != "":
                processed_lines.append("")
            continue

        if _is_noise_line(line):
            continue

        if len(line) < 10:
            continue

        processed_lines.append(line)

    result = "\n".join(processed_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


def _remove_headers_footers(lines: List[str]) -> List[str]:
    if len(lines) < 10:
        return lines

    line_counts: Dict[str, int] = {}
    for line in lines:
        stripped = line.strip()
        if stripped and len(stripped) < 100:
            line_counts[stripped] = line_counts.get(stripped, 0) + 1

    repeated = {line for line, count in line_counts.items() if count >= 3}
    if not repeated:
        return lines

    return [line for line in lines if line.strip() not in repeated]


def _merge_broken_line(line: str) -> str:
    if not line.endswith("-"):
        return line
    return line[:-1]


def _is_noise_line(line: str) -> bool:
    if not line:
        return True

    digit_symbol_count = sum(1 for c in line if c.isdigit() or c in '.,;:!?@#$%^&*()_+-=[]{}|\\/<>`~\'"\n\r\t')
    if len(line) > 0 and digit_symbol_count / len(line) > 0.8:
        return True

    if re.match(r'^[\s\d\W]+$', line):
        return True

    return False
