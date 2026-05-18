#!/usr/bin/env python3
import argparse
import os
import shlex
import sys


def build_parser():
    parser = argparse.ArgumentParser(description="Run ExcelCC production deploy commands over SSH.")
    parser.add_argument("--host", default=os.environ.get("EXCELCC_DEPLOY_HOST", ""), help="SSH host.")
    parser.add_argument("--port", type=int, default=int(os.environ.get("EXCELCC_DEPLOY_PORT", "22")), help="SSH port.")
    parser.add_argument("--user", default=os.environ.get("EXCELCC_DEPLOY_USER", "root"), help="SSH user.")
    parser.add_argument("--repo-dir", default=os.environ.get("EXCELCC_DEPLOY_REPO_DIR", "/www/wwwroot/excelcc/kick-deploy/repo"), help="Remote deploy repository directory.")
    parser.add_argument("--branch", default=os.environ.get("EXCELCC_DEPLOY_BRANCH", "main"), help="Remote branch to fetch when syncing only.")
    parser.add_argument("--sync-only", action="store_true", help="Only fast-forward the remote deploy repo; do not run deployment.")
    return parser


def require_paramiko():
    try:
        import paramiko  # type: ignore
    except ImportError:
        print("ERROR: Python package 'paramiko' is required. Install with: python -m pip install paramiko", file=sys.stderr)
        raise SystemExit(2)
    return paramiko


def build_deploy_command(repo_dir):
    quoted_repo = shlex.quote(repo_dir)
    return f"""set -e
cd {quoted_repo}
log="/tmp/excelcc-deploy-$(date +%Y%m%d-%H%M%S).log"
set +e
bash scripts/deploy/production-deploy.sh > "$log" 2>&1
code=$?
set -e
printf 'DEPLOY_EXIT:%s\\n' "$code"
printf 'DEPLOY_LOG:%s\\n' "$log"
printf 'REMOTE_AFTER:'
git rev-parse --short HEAD
printf 'LATEST_BACKUP:'
ls -1dt /www/wwwroot/excelcc/kick-deploy/backups/* 2>/dev/null | head -n 1
printf 'REMOTE_STATUS_START\\n'
git status --short
printf 'REMOTE_STATUS_END\\n'
printf 'SERVICES:'
systemctl is-active nginx mysql redis-server kick-backend.service quick-translate.service | tr '\\n' ' '
printf '\\n'
printf 'LOCAL_HOME:'
curl -sS -o /dev/null -w '%{{http_code}}\\n' http://127.0.0.1:8081/api/public/home-overview
printf 'LOCAL_CHAPTERS:'
curl -sS -o /dev/null -w '%{{http_code}}\\n' http://127.0.0.1:8081/api/practice/campaign/chapters
printf 'DEPLOY_LOG_TAIL_START\\n'
tail -n 120 "$log" | LC_ALL=C tr -cd '\\11\\12\\15\\40-\\176'
printf '\\nDEPLOY_LOG_TAIL_END\\n'
exit "$code"
"""


def build_sync_command(repo_dir, branch):
    quoted_repo = shlex.quote(repo_dir)
    quoted_branch = shlex.quote(branch)
    return f"""set -e
cd {quoted_repo}
git fetch origin {quoted_branch}
git merge --ff-only FETCH_HEAD
printf 'BRANCH:'
git branch --show-current
printf 'HEAD:'
git rev-parse --short HEAD
printf 'STATUS_START\\n'
git status --short
printf 'STATUS_END\\n'
"""


def main():
    args = build_parser().parse_args()
    if not args.host:
        print("ERROR: missing SSH host. Set EXCELCC_DEPLOY_HOST or pass --host.", file=sys.stderr)
        return 2

    password = os.environ.get("EXCELCC_DEPLOY_PASSWORD", "")
    key_filename = os.environ.get("EXCELCC_DEPLOY_KEY_FILE", "")
    if not password and not key_filename:
        print("ERROR: missing SSH credential. Set EXCELCC_DEPLOY_PASSWORD or EXCELCC_DEPLOY_KEY_FILE.", file=sys.stderr)
        return 2

    paramiko = require_paramiko()
    command = build_sync_command(args.repo_dir, args.branch) if args.sync_only else build_deploy_command(args.repo_dir)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        args.host,
        port=args.port,
        username=args.user,
        password=password or None,
        key_filename=key_filename or None,
        timeout=20,
        banner_timeout=20,
        auth_timeout=20,
    )
    try:
        _, stdout, stderr = client.exec_command(command, get_pty=False, timeout=1200)
        output = stdout.read().decode("utf-8", errors="replace")
        error = stderr.read().decode("utf-8", errors="replace")
        rc = stdout.channel.recv_exit_status()
    finally:
        client.close()

    if output:
        print(output, end="" if output.endswith("\n") else "\n")
    if error:
        print("REMOTE_STDERR_START", file=sys.stderr)
        print(error, end="" if error.endswith("\n") else "\n", file=sys.stderr)
        print("REMOTE_STDERR_END", file=sys.stderr)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
