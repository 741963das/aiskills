"""Publish agent 13 so it shows up in teacher's list."""
import sqlite3, json

conn = sqlite3.connect("file:app.db?mode=rwc", uri=True)
cur = conn.cursor()

# Check current
cur.execute("SELECT id, name, status, user_id FROM agents WHERE id=13")
print("Before:", cur.fetchone())

# Publish
cur.execute("UPDATE agents SET status='published' WHERE id=13")
conn.commit()

# Verify
cur.execute("SELECT id, name, status, user_id FROM agents WHERE id=13")
print("After: ", cur.fetchone())

conn.close()
print("✅ Agent 13 已发布")
