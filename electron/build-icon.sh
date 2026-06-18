#!/bin/bash
set -e

LOGO_SRC="/Users/saiyashpoojari/.gemini/antigravity-ide/brain/9e0d17f0-4bd6-4f2f-861d-8d1dcc57631a/spatial_x_8d_logo_1781725760041.png"
ICONSET_DIR="icon.iconset"

mkdir -p "$ICONSET_DIR"

sips -s format png -z 16 16     "$LOGO_SRC" --out "$ICONSET_DIR/icon_16x16.png"
sips -s format png -z 32 32     "$LOGO_SRC" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -s format png -z 32 32     "$LOGO_SRC" --out "$ICONSET_DIR/icon_32x32.png"
sips -s format png -z 64 64     "$LOGO_SRC" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -s format png -z 128 128   "$LOGO_SRC" --out "$ICONSET_DIR/icon_128x128.png"
sips -s format png -z 256 256   "$LOGO_SRC" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -s format png -z 256 256   "$LOGO_SRC" --out "$ICONSET_DIR/icon_256x256.png"
sips -s format png -z 512 512   "$LOGO_SRC" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -s format png -z 512 512   "$LOGO_SRC" --out "$ICONSET_DIR/icon_512x512.png"
sips -s format png -z 1024 1024 "$LOGO_SRC" --out "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o icon.icns
rm -rf "$ICONSET_DIR"
echo "Icon generated successfully."
