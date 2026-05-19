#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_ENV_DEFAULT="/www/wwwroot/excelcc/kick-deploy/deploy.env"
HEALTH_ENDPOINT_DEFAULT="http://127.0.0.1:8081/api/public/home-overview"
BACKUP_ROOT_DEFAULT="/www/wwwroot/excelcc/kick-deploy/backups"
HEALTH_RETRY_COUNT_DEFAULT=24
HEALTH_RETRY_DELAY_DEFAULT=5

DEPLOY_ENV_PATH="${DEPLOY_ENV:-$DEPLOY_ENV_DEFAULT}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-$HEALTH_ENDPOINT_DEFAULT}"
BACKUP_ROOT="${BACKUP_ROOT:-$BACKUP_ROOT_DEFAULT}"
HEALTH_RETRY_COUNT="${HEALTH_RETRY_COUNT:-$HEALTH_RETRY_COUNT_DEFAULT}"
HEALTH_RETRY_DELAY="${HEALTH_RETRY_DELAY:-$HEALTH_RETRY_DELAY_DEFAULT}"
CALLER_GIT_PULL_BEFORE_BUILD_IS_SET=0
CALLER_GIT_PULL_BEFORE_BUILD=""
if [[ ${GIT_PULL_BEFORE_BUILD+x} ]]; then
  CALLER_GIT_PULL_BEFORE_BUILD="$GIT_PULL_BEFORE_BUILD"
  CALLER_GIT_PULL_BEFORE_BUILD_IS_SET=1
fi

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

validate_directory() {
  local path="$1"
  [[ -d "$path" ]] || fail "missing directory: $path"
}

validate_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "missing file: $path"
}

copy_file_if_present() {
  local source_file="$1"
  local backup_file="$2"

  if [[ -f "$source_file" ]]; then
    mkdir -p "$(dirname "$backup_file")"
    cp -a "$source_file" "$backup_file"
  fi
}

is_precompressible_frontend_file() {
  case "$1" in
    *.js|*.css|*.html|*.json|*.svg) return 0 ;;
    *) return 1 ;;
  esac
}

health_check() {
  local attempt
  for (( attempt=1; attempt<=HEALTH_RETRY_COUNT; attempt++ )); do
    if curl -fsS "$HEALTH_ENDPOINT" >/dev/null; then
      log "health check passed on attempt ${attempt}"
      return 0
    fi
    sleep "$HEALTH_RETRY_DELAY"
  done
  return 1
}

backup_frontend_managed_files() {
  local dist_dir="$REPO_DIR/reace_web/dist"
  local source_file file_name rel_path runtime_file backup_file

  mkdir -p "$WEB_BACKUP_DIR"

  if [[ -f "$WEB_RUNTIME_DIR/index.html" ]]; then
    cp -a "$WEB_RUNTIME_DIR/index.html" "$WEB_BACKUP_DIR/index.html"
  fi
  copy_file_if_present "$WEB_RUNTIME_DIR/index.html.gz" "$WEB_BACKUP_DIR/index.html.gz"

  mkdir -p "$WEB_BACKUP_DIR/root-files"
  while IFS= read -r -d '' source_file; do
    file_name="$(basename "$source_file")"
    [[ "$file_name" == "index.html" ]] && continue
    [[ "$file_name" == *.gz ]] && continue
    copy_file_if_present "$WEB_RUNTIME_DIR/$file_name" "$WEB_BACKUP_DIR/root-files/$file_name"
    copy_file_if_present "$WEB_RUNTIME_DIR/$file_name.gz" "$WEB_BACKUP_DIR/root-files/$file_name.gz"
  done < <(find "$dist_dir" -maxdepth 1 -type f -print0)

  if [[ -d "$dist_dir/assets" && -d "$WEB_RUNTIME_DIR/assets" ]]; then
    while IFS= read -r -d '' rel_path; do
      rel_path="${rel_path#./}"
      [[ "$rel_path" == *.gz ]] && continue
      runtime_file="$WEB_RUNTIME_DIR/assets/$rel_path"
      backup_file="$WEB_BACKUP_DIR/assets/$rel_path"
      copy_file_if_present "$runtime_file" "$backup_file"
      copy_file_if_present "$runtime_file.gz" "$backup_file.gz"
    done < <(cd "$dist_dir/assets" && find . -type f -print0)
  fi
}

