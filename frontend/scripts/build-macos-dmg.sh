#!/usr/bin/env bash
set -euo pipefail

npm ci
npm exec -- tauri build

echo "DMG output: src-tauri/target/release/bundle/dmg/"

