# -*- coding: utf-8 -*-
"""更新 GitHub 仓库元信息（Description / Homepage / Topics）
使用标准库 urllib，不依赖 requests。
需要权限：Administration Read and write 或经典 token repo scope。"""
import sys, json, urllib.request, urllib.error

TOKEN = sys.argv[1]
OWNER = "741963das"
REPO = "aiskills"

payload = {
    "name": "aiskills",
    "description": "AI 智能教学助手平台 · 师生问答自动沉淀五层教学经验 · FastAPI + React + ChromaDB RAG + SiliconFlow",
    "homepage": "https://aiskills.onrender.com",
    "topics": [
        "ai-education",
        "teaching-assistant",
        "rag",
        "chromadb",
        "fastapi",
        "react",
        "siliconflow",
        "knowledge-base",
        "teacher-tools",
        "higher-education",
        "edtech",
    ],
    "has_issues": True,
    "has_projects": False,
    "has_wiki": False,
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    f"https://api.github.com/repos/{OWNER}/{REPO}",
    data=data,
    method="PATCH",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    },
)
print(f"PATCH repos/{OWNER}/{REPO} ...")
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        print("HTTP", resp.status)
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print("HTTP", e.code)
    print(body[:500])
    sys.exit(1)

obj = json.loads(body)
print(json.dumps({
    "full_name": obj.get("full_name"),
    "description": obj.get("description"),
    "homepage": obj.get("homepage"),
    "topics": obj.get("topics"),
    "html_url": obj.get("html_url"),
}, ensure_ascii=False, indent=2))