precompress_frontend_static_assets() {
  local dist_dir="$REPO_DIR/reace_web/dist"
  local source_file file_name rel_path runtime_file
  local file gz_file tmp_file compressed_count=0

  if ! command -v gzip >/dev/null 2>&1; then
    log "gzip not found; skipping frontend static precompression"
    return 0
  fi

  precompress_file() {
    file="$1"
    [[ -f "$file" ]] || return 0
    is_precompressible_frontend_file "$file" || return 0

    gz_file="${file}.gz"
    tmp_file="${gz_file}.tmp.$$"
    rm -f "$tmp_file"

    if ! gzip -9 -n -c "$file" > "$tmp_file"; then
      rm -f "$tmp_file"
      return 1
    fi
    chown "$DEPLOY_USER:$DEPLOY_GROUP" "$tmp_file" || {
      rm -f "$tmp_file"
      return 1
    }
    chmod 0644 "$tmp_file" || {
      rm -f "$tmp_file"
      return 1
    }
    mv -f "$tmp_file" "$gz_file" || {
      rm -f "$tmp_file"
      return 1
    }
    compressed_count=$((compressed_count + 1))
  }

  precompress_file "$WEB_RUNTIME_DIR/index.html" || return 1

  while IFS= read -r -d '' source_file; do
    file_name="$(basename "$source_file")"
    [[ "$file_name" == "index.html" ]] && continue
    [[ "$file_name" == *.gz ]] && continue
    runtime_file="$WEB_RUNTIME_DIR/$file_name"
    precompress_file "$runtime_file" || return 1
  done < <(find "$dist_dir" -maxdepth 1 -type f -print0)

  if [[ -d "$dist_dir/assets" ]]; then
    while IFS= read -r -d '' rel_path; do
      rel_path="${rel_path#./}"
      [[ "$rel_path" == *.gz ]] && continue
      runtime_file="$WEB_RUNTIME_DIR/assets/$rel_path"
      precompress_file "$runtime_file" || return 1
    done < <(cd "$dist_dir/assets" && find . -type f -print0)
  fi

  log "precompressed frontend static files: ${compressed_count}"
}

publish_frontend_dist() {
  local dist_dir="$REPO_DIR/reace_web/dist"
  local source_file file_name rel_path target_path

  install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$WEB_RUNTIME_DIR"
  install -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0644 \
    "$dist_dir/index.html" \
    "$WEB_RUNTIME_DIR/index.html"

  if [[ -d "$dist_dir/assets" ]]; then
    install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$WEB_RUNTIME_DIR/assets"
    cp -a "$dist_dir/assets/." "$WEB_RUNTIME_DIR/assets/"
    while IFS= read -r -d '' rel_path; do
      rel_path="${rel_path#./}"
      target_path="$WEB_RUNTIME_DIR/assets/$rel_path"
      if [[ -e "$target_path" || -L "$target_path" ]]; then
        chown -h "$DEPLOY_USER:$DEPLOY_GROUP" "$target_path"
      fi
    done < <(cd "$dist_dir/assets" && find . -mindepth 1 -print0)
  fi

  while IFS= read -r -d '' source_file; do
    file_name="$(basename "$source_file")"
    [[ "$file_name" == "index.html" ]] && continue
    cp -a "$source_file" "$WEB_RUNTIME_DIR/$file_name"
    chown -h "$DEPLOY_USER:$DEPLOY_GROUP" "$WEB_RUNTIME_DIR/$file_name"
  done < <(find "$dist_dir" -maxdepth 1 -type f -print0)
}

