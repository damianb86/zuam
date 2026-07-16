#!/bin/sh
set -eu

ZUAM_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TRUCO_APP_DIR=${TRUCO_APP_DIR:-"$ZUAM_DIR/../../../Documents/Truco"}
TRUCO_BUILD_COMMAND=${TRUCO_BUILD_COMMAND:-"npm run build:static"}
TRUCO_OUTPUT_DIR=${TRUCO_OUTPUT_DIR:-"$TRUCO_APP_DIR/static-dist"}
TRUCO_DEST_DIR=${TRUCO_DEST_DIR:-"$ZUAM_DIR/static-apps/truco"}

if [ ! -f "$TRUCO_APP_DIR/package.json" ]; then
  echo "Missing Truco project: $TRUCO_APP_DIR" >&2
  echo "Set TRUCO_APP_DIR=/absolute/path/to/Truco and retry." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Missing required command: npm" >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "Missing required command: rsync" >&2
  exit 1
fi

echo "Building La Casita from $TRUCO_APP_DIR"
(cd "$TRUCO_APP_DIR" && sh -c "$TRUCO_BUILD_COMMAND")

if [ ! -f "$TRUCO_OUTPUT_DIR/index.html" ]; then
  echo "Truco build did not create $TRUCO_OUTPUT_DIR/index.html" >&2
  exit 1
fi

mkdir -p "$TRUCO_DEST_DIR"
rsync -a --delete --exclude .DS_Store "$TRUCO_OUTPUT_DIR/" "$TRUCO_DEST_DIR/"

echo "La Casita static bundle refreshed in $TRUCO_DEST_DIR"
