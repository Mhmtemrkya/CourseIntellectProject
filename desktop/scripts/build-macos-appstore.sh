#!/usr/bin/env bash
set -euo pipefail
DESKTOP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DESKTOP_ROOT"
BUILD_NUMBER="${1:-}"
if [[ ! "$BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "Kullanım: npm run desktop:build:appstore -- <App Store Connect'te kullanılmamış build numarası>" >&2
  exit 2
fi
python3 scripts/prepare-macos-appstore.py
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
for TARGET in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -qx "$TARGET"; then
    echo "Eksik Rust hedefi: rustup target add $TARGET" >&2
    exit 1
  fi
done

# Store signing uses a separate channel and never Developer ID notarization.
# Do not source the DMG signing.env.local file or pass its notarization secrets.
unset APPLE_ID APPLE_PASSWORD APPLE_API_KEY APPLE_API_KEY_PATH APPLE_API_ISSUER
export APPLE_SIGNING_IDENTITY="$MAS_SIGNING_IDENTITY"
export REACT_APP_COURSE_INTELLECT_ENV=production
export REACT_APP_DISTRIBUTION_CHANNEL=mac-app-store
python3 - "$BUILD_NUMBER" <<'PY'
import json, pathlib, sys
pathlib.Path('src-tauri/.appstore/build.conf.json').write_text(json.dumps({
    'bundle': {'macOS': {'bundleVersion': sys.argv[1]}}
}))
PY
node node_modules/@tauri-apps/cli/tauri.js build \
  --target universal-apple-darwin --bundles app \
  --config src-tauri/tauri.appstore.conf.json \
  --config src-tauri/.appstore/build.conf.json -- --no-default-features
APP_PATH="${CARGO_TARGET_DIR:-$DESKTOP_ROOT/src-tauri/target}/universal-apple-darwin/release/bundle/macos/SchoolAsist.app"
codesign --verify --deep --strict "$APP_PATH"
python3 - "$APP_PATH" <<'PY'
import pathlib, plistlib, subprocess, sys
app = pathlib.Path(sys.argv[1])
entitlements = plistlib.loads(subprocess.run(
    ['codesign', '-d', '--entitlements', ':-', str(app)],
    capture_output=True, check=True).stdout)
checks = [
    (entitlements.get('com.apple.security.app-sandbox'), 'App Sandbox eksik'),
    (entitlements.get('com.apple.developer.team-identifier') == 'RM53R2ZT6Q', 'Yanlış ekip'),
    ((app / 'Contents/embedded.provisionprofile').is_file(), 'Provisioning profili eksik'),
    ((app / 'Contents/Resources/PrivacyInfo.xcprivacy').is_file(), 'Gizlilik manifesti eksik'),
]
for valid, message in checks:
    if not valid:
        sys.exit('HATA: ' + message)
PY
mkdir -p dist/appstore
PKG_PATH="$DESKTOP_ROOT/dist/appstore/SchoolAsist-$BUILD_NUMBER.pkg"
xcrun productbuild --sign "$MAS_INSTALLER_IDENTITY" --component "$APP_PATH" /Applications "$PKG_PATH"
pkgutil --check-signature "$PKG_PATH"
echo "Mac App Store paketi hazır: $PKG_PATH"
