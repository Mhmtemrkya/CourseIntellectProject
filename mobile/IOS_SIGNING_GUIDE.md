# SchoolAsist iOS / TestFlight

Bundle ID: `com.schoolasist.app`; Apple Team: `RM53R2ZT6Q`; minimum iOS: 15.0.
Developer ID signs the desktop DMG, not TestFlight IPAs.

## Signing prerequisites

Xcode > Settings > Apple Accounts: refresh the existing account's session and
select team `RM53R2ZT6Q`. Manage Certificates needs an **Apple Distribution**
certificate with its private key. Also obtain an **iOS App Store Connect**
provisioning profile for `com.schoolasist.app` with Push Notifications enabled.
Automatic signing can download this when the account is usable.

Open `ios/Runner.xcworkspace`; Runner > Signing & Capabilities must use that team
and automatic signing. Archive/debug push entitlement can be `development`; the
exported distribution IPA must have `aps-environment=production`. The verifier
checks the final IPA.

From the repository root:

```bash
bash scripts/check_ios_signing.sh
bash scripts/build_ios_release.sh 2
```

Choose a build number not already uploaded to App Store Connect. Build `2` was
only archived locally on 2026-10-04; its availability in App Store Connect is
unverified. The script explicitly builds `lib/main.dart` with production HTTPS
configuration and rejects missing/stale IPAs, wrong bundle/team, development
signing, a missing manifest and a non-production APNs entitlement.

## Existing archive

`build/ios/archive/Runner.xcarchive` was built as `0.1.0 (2)`. Initial exports failed
with missing distribution assets. After the user created Apple Distribution,
Xcode Organizer obtained the App Store profile and exported the signed IPA.
CLI export then also succeeded using the local Xcode-managed profile.

Verified package: `../outputs/app-store/SchoolAsist-iOS-0.1.0-2/SchoolAsist.ipa`.
Its Apple Distribution signature, store profile, bundle/team, production APNs,
disabled debug access and privacy manifest were checked. It was not uploaded.

To export the archive again without rebuilding:

```bash
bash scripts/export_ios_testflight.sh
```

The verified IPA will be under `build/ios/ipa/`. These scripts do not upload.
`prepare_ios_export_options.py` can select a matching local manually managed
distribution profile; Xcode-managed profiles retain automatic signing. Version
and build number are preserved during export.
See `../docs/apple-store-preparation-2026-10-04.md` for submission gaps and Mac
packaging. Deploy the matching backend legal consent version before testing
production consent synchronization. Test production push and background GPS on
a real iPhone; an archive does not prove either works.
