#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

REMOTE_USER=${REMOTE_USER:-ubuntu}
REMOTE_HOST=${REMOTE_HOST:-3.135.94.213}
REMOTE_APP_DIR=${REMOTE_APP_DIR:-/opt/apps/zuam}
REMOTE_ENV_FILE=${REMOTE_ENV_FILE:-.env}
LOCAL_ENV_FILE=${LOCAL_ENV_FILE:-}
LOCAL_DATA_DIRS=${LOCAL_DATA_DIRS:-data}
BUILD_COMMAND=${BUILD_COMMAND:-"npm run build"}
TRUCO_APP_DIR=${TRUCO_APP_DIR:-"$APP_DIR/../../../Documents/Truco"}
TRUCO_BUILD_COMMAND=${TRUCO_BUILD_COMMAND:-"npm run build:static"}
REMOTE_GIT_PULL_COMMAND=${REMOTE_GIT_PULL_COMMAND:-"git pull --ff-only"}
REMOTE_DEPLOY_COMMAND=${REMOTE_DEPLOY_COMMAND:-"APP_ENV_FILE=.env STATIC_DOCKERFILE=Dockerfile.static-prebuilt SKIP_GIT_PULL=1 ./deploy.sh"}
SSH_CONNECT_TIMEOUT_SECONDS=${SSH_CONNECT_TIMEOUT_SECONDS:-15}
VERIFY_DEPLOY_GIT_STATE=${VERIFY_DEPLOY_GIT_STATE:-1}
PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-}

PEM_FILE=${PEM_FILE:-"$HOME/.ssh/ubuntu-1-2026-06"}

SSH_TARGET="$REMOTE_USER@$REMOTE_HOST"
SSH_OPTS="-i $PEM_FILE -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=$SSH_CONNECT_TIMEOUT_SECONDS -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -o StrictHostKeyChecking=accept-new"
RSYNC_SSH="ssh $SSH_OPTS"
BUILD_ENV_EXPORTS=

cleanup() {
  if [ -n "${BUILD_ENV_EXPORTS:-}" ] && [ -f "$BUILD_ENV_EXPORTS" ]; then
    rm -f "$BUILD_ENV_EXPORTS"
  fi
}

trap cleanup EXIT INT TERM

start_step() {
  STEP_NAME=$1
  STEP_STARTED_AT=$(date +%s)
  printf '\n%s...\n' "$STEP_NAME"
}

finish_step() {
  STEP_FINISHED_AT=$(date +%s)
  printf '%s completed in %ss\n' "$STEP_NAME" "$((STEP_FINISHED_AT - STEP_STARTED_AT))"
}

require_file() {
  FILE=$1
  MESSAGE=$2
  if [ ! -f "$FILE" ]; then
    printf '%s\n' "$MESSAGE" >&2
    exit 1
  fi
}

require_dir() {
  DIR=$1
  MESSAGE=$2
  if [ ! -d "$DIR" ]; then
    printf '%s\n' "$MESSAGE" >&2
    exit 1
  fi
}

require_command() {
  COMMAND=$1
  if ! command -v "$COMMAND" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$COMMAND" >&2
    exit 1
  fi
}

get_env_value() {
  FILE=$1
  NAME=$2

  grep -E "^[[:space:]]*$NAME=" "$FILE" \
    | tail -n 1 \
    | sed 's/^[^=]*=//' \
    | sed "s/^[\"']//; s/[\"']$//" \
    || true
}

verify_local_deploy_git_state() {
  if [ "$VERIFY_DEPLOY_GIT_STATE" != "1" ]; then
    return 0
  fi

  if ! command -v git >/dev/null 2>&1 || [ ! -d "$APP_DIR/.git" ]; then
    echo "Cannot verify whether the deployment configuration was pushed." >&2
    echo "Set VERIFY_DEPLOY_GIT_STATE=0 only if you intentionally deploy without Git." >&2
    exit 1
  fi

  DIRTY_DEPLOY_FILES=$(git status --porcelain -- \
    deploy-production.local.sh deploy.sh docker-compose.yml Dockerfile.static Dockerfile.static-prebuilt \
    docker/static/nginx.conf package.json scripts 2>/dev/null || true)

  if [ -n "$DIRTY_DEPLOY_FILES" ]; then
    echo "Uncommitted deployment configuration detected:" >&2
    printf '%s\n' "$DIRTY_DEPLOY_FILES" >&2
    echo "Commit and push these files before deploying; the server updates its Docker/Nginx configuration with git pull." >&2
    exit 1
  fi
}

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

