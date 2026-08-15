# -*- coding: utf-8 -*-
"""单独设置仓库 Topics（必须用 PUT /topics 接口）"""
import sys, json, urllib.request, urllib.error

TOKEN = sys.argv[1]
OWNER = "741963das"
REPO = "aiskills"

payload = {
    "names": [
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
    ]
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    f"https://api.github.com/repos/{OWNER}/{REPO}/topics",
    data=data,
    method="PUT",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    },
)
print(f"PUT repos/{OWNER}/{REPO}/topics ...")
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        print("HTTP", resp.status)
        obj = json.loads(body)
        print(json.dumps(obj.get("names"), ensure_ascii=False, indent=2))
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print("HTTP", e.code)
    print(body[:500])
    sys.exit(1)