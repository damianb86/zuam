#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TRUCO_SOURCE="$APP_DIR/static-apps/truco"
TRUCO_DEST="$APP_DIR/out/truco"

if [ ! -f "$TRUCO_SOURCE/index.html" ]; then
  echo "Missing compiled Truco app: $TRUCO_SOURCE/index.html" >&2
  echo "Run npm run build:truco before building Zuam." >&2
  exit 1
fi

mkdir -p "$TRUCO_DEST"
cp -R "$TRUCO_SOURCE/." "$TRUCO_DEST/"

if [ ! -f "$TRUCO_DEST/manifest.webmanifest" ] || [ ! -f "$TRUCO_DEST/sw.js" ]; then
  echo "The assembled Truco PWA is incomplete." >&2
  exit 1
fi

echo "La Casita assembled at out/truco/"
