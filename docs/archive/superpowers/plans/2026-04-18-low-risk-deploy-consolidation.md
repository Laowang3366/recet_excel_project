# Low-Risk Deploy Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the current production deployment flow into one documented, scriptable, rollback-capable path without changing the live topology.

**Architecture:** Keep the existing Nginx plus `systemd` runtime layout, but formalize one deployment source directory, add a repo-managed deployment script, add HTTP-based health checks, and document backup and rollback procedures. Server-side changes stay additive and low risk.

**Tech Stack:** PowerShell for local inspection, Bash for server deployment, Spring Boot, Vite, systemd, Nginx

---

### Task 1: Add Deployment Documentation

**Files:**
- Create: `D:\project\recet_excel_project\docs\deployment-operations.md`

- [ ] **Step 1: Write the document skeleton**

```md
# 部署与运维说明

## 目标

## 服务器拓扑

## 目录约定

## 部署命令

## 健康检查

## 回滚
```

- [ ] **Step 2: Fill in the current production mapping**

```md
- Nginx 静态目录：`/www/wwwroot/kick-web`
- 后端目录：`/www/wwwroot/kick-backend`
- 部署仓库：`/www/wwwroot/kick-deploy/repo`
- 服务名：`kick-backend.service`
- 历史目录：`/www/wwwroot/kick-src/kick`（不再作为发布入口）
```

- [ ] **Step 3: Add exact runbook commands**

```bash
cd /www/wwwroot/kick-deploy/repo
bash scripts/deploy/production-deploy.sh
curl -fsS http://127.0.0.1:8080/api/public/home-overview
systemctl status kick-backend.service --no-pager
```

- [ ] **Step 4: Review the doc for ambiguity**

Run: `rg -n "TODO|TBD|稍后|之后补充" docs/deployment-operations.md`
Expected: no matches

### Task 2: Add Production Deploy Script

**Files:**
- Create: `D:\project\recet_excel_project\scripts\deploy\production-deploy.sh`

- [ ] **Step 1: Write the script header and fixed config**

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_ENV_DEFAULT="/www/wwwroot/kick-deploy/deploy.env"
HEALTH_ENDPOINT_DEFAULT="http://127.0.0.1:8080/api/public/home-overview"
BACKUP_ROOT_DEFAULT="/www/wwwroot/kick-deploy/backups"
```

- [ ] **Step 2: Add config loading and validation**

```bash
if [[ ! -f "${DEPLOY_ENV:-$DEPLOY_ENV_DEFAULT}" ]]; then
  echo "[deploy] missing deploy env: ${DEPLOY_ENV:-$DEPLOY_ENV_DEFAULT}" >&2
  exit 1
fi

source "${DEPLOY_ENV:-$DEPLOY_ENV_DEFAULT}"

: "${REPO_DIR:?missing REPO_DIR}"
: "${WEB_RUNTIME_DIR:?missing WEB_RUNTIME_DIR}"
: "${BACKEND_RUNTIME_DIR:?missing BACKEND_RUNTIME_DIR}"
: "${BACKEND_SERVICE:?missing BACKEND_SERVICE}"
```

- [ ] **Step 3: Add build, backup, publish, and restart functions**

```bash
build_frontend() { (cd "$REPO_DIR/reace_web" && npm ci && npm run build); }
build_backend() { (cd "$REPO_DIR/excel-forum-backend" && mvn -q -DskipTests package); }
restart_backend() { systemctl restart "$BACKEND_SERVICE"; }
health_check() { curl -fsS "$HEALTH_ENDPOINT" >/dev/null; }
```

- [ ] **Step 4: Add rollback-safe backup logic**

```bash
backup_dir="$BACKUP_ROOT/$timestamp"
mkdir -p "$backup_dir"
cp -a "$WEB_RUNTIME_DIR" "$backup_dir/kick-web"
cp -a "$BACKEND_RUNTIME_DIR/forum-1.0.0.jar" "$backup_dir/forum-1.0.0.jar"
```

- [ ] **Step 5: Add publish logic**

```bash
rm -rf "$WEB_RUNTIME_DIR"
mkdir -p "$WEB_RUNTIME_DIR"
cp -a "$REPO_DIR/reace_web/dist/." "$WEB_RUNTIME_DIR/"
install -m 0644 "$REPO_DIR/excel-forum-backend/target/forum-1.0.0.jar" "$BACKEND_RUNTIME_DIR/forum-1.0.0.jar"
restart_backend
```

- [ ] **Step 6: Add health check and rollback trap**

```bash
if ! health_check; then
  cp -a "$backup_dir/kick-web/." "$WEB_RUNTIME_DIR/"
  install -m 0644 "$backup_dir/forum-1.0.0.jar" "$BACKEND_RUNTIME_DIR/forum-1.0.0.jar"
  restart_backend
  echo "[deploy] rolled back after failed health check" >&2
  exit 1
