# -*- coding: utf-8 -*-
"""全新干净部署辅助脚本：
1. 创建演示教师账号（demo_teacher / Demo1234）
2. 演示教师创建自建助手（高等数学助教，含知识库）
3. 上传内置助手的知识库（8个内置助手）
4. 上传演示教师自建助手的知识库
"""
import os
import sys
import time
import requests

BASE = "http://127.0.0.1:8008"
MATERIALS = r"e:\aiskills\backend\knowledge_materials"

# 演示教师账号
DEMO_TEACHER = {
    "username": "demo_teacher",
    "password": "Demo1234",
    "email": "demo_teacher@gmail.com",
    "role": "teacher",
}

# 内置助手 -> 知识库文件映射
agent_file_map = {
    "高等数学助教": ["高等数学第一章函数与极限讲义.md", "高等数学常见习题与易错点.md"],
    "Python 编程导师": ["Python基础语法速查手册.md", "Python常见错误与调试指南.md"],
    "大学英语读写助手": ["四级英语写作模板与技巧.md", "英语语法常见错误精讲.md"],
    "大学物理（力学）助教": ["力学第一章质点运动学讲义.md", "力学典型例题与解题思路.md"],
    "教案设计专家": ["布卢姆教学目标分类法详解.md", "各学科优质教案范例.md"],
    "试卷与题目生成器": ["命题规范与双向细目表指南.md", "各题型设计方法与示例.md"],
    "机电一体化实训导师": ["机电一体化系统概述.md", "机电设备常见故障排查手册.md"],
    "思政课学习助手": ["思想道德与法治第一章要点梳理.md", "思政课常见论述题答题思路.md"],
}


def login(username, password):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"username": username, "password": password}, timeout=10)
    if r.status_code != 200:
        print(f"  ❌ 登录失败 {username}: {r.status_code} {r.text}")
        return None
    return r.json().get("access_token")


def register(user):
    r = requests.post(f"{BASE}/api/auth/register", json=user, timeout=10)
    if r.status_code in (200, 201):
        print(f"  ✅ 注册成功: {user['username']}")
        return True
    print(f"  ℹ️ 注册 {user['username']}: {r.status_code} {r.text[:100]}")
    return False


def get_agents(token):
    r = requests.get(f"{BASE}/api/agents/", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    return r.json() if r.status_code == 200 else []


def upload_file(token, agent_id, fname):
    fpath = os.path.join(MATERIALS, fname)
    if not os.path.exists(fpath):
        print(f"    ⚠ 文件不存在: {fname}")
        return False
    with open(fpath, "rb") as f:
        r = requests.post(
            f"{BASE}/api/knowledge/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (fname, f, "text/markdown")},
            params={"agent_id": agent_id},
            timeout=60,
        )
    if r.status_code in (200, 201):
        return True
    print(f"    ❌ 上传失败 {fname}: {r.status_code} {r.text[:150]}")
    return False


# ============ 1. 创建演示教师账号 ============
print("=" * 60)
print("[1] 创建演示教师账号")
register(DEMO_TEACHER)
token = login(DEMO_TEACHER["username"], DEMO_TEACHER["password"])
if not token:
    sys.exit("无法登录演示教师账号")
h = {"Authorization": f"Bearer {token}"}
print(f"  演示教师 token 获取成功: {token[:20]}...")

# ============ 2. 演示教师创建自建助手 ============
print("\n" + "=" * 60)
print("[2] 演示教师创建自建助手：高等数学助教（clone）")
# 检查是否已有同名助手
agents = get_agents(token)
demo_agent = next((a for a in agents if a["name"] == "高等数学助教"), None)
if not demo_agent:
    create_payload = {
        "name": "高等数学助教",
        "course_name": "高等数学（上）",
        "template": "higher_edu",
        "config": {
            "identity": {"title": "身份声明", "content": "你是「高等数学助教」的 AI 教学助手，专注大学理工科高等数学课程的教学辅导。"},
            "capabilities": {"title": "核心能力", "content": "围绕高等数学三大主线（极限、微积分、方程与级数）提供完整学习支持。", "items": ["概念讲解", "典型例题分析", "作业辅导", "期末复习串讲"]},
            "answer_rules": {"title": "回答规范", "content": "以学生为中心，先诊断误解再给解法，引导思考不直接给最终答案。", "rules": ["回答时先用 1-2 句话点明核心思路", "关键步骤给出为什么这样做", "结合具体例子和应用场景"]},
            "course_info": {"subject": "数学", "grade_level": "大学一年级"},
            "audience_level": "大学理工科基础",
            "style": "耐心引导式",
            "core_tasks": ["概念讲解", "典型例题分析", "作业辅导", "期末复习串讲"],
            "student_pain_points": "学生常见痛点：极限概念停留在计算层面忽略定义；积分换元经常选错；微分方程类型混淆；级数收敛性判断思路不清。",
            "role": "高等数学助教",
            "course_name": "高等数学（上）",
            "subject": "数学",
            "isBuiltin": False,
        },
    }
    r = requests.post(f"{BASE}/api/agents/", json=create_payload, headers=h, timeout=10)
    if r.status_code in (200, 201):
        demo_agent = r.json()
        print(f"  ✅ 创建自建助手成功: id={demo_agent['id']}")
    else:
        print(f"  ❌ 创建助手失败: {r.status_code} {r.text[:200]}")
        sys.exit("创建演示助手失败")
else:
    print(f"  ℹ️ 已存在助手: id={demo_agent['id']}")

demo_agent_id = demo_agent["id"]

# ============ 3. 上传演示教师自建助手知识库 ============
print("\n" + "=" * 60)
print(f"[3] 上传演示教师自建助手（id={demo_agent_id}）知识库")
demo_files = agent_file_map["高等数学助教"]
for fname in demo_files:
    if upload_file(token, demo_agent_id, fname):
        print(f"  ✅ 上传 {fname}")
print("  （RAG 后台处理中，约 30-60 秒）")

# ============ 4. 上传内置助手知识库 ============
print("\n" + "=" * 60)
print("[4] 上传 8 个内置助手知识库")
# 获取内置助手（SYSTEM 用户创建）
r = requests.get(f"{BASE}/api/agents/marketplace", headers=h, timeout=10)
builtin_agents = []
if r.status_code == 200:
    for item in r.json().get("items", []):
        if item.get("is_builtin"):
            builtin_agents.append(item)
print(f"  市场中找到 {len(builtin_agents)} 个内置助手")

for agent in builtin_agents:
    name = agent["name"]
    files = agent_file_map.get(name, [])
    if not files:
        continue
    print(f"  ▶ 上传到内置助手: {name} (id={agent['id']})")
    for fname in files:
        if upload_file(token, agent["id"], fname):
            print(f"    ✅ {fname}")

print("\n" + "=" * 60)
print("[DONE] 部署脚本完成。RAG 处理需要 30-60 秒，请稍后验证。")
print(f"演示教师账号: {DEMO_TEACHER['username']} / {DEMO_TEACHER['password']}")
print(f"演示自建助手 id: {demo_agent_id}")