restore_frontend_managed_files() {
  if [[ ! -d "${WEB_BACKUP_DIR:-}" ]]; then
    return 0
  fi

  install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$WEB_RUNTIME_DIR"

  if [[ -f "$WEB_BACKUP_DIR/index.html" ]]; then
    install -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0644 \
      "$WEB_BACKUP_DIR/index.html" \
      "$WEB_RUNTIME_DIR/index.html"
  fi
  if [[ -f "$WEB_BACKUP_DIR/index.html.gz" ]]; then
    install -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0644 \
      "$WEB_BACKUP_DIR/index.html.gz" \
      "$WEB_RUNTIME_DIR/index.html.gz"
  fi

  if [[ -d "$WEB_BACKUP_DIR/root-files" ]]; then
    cp -a "$WEB_BACKUP_DIR/root-files/." "$WEB_RUNTIME_DIR/"
  fi

  if [[ -d "$WEB_BACKUP_DIR/assets" ]]; then
    install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$WEB_RUNTIME_DIR/assets"
    cp -a "$WEB_BACKUP_DIR/assets/." "$WEB_RUNTIME_DIR/assets/"
  fi

  if ! precompress_frontend_static_assets; then
    log "rollback restored frontend files but could not refresh precompressed assets"
  fi
}

rollback() {
  if [[ "${ROLLBACK_READY:-0}" != "1" ]]; then
    return 0
  fi

  log "starting rollback"

  restore_frontend_managed_files

  if [[ -f "${BACKUP_DIR}/forum-1.0.0.jar" ]]; then
    install -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0644 \
      "${BACKUP_DIR}/forum-1.0.0.jar" \
      "${BACKEND_RUNTIME_DIR}/forum-1.0.0.jar"
  fi

  systemctl restart "$BACKEND_SERVICE" || true
  if health_check; then
    log "rollback recovered service"
  else
    log "rollback completed but service still unhealthy"
  fi
}

on_error() {
  local exit_code=$?
  log "deployment failed with exit code ${exit_code}"
  rollback
  exit "$exit_code"
}

trap on_error ERR

[[ -f "$DEPLOY_ENV_PATH" ]] || fail "missing deploy env: $DEPLOY_ENV_PATH"
# shellcheck disable=SC1090
source "$DEPLOY_ENV_PATH"

: "${REPO_DIR:?missing REPO_DIR}"
: "${WEB_RUNTIME_DIR:?missing WEB_RUNTIME_DIR}"
: "${BACKEND_RUNTIME_DIR:?missing BACKEND_RUNTIME_DIR}"
: "${BACKEND_SERVICE:?missing BACKEND_SERVICE}"
: "${DEPLOY_USER:?missing DEPLOY_USER}"
: "${DEPLOY_GROUP:?missing DEPLOY_GROUP}"

GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-${BRANCH:-}}"
if [[ "$CALLER_GIT_PULL_BEFORE_BUILD_IS_SET" == "1" ]]; then
  GIT_PULL_BEFORE_BUILD="$CALLER_GIT_PULL_BEFORE_BUILD"
fi
GIT_PULL_BEFORE_BUILD="${GIT_PULL_BEFORE_BUILD:-1}"

if [[ "$ROOT_DIR" != "$REPO_DIR" ]]; then
  fail "script must run from canonical repo: expected $REPO_DIR but got $ROOT_DIR"
fi

require_command git
require_command npm
require_command mvn
require_command curl
require_command systemctl
require_command install
require_command find

validate_directory "$REPO_DIR"
validate_directory "$REPO_DIR/reace_web"
validate_directory "$REPO_DIR/excel-forum-backend"
validate_directory "$WEB_RUNTIME_DIR"
validate_directory "$BACKEND_RUNTIME_DIR"
validate_file "$BACKEND_RUNTIME_DIR/.env.production"
validate_file "$BACKEND_RUNTIME_DIR/forum-1.0.0.jar"