fi
```

- [ ] **Step 7: Review the script**

Run: `bash -n scripts/deploy/production-deploy.sh`
Expected: no syntax errors

### Task 3: Document the Unique Deployment Source

**Files:**
- Modify: `D:\project\recet_excel_project\README.md`
- Modify: `D:\project\recet_excel_project\RELEASE_CHECKLIST.md`

- [ ] **Step 1: Add a short deployment section to README**

```md
## 生产部署入口

生产服务器唯一部署源码目录约定为 `/www/wwwroot/kick-deploy/repo`。
`/www/wwwroot/kick-src/kick` 仅保留为历史工作目录，不再作为发布入口。
```

- [ ] **Step 2: Add checklist items for deploy hygiene**

```md
- [ ] 已确认生产部署仓 `kick-deploy/repo` 工作树干净
- [ ] 已通过 HTTP 健康检查验证 `/api/public/home-overview`
- [ ] 已生成当前发布备份并确认回滚路径
```

- [ ] **Step 3: Review docs**

Run: `rg -n "kick-src|kick-deploy/repo|home-overview" README.md RELEASE_CHECKLIST.md`
Expected: matches in the new deployment guidance

### Task 4: Reconcile the Current Flyway File and Server State

**Files:**
- Modify: `D:\project\recet_excel_project\excel-forum-backend\src\main\resources\db\migration\V43__link_tutorials_to_practice.sql`

- [ ] **Step 1: Verify local file matches the intended server-safe version**

```sql
ALTER TABLE tutorial_article
    ADD COLUMN one_line_usage VARCHAR(255) NULL AFTER summary;
```

- [ ] **Step 2: Verify the rest of the split ALTER statements remain in place**

```sql
ALTER TABLE tutorial_article
    ADD COLUMN home_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER starter;
```

- [ ] **Step 3: Confirm the file is committed state locally**

Run: `git diff -- excel-forum-backend/src/main/resources/db/migration/V43__link_tutorials_to_practice.sql`
Expected: no local diff for this file

### Task 5: Apply Low-Risk Server Consolidation

**Files:**
- Create on server: `/www/wwwroot/kick-deploy/repo/scripts/deploy/production-deploy.sh`
- Create on server: `/www/wwwroot/kick-deploy/backups/`
- Verify on server: `/etc/systemd/system/kick-backend.service`
- Verify on server: `/www/server/panel/vhost/nginx/kick.conf`

- [ ] **Step 1: Upload repo-managed script and docs**

```bash
scp scripts/deploy/production-deploy.sh root@198.44.178.219:/www/wwwroot/kick-deploy/repo/scripts/deploy/production-deploy.sh
```

- [ ] **Step 2: Create the backup root**

```bash
ssh root@198.44.178.219 "mkdir -p /www/wwwroot/kick-deploy/backups"
```

- [ ] **Step 3: Check server deploy repo status before any publish**

```bash
ssh root@198.44.178.219 "cd /www/wwwroot/kick-deploy/repo && git status --short"
```

- [ ] **Step 4: Run a low-risk deployment from the canonical repo**

```bash
ssh root@198.44.178.219 "cd /www/wwwroot/kick-deploy/repo && bash scripts/deploy/production-deploy.sh"
```

- [ ] **Step 5: Verify production health**

```bash
ssh root@198.44.178.219 "curl -fsS http://127.0.0.1:8080/api/public/home-overview >/dev/null && systemctl is-active kick-backend.service"
```

- [ ] **Step 6: Verify the public site still works**

```bash
ssh root@198.44.178.219 "curl -Iks https://www.excelcc.cn | sed -n '1,10p'"
```

### Task 6: Final Verification

**Files:**
- Verify: `D:\project\recet_excel_project\docs\deployment-operations.md`
- Verify: `D:\project\recet_excel_project\scripts\deploy\production-deploy.sh`

- [ ] **Step 1: Validate bash syntax locally**

Run: `bash -n scripts/deploy/production-deploy.sh`
Expected: no output

- [ ] **Step 2: Validate the new docs exist**

Run: `Get-ChildItem docs/superpowers/specs,docs/superpowers/plans,docs | Where-Object { $_.Name -match 'deploy|deployment|low-risk' }`
Expected: shows the new spec, plan, and operations doc

- [ ] **Step 3: Capture the final server state**

Run: `ssh root@198.44.178.219 "systemctl status kick-backend.service --no-pager -l | sed -n '1,20p'"`
Expected: `active (running)`
