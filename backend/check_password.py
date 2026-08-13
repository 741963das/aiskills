"""Debug testuser1 password hash in DB."""
import sqlite3, json
conn = sqlite3.connect("file:app.db?mode=ro", uri=True)
cur = conn.cursor()
cur.execute("SELECT id, username, password_hash, role FROM users WHERE username='testuser1'")
r = cur.fetchone()
print(f"id={r[0]} username={r[1]} role={r[3]}")
print(f"password_hash[:80]={r[2][:80] if r[2] else None}...")
# Check if bcrypt format
if r[2] and r[2].startswith("$2b$"):
    print("  format: bcrypt $2b$")
elif r[2] and r[2].startswith("$2a$"):
    print("  format: bcrypt $2a$")
elif r[2] and r[2].startswith("pbkdf2"):
    print("  format: pbkdf2_sha256")
elif r[2]:
    print(f"  format: unknown prefix={r[2][:20]}")
conn.close()