write_next_public_exports() {
  ENV_FILE=$1
  OUTPUT_FILE=$2

  node - "$ENV_FILE" > "$OUTPUT_FILE" <<'NODE'
const fs = require("fs");

const envFile = process.argv[2];
const text = fs.readFileSync(envFile, "utf8");

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseValue(rawValue) {
  let value = rawValue.trim();
  const quote = value[0];

  if ((quote === `"` || quote === `'`) && value[value.length - 1] === quote) {
    value = value.slice(1, -1);
    return quote === `"` ? value.replace(/\\n/g, "\n") : value;
  }

  return value.replace(/\s+#.*$/, "").trimEnd();
}

for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^\s*(NEXT_PUBLIC_[A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) {
    continue;
  }

  console.log(`export ${match[1]}=${shellQuote(parseValue(match[2]))}`);
}
NODE
}

remote_env_path() {
  case "$REMOTE_ENV_FILE" in
    /*) printf '%s\n' "$REMOTE_ENV_FILE" ;;
    *) printf '%s/%s\n' "$REMOTE_APP_DIR" "$REMOTE_ENV_FILE" ;;
  esac
}

cd "$APP_DIR"

if [ -z "$LOCAL_ENV_FILE" ]; then
  LOCAL_ENV_FILE="$APP_DIR/.env.production"
fi

require_command rsync
require_command ssh
require_command npm
require_command node
require_command curl
require_file "$PEM_FILE" "Missing SSH key file: $PEM_FILE. Run with PEM_FILE=/path/to/key ./deploy-production.local.sh if it lives elsewhere."
require_file "$LOCAL_ENV_FILE" "Missing production env file: $LOCAL_ENV_FILE"

verify_local_deploy_git_state
LOCAL_DEPLOY_COMMIT=$(git rev-parse HEAD 2>/dev/null || true)

if [ -z "$PUBLIC_BASE_URL" ]; then
  APP_HOST_VALUE=$(get_env_value "$LOCAL_ENV_FILE" "APP_HOST")
  if [ -n "$APP_HOST_VALUE" ]; then
    PUBLIC_BASE_URL="https://$APP_HOST_VALUE"
  fi
fi

for LOCAL_DATA_DIR in $LOCAL_DATA_DIRS; do
  require_dir "$APP_DIR/$LOCAL_DATA_DIR" "Missing local data directory: $APP_DIR/$LOCAL_DATA_DIR"
done

chmod 400 "$PEM_FILE" 2>/dev/null || true

printf 'Deploying Zuam production\n'
printf '  local app:   %s\n' "$APP_DIR"
printf '  server:      %s\n' "$SSH_TARGET"
printf '  remote app:  %s\n' "$REMOTE_APP_DIR"
printf '  local env:   %s\n' "$LOCAL_ENV_FILE"
printf '  remote env:  %s\n' "$(remote_env_path)"
printf '  data dirs:   %s\n' "$LOCAL_DATA_DIRS"
printf '  build cmd:   %s\n' "$BUILD_COMMAND"
printf '  truco app:   %s\n' "$TRUCO_APP_DIR"
printf '  truco build: %s\n' "$TRUCO_BUILD_COMMAND"
printf '  pem:         %s\n' "$PEM_FILE"
if [ -n "$REMOTE_GIT_PULL_COMMAND" ]; then
  printf '  remote git:  %s\n' "$REMOTE_GIT_PULL_COMMAND"
else
  printf '  remote git:  disabled\n'
fi
printf '  remote run:  %s\n' "$REMOTE_DEPLOY_COMMAND"
if [ -n "$PUBLIC_BASE_URL" ]; then
  printf '  public URL:  %s\n' "$PUBLIC_BASE_URL"
fi

start_step "Building La Casita for /truco"
TRUCO_APP_DIR="$TRUCO_APP_DIR" TRUCO_BUILD_COMMAND="$TRUCO_BUILD_COMMAND" sh "$APP_DIR/scripts/build-truco-static.sh"
finish_step

start_step "Building Zuam static site"
BUILD_ENV_EXPORTS=$(mktemp)
write_next_public_exports "$LOCAL_ENV_FILE" "$BUILD_ENV_EXPORTS"
. "$BUILD_ENV_EXPORTS"
APP_ENV_FILE="$LOCAL_ENV_FILE" NEXT_TELEMETRY_DISABLED=1 sh -c "$BUILD_COMMAND"
require_dir "$APP_DIR/out" "Missing static export directory after build: $APP_DIR/out"
require_file "$APP_DIR/out/truco/index.html" "Missing assembled Truco application: $APP_DIR/out/truco/index.html"
require_file "$APP_DIR/out/truco/manifest.webmanifest" "Missing Truco PWA manifest: $APP_DIR/out/truco/manifest.webmanifest"
finish_step

start_step "Checking remote app directory"
REMOTE_CHECK_COMMAND="REMOTE_APP_DIR=$(shell_quote "$REMOTE_APP_DIR") sh -s"
ssh $SSH_OPTS "$SSH_TARGET" "$REMOTE_CHECK_COMMAND" <<'REMOTE_CHECK'
set -eu

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [ ! -d "$REMOTE_APP_DIR" ]; then
  fail "Missing remote app directory: $REMOTE_APP_DIR"
fi

if [ ! -d "$REMOTE_APP_DIR/.git" ]; then
  fail "Remote app directory is not a Git checkout: $REMOTE_APP_DIR"
fi

if [ ! -f "$REMOTE_APP_DIR/deploy.sh" ]; then
  fail "Missing remote deploy script: $REMOTE_APP_DIR/deploy.sh"
fi

if [ ! -x "$REMOTE_APP_DIR/deploy.sh" ]; then
  fail "Remote deploy script is not executable. Run: chmod +x $REMOTE_APP_DIR/deploy.sh"
fi
REMOTE_CHECK
finish_step

if [ -n "$REMOTE_GIT_PULL_COMMAND" ]; then
  start_step "Updating remote code from Git"
  REMOTE_APP_DIR_QUOTED=$(shell_quote "$REMOTE_APP_DIR")
  ssh $SSH_OPTS "$SSH_TARGET" "cd $REMOTE_APP_DIR_QUOTED && $REMOTE_GIT_PULL_COMMAND"
  if [ "$VERIFY_DEPLOY_GIT_STATE" = "1" ] && ! ssh $SSH_OPTS "$SSH_TARGET" "cd $REMOTE_APP_DIR_QUOTED && git cat-file -e $(shell_quote "$LOCAL_DEPLOY_COMMIT^{commit}") && git merge-base --is-ancestor $(shell_quote "$LOCAL_DEPLOY_COMMIT") HEAD"; then
    echo "The server does not contain local deployment commit $LOCAL_DEPLOY_COMMIT." >&2
    echo "Push the current branch and run the deploy again." >&2
    exit 1
  fi
  finish_step
fi

start_step "Uploading production env file"
REMOTE_ENV_PATH=$(remote_env_path)
REMOTE_ENV_DIR=$(dirname -- "$REMOTE_ENV_PATH")
ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p $(shell_quote "$REMOTE_ENV_DIR")"
rsync -az -e "$RSYNC_SSH" "$LOCAL_ENV_FILE" "$SSH_TARGET:$REMOTE_ENV_PATH"
ssh $SSH_OPTS "$SSH_TARGET" "chmod 600 $(shell_quote "$REMOTE_ENV_PATH")"
finish_step

for LOCAL_DATA_DIR in $LOCAL_DATA_DIRS; do
  start_step "Uploading $LOCAL_DATA_DIR directory"
  rsync -az --delete --exclude .DS_Store -e "$RSYNC_SSH" "$APP_DIR/$LOCAL_DATA_DIR/" "$SSH_TARGET:$REMOTE_APP_DIR/$LOCAL_DATA_DIR/"
  finish_step
done

start_step "Uploading static build output"
rsync -az --delete --exclude .DS_Store -e "$RSYNC_SSH" "$APP_DIR/out/" "$SSH_TARGET:$REMOTE_APP_DIR/out/"
finish_step

start_step "Running remote deploy"
REMOTE_APP_DIR_QUOTED=$(shell_quote "$REMOTE_APP_DIR")
ssh $SSH_OPTS "$SSH_TARGET" "cd $REMOTE_APP_DIR_QUOTED && $REMOTE_DEPLOY_COMMAND"
finish_step

if [ -n "$PUBLIC_BASE_URL" ]; then
  start_step "Verifying public Truco route"
  TRUCO_REDIRECT_URL=$(curl -sS -o /dev/null -w '%{redirect_url}' --max-redirs 0 "$PUBLIC_BASE_URL/truco" || true)
  case "$TRUCO_REDIRECT_URL" in
    *:8080/*)
      echo "Invalid public redirect detected: $TRUCO_REDIRECT_URL" >&2
      echo "The server is still exposing the internal Nginx port." >&2
      exit 1
      ;;
  esac
  curl -fsSL "$PUBLIC_BASE_URL/truco/" | grep -q "<title>La Casita — Anotador de Truco</title>"
  curl -fsSL "$PUBLIC_BASE_URL/truco/manifest.webmanifest" | grep -q '"scope": "/truco/"'
  finish_step
fi

printf '\nProduction deploy complete.\n'