timestamp="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${timestamp}"
WEB_BACKUP_DIR="${BACKUP_DIR}/kick-web-managed"
ROLLBACK_READY=0

mkdir -p "$BACKUP_ROOT"

log "repo dir: $REPO_DIR"
if [[ -n "$(git -C "$REPO_DIR" status --short)" ]]; then
  log "deploy repo has local modifications"
  git -C "$REPO_DIR" status --short
  if [[ "$GIT_PULL_BEFORE_BUILD" == "1" ]]; then
    fail "cannot pull with local modifications in $REPO_DIR"
  fi
else
  log "deploy repo worktree is clean"
fi

if [[ "$GIT_PULL_BEFORE_BUILD" == "1" ]]; then
  if [[ -n "${REPO_URL:-}" ]]; then
    current_remote_url="$(git -C "$REPO_DIR" config --get "remote.${GIT_REMOTE}.url" || true)"
    if [[ "$current_remote_url" != "$REPO_URL" ]]; then
      log "setting git remote ${GIT_REMOTE} url"
      git -C "$REPO_DIR" remote set-url "$GIT_REMOTE" "$REPO_URL"
    fi
  fi

  if [[ -z "$GIT_BRANCH" ]]; then
    GIT_BRANCH="$(git -C "$REPO_DIR" branch --show-current)"
  fi
  [[ -n "$GIT_BRANCH" ]] || fail "missing git branch; set BRANCH or GIT_BRANCH in $DEPLOY_ENV_PATH"

  log "fetching ${GIT_REMOTE}/${GIT_BRANCH}"
  git -C "$REPO_DIR" fetch --prune "$GIT_REMOTE" "$GIT_BRANCH"
  git -C "$REPO_DIR" show-ref --verify --quiet "refs/remotes/${GIT_REMOTE}/${GIT_BRANCH}" \
    || fail "remote branch not found: ${GIT_REMOTE}/${GIT_BRANCH}"

  current_branch="$(git -C "$REPO_DIR" branch --show-current)"
  if [[ "$current_branch" != "$GIT_BRANCH" ]]; then
    log "switching git branch from ${current_branch:-detached} to ${GIT_BRANCH}"
    if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/${GIT_BRANCH}"; then
      git -C "$REPO_DIR" checkout "$GIT_BRANCH"
    else
      git -C "$REPO_DIR" checkout -b "$GIT_BRANCH" --track "${GIT_REMOTE}/${GIT_BRANCH}"
    fi
  fi

  log "pulling latest code with fast-forward only"
  git -C "$REPO_DIR" pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"
fi

log "git branch: $(git -C "$REPO_DIR" branch --show-current)"
log "git commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"

log "building frontend"
(cd "$REPO_DIR/reace_web" && npm ci && npm run build)

log "building backend"
(cd "$REPO_DIR/excel-forum-backend" && mvn -q clean -DskipTests package)

validate_directory "$REPO_DIR/reace_web/dist"
validate_file "$REPO_DIR/excel-forum-backend/target/forum-1.0.0.jar"

log "creating backup at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
backup_frontend_managed_files
cp -a "$BACKEND_RUNTIME_DIR/forum-1.0.0.jar" "${BACKUP_DIR}/forum-1.0.0.jar"
ROLLBACK_READY=1

log "publishing frontend managed files"
publish_frontend_dist
precompress_frontend_static_assets

log "publishing backend jar"
install -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0644 \
  "$REPO_DIR/excel-forum-backend/target/forum-1.0.0.jar" \
  "$BACKEND_RUNTIME_DIR/forum-1.0.0.jar"

log "restarting backend service"
systemctl restart "$BACKEND_SERVICE"

log "waiting for backend health"
health_check

log "deployment succeeded"
