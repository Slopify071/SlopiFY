#!/usr/bin/env python3
"""
SlopiFY Tunnel Daemon for Linux Mint / Ubuntu
Automates Cloudflare Quick Tunnel and syncs the live HTTPS endpoint to Firebase Firestore.
"""

import os
import re
import sys
import time
import json
import signal
import subprocess
import urllib.request
import urllib.error

# Configuration
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "AIzaSyCLiKERj-DXvqA-XKYOYuqT4BvKeW6q930")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "slopify-a4cda")
DAEMON_EMAIL = os.environ.get("DAEMON_EMAIL", "daemon@slopify.local")
DAEMON_PASSWORD = os.environ.get("DAEMON_PASSWORD", "slopify_daemon_pass_2026!")
LOCAL_MINIO_URL = os.environ.get("LOCAL_MINIO_URL", "http://localhost:9000")
HEARTBEAT_INTERVAL = 300 # 5 minutes

tunnel_process = None

def get_auth_token():
    """Authenticate with Firebase Auth REST API to obtain an idToken."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = json.dumps({
        "email": DAEMON_EMAIL,
        "password": DAEMON_PASSWORD,
        "returnSecureToken": True
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("idToken")
    except Exception as e:
        print(f"[SlopiFY Daemon] Auth error: {e}", file=sys.stderr)
        return None

def update_firestore_endpoint(endpoint_url, online=True):
    """Publish current endpoint URL and status to Firestore storage_meta/global."""
    token = get_auth_token()
    if not token:
        print("[SlopiFY Daemon] Failed to get Firebase auth token. Retrying in 10s...", file=sys.stderr)
        return False

    url = (
        f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/"
        f"storage_meta/global?updateMask.fieldPaths=endpointUrl&updateMask.fieldPaths=online&updateMask.fieldPaths=lastUpdated&key={FIREBASE_API_KEY}"
    )

    payload = json.dumps({
        "fields": {
            "endpointUrl": {"stringValue": endpoint_url.rstrip("/")},
            "online": {"booleanValue": online},
            "lastUpdated": {"integerValue": str(int(time.time()))}
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="PATCH"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                print(f"[SlopiFY Daemon] Successfully updated Firestore endpoint to: {endpoint_url}")
                return True
    except Exception as e:
        print(f"[SlopiFY Daemon] Firestore update error: {e}", file=sys.stderr)
    return False

def signal_handler(sig, frame):
    print("\n[SlopiFY Daemon] Shutting down tunnel daemon...")
    if tunnel_process:
        tunnel_process.terminate()
    try:
        update_firestore_endpoint("", online=False)
    except Exception:
        pass
    sys.exit(0)

def main():
    global tunnel_process
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("==================================================")
    print("      SlopiFY Storage Tunnel Daemon (Linux Mint)   ")
    print("==================================================")
    print(f"Targeting local MinIO: {LOCAL_MINIO_URL}")

    # Check if cloudflared is installed
    check_cf = subprocess.run(["which", "cloudflared"], capture_output=True, text=True)
    if check_cf.returncode != 0:
        print("[SlopiFY Daemon] ERROR: cloudflared is not installed! Run: sudo apt install cloudflared or download from Cloudflare.", file=sys.stderr)
        sys.exit(1)

    while True:
        print("[SlopiFY Daemon] Starting Cloudflare Quick Tunnel...")
        cmd = ["cloudflared", "tunnel", "--url", LOCAL_MINIO_URL]
        
        tunnel_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        tunnel_url = None
        url_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

        # Read output line-by-line until URL is discovered
        for line in tunnel_process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            match = url_regex.search(line)
            if match and not tunnel_url:
                tunnel_url = match.group(0)
                print("--------------------------------------------------")
                print(f"[SlopiFY Daemon] DISCOVERED TUNNEL URL: {tunnel_url}")
                print("--------------------------------------------------")
                update_firestore_endpoint(tunnel_url, online=True)
                break

        if not tunnel_url:
            print("[SlopiFY Daemon] Could not extract tunnel URL. Retrying in 5 seconds...", file=sys.stderr)
            if tunnel_process:
                tunnel_process.kill()
            time.sleep(5)
            continue

        # Keep alive & heartbeat loop
        last_heartbeat = time.time()
        while tunnel_process.poll() is None:
            time.sleep(10)
            if time.time() - last_heartbeat >= HEARTBEAT_INTERVAL:
                update_firestore_endpoint(tunnel_url, online=True)
                last_heartbeat = time.time()

        print("[SlopiFY Daemon] Tunnel process exited. Reconnecting in 5 seconds...")
        time.sleep(5)

if __name__ == "__main__":
    main()
