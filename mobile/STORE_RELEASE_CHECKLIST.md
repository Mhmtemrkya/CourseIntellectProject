# Store Release Checklist

## Flutter Build Environments

Use `dart-define` with one of these values:

- `COURSE_INTELLECT_ENV=development`
- `COURSE_INTELLECT_ENV=staging`
- `COURSE_INTELLECT_ENV=production`

Required API variables:

- development:
  - optional `COURSE_INTELLECT_API_URL`
  - optional `COURSE_INTELLECT_LAN_API_URL`
- staging:
  - required `COURSE_INTELLECT_STAGING_API_URL`
- production:
  - required `COURSE_INTELLECT_PROD_API_URL`

Examples:

```bash
flutter run \
  --dart-define=COURSE_INTELLECT_ENV=development \
  --dart-define=COURSE_INTELLECT_API_URL=http://10.0.2.2:5199
```

```bash
flutter build appbundle \
  --dart-define=COURSE_INTELLECT_ENV=production \
  --dart-define=COURSE_INTELLECT_PROD_API_URL=https://api.example.com \
  --build-name=1.0.0 \
  --build-number=1
```

```bash
flutter build ipa \
  --dart-define=COURSE_INTELLECT_ENV=production \
  --dart-define=COURSE_INTELLECT_PROD_API_URL=https://api.example.com \
  --build-name=1.0.0 \
  --build-number=1
```

## Release Rules

- Production build must use `https`
- Production API URL is now rejected at runtime if it is empty or not `https`
- Production build must not use `localhost`, `127.0.0.1`, `10.0.2.2`
- Demo autofill must stay disabled in production
- Test/demo accounts must not be shown in release screenshots
- Backend CORS must only allow real app/web origins in production
- Production JWT/database secrets must not be stored in source
- Public privacy policy URL and support contact must be ready for Play Console and App Store Connect
- Account deletion/request flow or support route must be documented in store metadata
- App Store Connect privacy answers must declare collected account, contact, user content, identifiers, diagnostics, purchase/financial and usage data as applicable
- Play Console Data safety form must match the KVKK/privacy policy and the app's actual backend/Firebase collection

## Quick Preflight

- `flutter analyze`
- `flutter test` if test suite exists
- Android release signing configured
- Android upload artifact is `build/app/outputs/bundle/release/app-release.aab`
- iOS signing and capabilities configured
- Production backend reachable over HTTPS
- Firebase Android `android/app/google-services.json` and iOS `ios/Runner/GoogleService-Info.plist` added if remote push is part of the store release
- Login, logout, push-critical flows, upload flows smoke-tested on real device

## Files Added For Release

- Android signing template:
  - `android/key.properties.example`
- iOS signing notes:
  - `IOS_SIGNING_GUIDE.md`
- iOS privacy manifest:
  - `ios/Runner/PrivacyInfo.xcprivacy`

## Android Notes

- Package name set to `com.courseintellect.student`
- App label set to `CourseIntellect`
- Release build requires `key.properties`; it no longer falls back to debug signing
- Debug build keeps cleartext for local development
- Release build disables cleartext traffic
- Play Store target SDK is pinned to API 36, which satisfies the Android 15 / API 35-or-higher requirement
- Play upload should use AAB, not APK

## iOS Notes

- Bundle identifier set to `com.courseintellect.student`
- Display name set to `CourseIntellect`
- Arbitrary loads removed from ATS
- Push entitlement is set to production
- Privacy manifest includes the UserDefaults required-reason API declaration
- App Store Connect still requires a public privacy policy URL and privacy nutrition label answers
