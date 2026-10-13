#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_PATH="$PROJECT_ROOT/mobile/build/ios/archive/Runner.xcarchive"
BUILD_NUMBER="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$ARCHIVE_PATH/Info.plist")"
BUILD_STARTED="$(date +%s)"
EXPORT_OPTIONS="$(python3 "$PROJECT_ROOT/scripts/prepare_ios_export_options.py")"
# Let Xcode download/create the automatic signing assets for the existing team.
# Export only: do not upload the archive or the IPA to App Store Connect.
xcrun xcodebuild -exportArchive -allowProvisioningUpdates \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$PROJECT_ROOT/mobile/build/ios/ipa"
python3 "$PROJECT_ROOT/scripts/verify_ios_ipa.py" "$BUILD_NUMBER" "$BUILD_STARTED"
