#!/usr/bin/env python3
"""
SlopiFY Tunnel Daemon for Linux Mint / Ubuntu
Automates Cloudflare Quick Tunnel, continuously monitors tunnel health,
drains subprocess output buffers, and syncs the live HTTPS endpoint to Firebase Firestore.
"""

import os
import re
import sys
import time
import json
import signal
import threading
import subprocess
import urllib.request
import urllib.error

# Configuration
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "AIzaSyCLiKERj-DXvqA-XKYOYuqT4BvKeW6q930")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "slopify-a4cda")
DAEMON_EMAIL = os.environ.get("DAEMON_EMAIL", "daemon@slopify.local")
DAEMON_PASSWORD = os.environ.get("DAEMON_PASSWORD", "slopify_daemon_pass_2026!")
LOCAL_MINIO_URL = os.environ.get("LOCAL_MINIO_URL", "http://localhost:9000")
HEARTBEAT_INTERVAL = 180 # 3 minutes
HEALTH_CHECK_INTERVAL = 30 # 30 seconds

tunnel_process = None
current_discovered_url = None
stop_event = threading.Event()

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
        print("[SlopiFY Daemon] Failed to get Firebase auth token. Retrying on next cycle...", file=sys.stderr)
        return False

    url = (
        f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/"
        f"storage_meta/global?updateMask.fieldPaths=endpointUrl&updateMask.fieldPaths=online&updateMask.fieldPaths=lastUpdated&key={FIREBASE_API_KEY}"
    )

    payload = json.dumps({
        "fields": {
            "endpointUrl": {"stringValue": endpoint_url.rstrip("/") if endpoint_url else ""},
            "online": {"booleanValue": bool(online)},
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
                print(f"[SlopiFY Daemon] Successfully synced Firestore endpoint: {endpoint_url} (online={online})")
                return True
    except Exception as e:
        print(f"[SlopiFY Daemon] Firestore update error: {e}", file=sys.stderr)
    return False

def check_public_health(endpoint_url):
    """Verify that the public tunnel URL is reachable and forwarding to MinIO."""
    if not endpoint_url:
        return False
    health_url = f"{endpoint_url.rstrip('/')}/minio/health/ready"
    try:
        req = urllib.request.Request(health_url, headers={"User-Agent": "SlopiFY-Daemon/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status == 200
    except Exception as e:
        # Also try root bucket path in case health endpoint is restricted
        try:
            root_url = f"{endpoint_url.rstrip('/')}/slopify-audio/"
            req2 = urllib.request.Request(root_url, headers={"User-Agent": "SlopiFY-Daemon/1.0"})
            with urllib.request.urlopen(req2, timeout=8) as resp2:
                return resp2.status in [200, 403, 404]
        except Exception:
            return False

def pipe_drain_worker(proc):
    """Continuously read and drain stdout from cloudflared to prevent buffer stalls."""
    global current_discovered_url
    url_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    for line in iter(proc.stdout.readline, ''):
        if not line:
            break
        cleaned = line.strip()
        if cleaned:
            # Print important log lines
            if "trycloudflare.com" in cleaned or "Registered tunnel" in cleaned or "ERR" in cleaned:
                print(f"[cloudflared] {cleaned}")
        match = url_regex.search(line)
        if match and not current_discovered_url:
            current_discovered_url = match.group(0)

def signal_handler(sig, frame):
    print("\n[SlopiFY Daemon] Shutting down tunnel daemon...")
    stop_event.set()
    if tunnel_process:
        try:
            tunnel_process.terminate()
            tunnel_process.wait(timeout=3)
        except Exception:
            try:
                tunnel_process.kill()
            except Exception:
                pass
    try:
        update_firestore_endpoint("", online=False)
    except Exception:
        pass
    sys.exit(0)

def main():
    global tunnel_process, current_discovered_url
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("==================================================")
    print("      SlopiFY Storage Tunnel Daemon (Linux Mint)   ")
    print("==================================================")
    print(f"Targeting local MinIO: {LOCAL_MINIO_URL}")

    # Check if cloudflared is installed
    check_cf = subprocess.run(["which", "cloudflared"], capture_output=True, text=True)
    if check_cf.returncode != 0:
        print("[SlopiFY Daemon] ERROR: cloudflared is not installed!", file=sys.stderr)
        sys.exit(1)

    while not stop_event.is_set():
        current_discovered_url = None
        print("\n[SlopiFY Daemon] Starting Cloudflare Quick Tunnel...")
        cmd = ["cloudflared", "tunnel", "--url", LOCAL_MINIO_URL]

        try:
            tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
        except Exception as e:
            print(f"[SlopiFY Daemon] Failed to start cloudflared: {e}", file=sys.stderr)
            time.sleep(5)
            continue

        # Start drain thread
        drain_thread = threading.Thread(target=pipe_drain_worker, args=(tunnel_process,), daemon=True)
        drain_thread.start()

        # Wait up to 30 seconds for tunnel URL discovery
        wait_start = time.time()
        while not current_discovered_url and (time.time() - wait_start < 30) and (tunnel_process.poll() is None):
            time.sleep(0.5)

        if not current_discovered_url:
            print("[SlopiFY Daemon] Could not extract tunnel URL in 30s. Restarting...", file=sys.stderr)
            if tunnel_process:
                tunnel_process.kill()
            time.sleep(5)
            continue

        tunnel_url = current_discovered_url
        print("--------------------------------------------------")
        print(f"[SlopiFY Daemon] LIVE TUNNEL URL: {tunnel_url}")
        print("--------------------------------------------------")
        update_firestore_endpoint(tunnel_url, online=True)

        consecutive_failures = 0
        last_heartbeat = time.time()

        # Active monitoring loop
        while not stop_event.is_set() and tunnel_process.poll() is None:
            time.sleep(HEALTH_CHECK_INTERVAL)

            # Check public health
            is_healthy = check_public_health(tunnel_url)
            if is_healthy:
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                print(f"[SlopiFY Daemon] Public health check failed ({consecutive_failures}/3) for {tunnel_url}", file=sys.stderr)
                if consecutive_failures >= 3:
                    print("[SlopiFY Daemon] Tunnel unresponsive. Restarting tunnel...", file=sys.stderr)
                    break

            # Heartbeat sync
            if time.time() - last_heartbeat >= HEARTBEAT_INTERVAL:
                update_firestore_endpoint(tunnel_url, online=True)
                last_heartbeat = time.time()

        print("[SlopiFY Daemon] Cleaning up dead tunnel process...")
        if tunnel_process:
            try:
                tunnel_process.terminate()
                tunnel_process.wait(timeout=4)
            except Exception:
                try:
                    tunnel_process.kill()
                except Exception:
                    pass
            tunnel_process = None

        time.sleep(3)

if __name__ == "__main__":
    main()
