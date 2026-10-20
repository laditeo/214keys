# -*- coding: utf-8 -*-
"""Deploy the static 214keys site to the VPS over SSH (key auth)."""
import io
import sys
import tarfile
from pathlib import Path

import paramiko

HOST = "103.232.120.140"
USER = "root"
REMOTE = "/var/www/spatilabs/214keys"
LOCAL = Path(r"C:\Users\user\Documents\Github\214 keys")
KEY = Path.home() / ".ssh" / "id_ed25519"

INCLUDE = ["index.html", "basic", "pynpinyin", "css", "js", "audio/pinyin", "data"]
SKIP_SUFFIXES = {".pyc"}
SKIP_DIRS = {"__pycache__"}


def build_tarball() -> io.BytesIO:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for entry in INCLUDE:
            path = LOCAL / entry
            if not path.exists():
                print(f"skip missing {entry}")
                continue
            if path.is_file():
                tar.add(path, arcname=entry)
                continue
            for file in path.rglob("*"):
                if not file.is_file():
                    continue
                if file.suffix in SKIP_SUFFIXES or any(part in SKIP_DIRS for part in file.parts):
                    continue
                tar.add(file, arcname=file.relative_to(LOCAL).as_posix())
    buf.seek(0)
    return buf


def main() -> None:
    buf = build_tarball()
    size_mb = len(buf.getvalue()) / 1024 / 1024
    print(f"tarball: {size_mb:.1f} MB")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, key_filename=str(KEY), timeout=30)

    stamp = client.exec_command("date +%F-%H%M%S")[1].read().decode().strip()
    backup = f"{REMOTE}.bak-{stamp}"
    cmd = (
        f"cp -a {REMOTE} {backup} && "
        f"tar -xzf /tmp/214keys.tgz -C {REMOTE} && "
        f"chmod -R a+rX {REMOTE} && "
        f"echo backup={backup}"
    )

    sftp = client.open_sftp()
    sftp.putfo(buf, "/tmp/214keys.tgz")
    sftp.close()

    _stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    status = stdout.channel.recv_exit_status()
    client.close()

    print(out.strip())
    if err.strip():
        print("STDERR:", err.strip()[:800])
    if status != 0:
        sys.exit("deploy failed")


if __name__ == "__main__":
    main()
