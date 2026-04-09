# iOS Signing Guide

This project is prepared for release, but iOS signing still requires an Apple Developer account in Xcode.

## Required Values

- Bundle Identifier: `com.courseintellect.student`
- Display Name: `CourseIntellect`

## Xcode Steps

1. Open:
   - `ios/Runner.xcworkspace`
2. Select:
   - `Runner` target
3. In `Signing & Capabilities`:
   - choose your Apple Developer Team
   - enable `Automatically manage signing`
   - confirm Bundle Identifier is `com.courseintellect.student`
4. Create or select:
   - iOS Distribution certificate
   - App Store provisioning profile
5. Build archive:
   - `Product > Archive`

## Flutter CLI Alternative

After signing is configured in Xcode:

```bash
../scripts/build_ios_release.sh https://api.example.com
```

## Quick Diagnostic

If CLI build still says `No Account for Team` or `No profiles were found`, run:

```bash
../scripts/check_ios_signing.sh
```

If `0 valid identities found` appears, Xcode account/certificate state is still incomplete.

## Notes

- Production build should use only HTTPS backend URLs
- Demo autofill is disabled in production env
- ATS arbitrary loads were removed from `Info.plist`
