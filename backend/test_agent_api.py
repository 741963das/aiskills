"""Test agent get API for testuser1."""
import urllib.request as ur
import json

# 1. Login
req = ur.Request("http://127.0.0.1:8005/api/auth/login",
    data=json.dumps({"username": "testuser1", "password": "testuser123"}).encode(),
    headers={"Content-Type": "application/json"}, method="POST")
resp = ur.urlopen(req, timeout=10)
login_data = json.loads(resp.read().decode())
token = login_data["access_token"]
print(f"Login OK: user_id={login_data.get('user_id')} role={login_data.get('role')} token[:20]={token[:20]}...")

# 2. Get agent 1
print("\n--- GET /api/agents/1 ---")
try:
    req = ur.Request("http://127.0.0.1:8005/api/agents/1",
        headers={"Authorization": f"Bearer {token}"})
    r = ur.urlopen(req, timeout=10)
    d = json.loads(r.read().decode())
    print(f"  id={d['id']} name={d['name']} status={d['status']} owner_id={d.get('user_id') or d.get('userId')}")
except Exception as e:
    print(f"  FAIL: {e}")

# 3. Get agent 13
print("\n--- GET /api/agents/13 ---")
try:
    req = ur.Request("http://127.0.0.1:8005/api/agents/13",
        headers={"Authorization": f"Bearer {token}"})
    r = ur.urlopen(req, timeout=10)
    d = json.loads(r.read().decode())
    print(f"  id={d['id']} name={d['name']} status={d['status']} owner_id={d.get('user_id') or d.get('userId')}")
    flk = d.get("config", {}).get("fiveLayerKnowledge", {})
    print(f"  FLK topics: {len(flk.get('knowledge_layer', {}).get('topics', []))}")
except Exception as e:
    print(f"  FAIL: {e}")

# 4. List my agents
print("\n--- GET /api/agents/my ---")
try:
    req = ur.Request("http://127.0.0.1:8005/api/agents/my",
        headers={"Authorization": f"Bearer {token}"})
    r = ur.urlopen(req, timeout=10)
    d = json.loads(r.read().decode())
    print(f"  Count: {len(d)}")
    for a in d:
        print(f"    id={a['id']} name={a['name']} status={a['status']}")
except Exception as e:
    print(f"  FAIL: {e}")
