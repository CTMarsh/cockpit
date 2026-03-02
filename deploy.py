#!/usr/bin/env python3
"""Deploy cockpit to LXC 113 via paramiko SFTP + SSH.

Usage:
    python deploy.py          # Full sync + rebuild
    python deploy.py --quick  # Sync files only, no rebuild
"""
import os
import sys
import io
import paramiko

# Fix Windows encoding
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LXC_HOST = "10.0.80.132"
LXC_USER = "root"
LXC_PASS = "cockpit2026"
REMOTE_DIR = "/opt/cockpit"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

IGNORE = {
    "node_modules", "dist", "data", ".git", ".env",
    "bun.lock", "__pycache__", "deploy.py", ".claude"
}


def should_ignore(name):
    return name in IGNORE or name.startswith(".")


def ssh_exec(client, cmd, check=True):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    code = stdout.channel.recv_exit_status()
    if check and code != 0:
        print(f"  CMD FAILED ({code}): {cmd[:80]}")
        if err:
            print(f"  STDERR: {err[:300]}")
    return out, err, code


def upload_dir(sftp, local_path, remote_path):
    """Recursively upload a directory."""
    for item in sorted(os.listdir(local_path)):
        if should_ignore(item):
            continue
        local_item = os.path.join(local_path, item)
        remote_item = f"{remote_path}/{item}"
        if os.path.isdir(local_item):
            try:
                sftp.stat(remote_item)
            except FileNotFoundError:
                sftp.mkdir(remote_item)
            upload_dir(sftp, local_item, remote_item)
        else:
            size = os.path.getsize(local_item)
            if size > 5 * 1024 * 1024:
                print(f"  SKIP (large): {item}")
                continue
            print(f"  -> {remote_item}")
            sftp.put(local_item, remote_item)


def main():
    quick = "--quick" in sys.argv

    print(f"=== Deploying cockpit to {LXC_HOST} {'(quick)' if quick else ''} ===")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(LXC_HOST, username=LXC_USER, password=LXC_PASS, timeout=10)
    print("Connected via SSH")

    ssh_exec(client, f"mkdir -p {REMOTE_DIR}")

    # Upload files via SFTP
    print("\nUploading project files...")
    sftp = client.open_sftp()
    upload_dir(sftp, LOCAL_DIR, REMOTE_DIR)

    env_local = os.path.join(LOCAL_DIR, ".env")
    if os.path.exists(env_local):
        print(f"  -> {REMOTE_DIR}/.env")
        sftp.put(env_local, f"{REMOTE_DIR}/.env")
    sftp.close()
    print("Upload complete")

    if not quick:
        print("\nRebuilding and deploying...")
        commands = [
            (f"cd {REMOTE_DIR} && docker compose build 2>&1 | tail -5", "Building"),
            (f"cd {REMOTE_DIR} && docker compose up -d 2>&1", "Starting"),
        ]
        for cmd, label in commands:
            print(f"  {label}...")
            out, err, code = ssh_exec(client, cmd, check=False)
            if out:
                for line in out.split("\n")[-3:]:
                    print(f"    {line}")

    # Health check
    print("\nHealth check...")
    import time
    time.sleep(3)
    out, _, _ = ssh_exec(client, "curl -sf http://localhost:4000/api/health", check=False)
    print(f"  API: {out}")
    out, _, _ = ssh_exec(client, "curl -skf https://localhost -o /dev/null -w '%{http_code}'", check=False)
    print(f"  Web HTTPS: {out}")

    client.close()
    print("\n=== Deployment complete ===")


if __name__ == "__main__":
    main()
