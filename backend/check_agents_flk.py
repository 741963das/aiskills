"""Check agent ownership and FLK state for all agents."""
import sqlite3, json

conn = sqlite3.connect("file:app.db?mode=ro", uri=True)
cur = conn.cursor()

print("=== ALL USERS ===")
cur.execute("SELECT id, username, role FROM users")
for u in cur.fetchall():
    print(f"  user_id={u[0]} username={u[1]} role={u[2]}")

print("\n=== ALL AGENTS ===")
cur.execute("SELECT id, name, user_id, status, course_name FROM agents")
for a in cur.fetchall():
    print(f"  agent_id={a[0]} name={a[1]} owner_id={a[2]} status={a[3]} course={a[4]}")

print("\n=== AGENT 1 FLK ===")
cur.execute("SELECT config FROM agents WHERE id=1")
cfg = json.loads(cur.fetchone()[0])
flk = cfg.get("fiveLayerKnowledge", {})
for k,v in flk.items():
    print(f"  {k}: keys={list(v.keys()) if isinstance(v,dict) else v}")
    if isinstance(v, dict):
        for k2, arr in v.items():
            if isinstance(arr, list):
                print(f"    {k2}: {len(arr)} 条")

print("\n=== AGENT 13 FLK ===")
cur.execute("SELECT config FROM agents WHERE id=13")
row = cur.fetchone()
if row:
    cfg = json.loads(row[0])
    flk = cfg.get("fiveLayerKnowledge", {})
    for k,v in flk.items():
        print(f"  {k}: keys={list(v.keys()) if isinstance(v,dict) else v}")
        if isinstance(v, dict):
            for k2, arr in v.items():
                if isinstance(arr, list):
                    print(f"    {k2}: {len(arr)} 条")
else:
    print("  Agent 13 not found")

conn.close()
