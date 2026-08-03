#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ENV_FILE=${APP_ENV_FILE:-"$APP_DIR/.env"}
APP_DISPLAY_NAME=${APP_DISPLAY_NAME:-"Zuam"}
VERIFY_ENV_VARS=${VERIFY_ENV_VARS:-"NODE_ENV OPENAI_CHAT_MODEL OPENAI_CHAT_REASONING_EFFORT OPENAI_CHAT_VERBOSITY CONTACT_DELIVERY_METHOD CHAT_CONTACT_EMAIL_ENABLED CONTACT_EMAIL CONTACT_EMAIL_TO RESEND_FROM EMAIL_HOST"}
SKIP_GIT_PULL=${SKIP_GIT_PULL:-0}
RESTART_AFTER_PULL=${RESTART_AFTER_PULL:-1}

resolve_file() {
  FILE=$1
  if [ -f "$FILE" ]; then
    FILE_DIR=$(CDPATH= cd -- "$(dirname -- "$FILE")" && pwd)
    printf '%s/%s\n' "$FILE_DIR" "$(basename -- "$FILE")"
  else
    printf '%s\n' "$FILE"
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
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

require_env_value() {
  FILE=$1
  NAME=$2
  VALUE=$(get_env_value "$FILE" "$NAME")

  if [ -z "$VALUE" ]; then
    echo "Missing required $NAME in $FILE" >&2
    exit 1
  fi
}

pull_latest_code() {
  if [ "$SKIP_GIT_PULL" = "1" ]; then
    echo "Skipping git pull because SKIP_GIT_PULL=1."
    return 0
  fi

  if ! command_exists git; then
    echo "Missing git. Install git or run with SKIP_GIT_PULL=1." >&2
    exit 1
  fi

  if [ ! -d "$APP_DIR/.git" ]; then
    echo "This folder is not a Git checkout, so deploy cannot pull updates." >&2
    echo "Clone the repository on the server, for example:" >&2
    echo "  git clone https://github.com/damianb86/zuam.git" >&2
    echo "Or run once with SKIP_GIT_PULL=1 to deploy the current files." >&2
    exit 1
  fi

  cd "$APP_DIR"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Tracked local changes detected. Commit, stash, or remove them before deploy." >&2
    git status --short >&2
    exit 1
  fi

  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [ "$BRANCH" = "HEAD" ]; then
    echo "The repository is in detached HEAD state. Check out a branch before deploy." >&2
    exit 1
  fi

  BEFORE=$(git rev-parse HEAD)

  echo "Pulling latest code from origin/$BRANCH..."
  git fetch origin "$BRANCH"
  git pull --ff-only origin "$BRANCH"

  AFTER=$(git rev-parse HEAD)
  if [ "$BEFORE" != "$AFTER" ] && [ "$RESTART_AFTER_PULL" = "1" ] && [ "${ZUAM_DEPLOY_REEXECED:-0}" != "1" ]; then
    echo "Code changed from $BEFORE to $AFTER. Restarting deploy script from the updated checkout..."
    ZUAM_DEPLOY_REEXECED=1 exec "$0" "$@"
  fi
}

find_shared_env_file() {
  SEARCH_DIR="$APP_DIR"
  while [ "$SEARCH_DIR" != "/" ]; do
    for CANDIDATE in \
      "$SEARCH_DIR/shared-docker/.env" \
      "$SEARCH_DIR/../shared-docker/.env"
    do
      if [ -f "$CANDIDATE" ]; then
        resolve_file "$CANDIDATE"
        return 0
      fi
    done

    SEARCH_DIR=$(dirname -- "$SEARCH_DIR")
  done

  return 1
}

# El bot de WhatsApp vive en un override aparte. Hay que incluirlo si esta
# habilitado, porque el `up` de mas abajo usa --remove-orphans: sin esto, cada
# deploy de Zuam borraria el contenedor del bot y habria que re-escanear el QR.
compose_files() {
  echo "-f docker-compose.yml"
  if [ "$(get_env_value "$APP_ENV_FILE" WA_ENABLED)" = "1" ] && [ -f "$APP_DIR/docker-compose.wa.yml" ]; then
    echo "-f docker-compose.wa.yml"
  fi
}

compose() {
  # shellcheck disable=SC2046  # se quiere el split en palabras de los -f
  docker compose \
    $(compose_files) \
    --env-file "$SHARED_ENV_FILE" \
    --env-file "$APP_ENV_FILE" \
    "$@"
}

pull_latest_code "$@"

APP_ENV_FILE=$(resolve_file "$APP_ENV_FILE")

if [ -n "${SHARED_ENV_FILE:-}" ]; then
  SHARED_ENV_FILE=$(resolve_file "$SHARED_ENV_FILE")
else
  SHARED_ENV_FILE=$(find_shared_env_file || true)
fi

if [ -z "${SHARED_ENV_FILE:-}" ] || [ ! -f "$SHARED_ENV_FILE" ]; then
  echo "Missing shared env file." >&2
  echo "Expected a shared-docker/.env file next to the app folders." >&2
  echo "Or pass an explicit path:" >&2
  echo "  SHARED_ENV_FILE=/absolute/path/to/shared-docker/.env ./deploy.sh" >&2
  exit 1
fi

if [ ! -f "$APP_ENV_FILE" ]; then
  echo "Missing app env file: $APP_ENV_FILE" >&2
  echo "Create it from the template and fill the real values:" >&2
  echo "  cp .env.example .env" >&2
  exit 1
fi

if ! command_exists docker; then
  echo "Missing docker. Install Docker Engine and the Docker Compose plugin first." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Missing Docker Compose plugin. The command 'docker compose' must work." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not reachable. Start Docker or fix Docker permissions for this user." >&2
  exit 1
fi

require_env_value "$APP_ENV_FILE" "COMPOSE_PROJECT_NAME"
require_env_value "$APP_ENV_FILE" "APP_HOST"
require_env_value "$APP_ENV_FILE" "OPENAI_API_KEY"

CONTACT_WEBHOOK_URL_VALUE=$(get_env_value "$APP_ENV_FILE" "CONTACT_WEBHOOK_URL")
RESEND_API_KEY_VALUE=$(get_env_value "$APP_ENV_FILE" "RESEND_API_KEY")
EMAIL_HOST_VALUE=$(get_env_value "$APP_ENV_FILE" "EMAIL_HOST")
EMAIL_USER_VALUE=$(get_env_value "$APP_ENV_FILE" "EMAIL_USER")
EMAIL_PASS_VALUE=$(get_env_value "$APP_ENV_FILE" "EMAIL_PASS")

if [ -z "$RESEND_API_KEY_VALUE" ] && [ -z "$CONTACT_WEBHOOK_URL_VALUE" ] && { [ -z "$EMAIL_HOST_VALUE" ] || [ -z "$EMAIL_USER_VALUE" ] || [ -z "$EMAIL_PASS_VALUE" ]; }; then
  echo "Warning: contact delivery is not fully configured." >&2
  echo "Set RESEND_API_KEY, CONTACT_WEBHOOK_URL, or EMAIL_HOST, EMAIL_USER, and EMAIL_PASS for SMTP." >&2
fi

NETWORK_NAME=$(get_env_value "$APP_ENV_FILE" "SHARED_DOCKER_NETWORK")
if [ -z "$NETWORK_NAME" ]; then
  NETWORK_NAME=$(get_env_value "$SHARED_ENV_FILE" "SHARED_DOCKER_NETWORK")
fi
NETWORK_NAME=${NETWORK_NAME:-shared_apps}

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  echo "Missing Docker network: $NETWORK_NAME" >&2
  echo "Start shared-docker first, or create the shared network with:" >&2
  echo "  docker network create $NETWORK_NAME" >&2
  exit 1
fi

cd "$APP_DIR"

STATIC_DOCKERFILE_VALUE=${STATIC_DOCKERFILE:-Dockerfile.static}
if [ "$STATIC_DOCKERFILE_VALUE" = "Dockerfile.static-prebuilt" ] && [ ! -d "$APP_DIR/out" ]; then
  echo "Missing static export directory: $APP_DIR/out" >&2
  echo "Dockerfile.static-prebuilt expects an existing Next static export." >&2
  echo "Run 'npm run build' before deploy, or use STATIC_DOCKERFILE=Dockerfile.static to build inside Docker." >&2
  exit 1
fi

if [ "$STATIC_DOCKERFILE_VALUE" = "Dockerfile.static-prebuilt" ] && [ ! -f "$APP_DIR/out/truco/index.html" ]; then
  echo "Missing compiled Truco application: $APP_DIR/out/truco/index.html" >&2
  echo "Run deploy-production.local.sh so both static applications are assembled before upload." >&2
  exit 1
fi

echo "Deploying $APP_DISPLAY_NAME"
echo "  app env:    $APP_ENV_FILE"
echo "  shared env: $SHARED_ENV_FILE"
echo "  network:    $NETWORK_NAME"
echo "  static df:  $STATIC_DOCKERFILE_VALUE"
echo
echo "Validating docker-compose.yml with both env files..."
compose config >/dev/null

echo "Building and starting containers..."
compose up -d --build --remove-orphans

echo "Waiting for API health check..."
HEALTH_OK=0
for ATTEMPT in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T api node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi

  sleep 2
done

if [ "$HEALTH_OK" != "1" ]; then
  echo "API health check failed. Recent api logs:" >&2
  compose logs --tail=80 api >&2
  exit 1
fi

if [ -n "$VERIFY_ENV_VARS" ]; then
  for ENV_VAR in $VERIFY_ENV_VARS; do
    VALUE=$(compose exec -T api printenv "$ENV_VAR" 2>/dev/null || true)
    if [ -n "$VALUE" ]; then
      echo "$ENV_VAR inside api container: $VALUE"
    else
      echo "Warning: could not read $ENV_VAR from the api container." >&2
    fi
  done
fi

compose ps
echo "Deploy complete."
