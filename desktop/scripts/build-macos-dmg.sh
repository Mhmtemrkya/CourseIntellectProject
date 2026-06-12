#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$DESKTOP_DIR"

swift scripts/generate-dmg-background.swift
npm ci
npm exec -- tauri build

echo "DMG output: src-tauri/target/release/bundle/dmg/"
