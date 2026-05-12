#!/usr/bin/env bash
set -euo pipefail

SIMULATOR_ID="${1:-1F97591A-8659-4DB9-A665-A1CCA75D8603}"
BUNDLE_ID="com.courseintellect.student"
STAGE_DIR="/tmp/CourseIntellectRunnerBuild"
APP_NAME="Runner.app"

echo "→ Building iOS (no codesign)..."
flutter build ios --simulator --no-codesign

echo "→ Staging bundle outside iCloud at $STAGE_DIR..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
ditto --noextattr --noqtn "build/ios/iphonesimulator/$APP_NAME" "$STAGE_DIR/$APP_NAME"

echo "→ Stripping residual xattrs..."
find "$STAGE_DIR/$APP_NAME" -exec xattr -c {} + 2>/dev/null || true

echo "→ Ad-hoc codesigning..."
codesign --force --sign - --timestamp=none "$STAGE_DIR/$APP_NAME"

echo "→ Booting simulator (if needed)..."
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
open -a Simulator

echo "→ Installing..."
xcrun simctl install "$SIMULATOR_ID" "$STAGE_DIR/$APP_NAME"

echo "→ Launching..."
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID"

echo "✓ Done."
