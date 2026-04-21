#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/examples/sampleImages"
PREVIEW_DIR="$SOURCE_DIR/previews"
MAX_EDGE=220

mkdir -p "$PREVIEW_DIR"

find "$PREVIEW_DIR" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
  -delete

find "$SOURCE_DIR" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
  -print0 | while IFS= read -r -d '' source; do
  filename="$(basename "$source")"
  target="$PREVIEW_DIR/$filename"

  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -loglevel error -y -i "$source" \
      -vf "scale='if(gt(iw,ih),$MAX_EDGE,-1)':'if(gt(iw,ih),-1,$MAX_EDGE)'" \
      -frames:v 1 \
      "$target"
  else
    sips -Z "$MAX_EDGE" "$source" --out "$target" >/dev/null
  fi
done
