"""Test frontend proxy and backend connectivity."""
import sys
try:
    import requests
except ImportError:
    print("requests not available, using urllib")
    import urllib.request as ur
    for label, url in [
        ("8005 direct", "http://127.0.0.1:8005/api/health"),
        ("5173 root", "http://127.0.0.1:5173/"),
        ("5173 proxy", "http://127.0.0.1:5173/api/health"),
    ]:
        try:
            r = ur.urlopen(url, timeout=10)
            body = r.read().decode("utf-8", errors="replace")
            print(f"[OK] {label}: {r.status} len={len(body)} {body[:200]}")
        except Exception as e:
            print(f"[FAIL] {label}: {e}")
    sys.exit(0)

for label, url in [
    ("8005 direct", "http://127.0.0.1:8005/api/health"),
    ("5173 root", "http://127.0.0.1:5173/"),
    ("5173 proxy", "http://127.0.0.1:5173/api/health"),
]:
    try:
        r = requests.get(url, timeout=10)
        print(f"[OK] {label}: {r.status_code} len={len(r.text)} {r.text[:200]}")
    except Exception as e:
        print(f"[FAIL] {label}: {e}")
