#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
WORKSPACE="$MOBILE_DIR/ios/Runner.xcworkspace"
SCHEME="Runner"
APP_BUNDLE_ID="com.courseintellect.student"

open "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app"

DEVICE_ID="${IOS_SIMULATOR_ID:-}"

if [[ -z "$DEVICE_ID" ]]; then
  DEVICE_ID="$(xcrun simctl list devices available | perl -0ne '
    my @blocks = split(/-- /, $_);
    my $selected = q();

    for my $block (@blocks) {
      next unless $block =~ /^iOS ([0-9.]+) --\n(.*)$/ms;
      my ($runtime, $devices) = ($1, $2);
      next unless $devices =~ /(iPhone [^\n]*?) \(([A-F0-9-]+)\) \((?:Shutdown|Booted)\)/i;
      my $version = join q(), map { sprintf("%04d", $_) } split(/\./, $runtime);
      my $candidate = $2;
      $selected = "$version:$candidate" if !$selected || $version gt substr($selected, 0, index($selected, q(:)));
    }

    if ($selected =~ /:([A-F0-9-]+)$/i) {
      print $1;
    }
  ')"
fi

if [[ -z "$DEVICE_ID" ]]; then
  DEVICE_ID="$(xcrun simctl list devices available | grep -m1 "iPhone" | perl -ne 'if (/\(([A-F0-9-]+)\)/i) { print $1; exit }')"
fi

if [[ -z "$DEVICE_ID" ]]; then
  echo "No available iOS simulator device found."
  exit 1
fi

xcrun simctl boot "$DEVICE_ID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$DEVICE_ID" -b

cd "$MOBILE_DIR"

flutter pub get

xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build

APP_PATH="$(find "$HOME/Library/Developer/Xcode/DerivedData" \
  -path "*Build/Products/Debug-iphonesimulator/Runner.app" \
  ! -path "*Index.noindex*" \
  -print | head -n 1)"

if [[ -z "$APP_PATH" ]]; then
  echo "Built app bundle not found."
  exit 1
fi

xcrun simctl install "$DEVICE_ID" "$APP_PATH"
xcrun simctl launch "$DEVICE_ID" "$APP_BUNDLE_ID"

echo "Mobile app launched on simulator: $DEVICE_ID"
