"""Try to authenticate directly via backend code."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import SessionLocal
from app.models.user import User
from app.utils.auth import authenticate_user, create_access_token, verify_password, hash_password
from pydantic import BaseModel

db = SessionLocal()

# Test: does password 'testuser123' match?
user = db.query(User).filter(User.username == 'testuser1').first()
print(f"Found user: id={user.id} username={user.username}")
print(f"stored hash[:30]={user.password_hash[:30]}")

# Try 'testuser123'
is_ok = verify_password("testuser123", user.password_hash)
print(f"password 'testuser123' -> {is_ok}")

# Try 'testuser1' (accidentally typed in login page)
is_ok2 = verify_password("testuser1", user.password_hash)
print(f"password 'testuser1'   -> {is_ok2}")

# Try a bunch of likely passwords
candidates = [
    "password", "123456", "password123", "test1234",
    "Testuser123", "TESTUSER123", "testuser123!", "admin123",
    "Test@123", "testuser@123", "Pass1234",
]
for cand in candidates:
    ok = verify_password(cand, user.password_hash)
    if ok:
        print(f"password '{cand}' -> ✅ MATCH!")
        break
else:
    print("No match in candidates list")

db.close()
