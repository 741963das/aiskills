# -*- coding: utf-8 -*-
"""通过 GitHub API 创建 v2.0.0 Release。
用法：
    python create_release.py <GITHUB_TOKEN>
"""
import sys, json, requests

TOKEN = sys.argv[1] if len(sys.argv) > 1 else ""
if not TOKEN:
    print("请提供 GitHub token：python create_release.py <GITHUB_TOKEN>")
    sys.exit(1)

REPO = "741963das/aiskills"
TAG = "v2.0.0"
TITLE = "v2.0.0 — 师生问答经验沉淀 + 生产部署"

with open("deploy/RELEASE_v2.0.0.md", "r", encoding="utf-8") as f:
    body = f.read()

url = f"https://api.github.com/repos/{REPO}/releases"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
payload = {
    "tag_name": TAG,
    "target_commitish": "master",
    "name": TITLE,
    "body": body,
    "draft": True,   # 先存草稿，人工核对后再发布
    "prerelease": False,
}

r = requests.post(url, headers=headers, json=payload, timeout=30)
print("HTTP", r.status_code)
if r.status_code in (200, 201):
    data = r.json()
    print("✅ Release 创建成功（草稿）")
    print("  URL:", data.get("html_url"))
else:
    print("❌ 创建失败：", r.text[:1000])