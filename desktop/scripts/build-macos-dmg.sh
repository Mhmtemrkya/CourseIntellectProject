#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$DESKTOP_DIR"

npm ci

# Dağıtılacak DMG hiçbir koşulda imzasız üretilmesin. Bu betik de tek ve
# doğrulamalı üretim hattını kullanır.
bash scripts/build-macos-signed.sh
