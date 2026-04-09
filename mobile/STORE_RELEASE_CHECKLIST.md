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
  --dart-define=COURSE_INTELLECT_PROD_API_URL=https://api.example.com
```

```bash
flutter build ipa \
  --dart-define=COURSE_INTELLECT_ENV=production \
  --dart-define=COURSE_INTELLECT_PROD_API_URL=https://api.example.com
```

## Release Rules

- Production build must use `https`
- Production build must not use `localhost`, `127.0.0.1`, `10.0.2.2`
- Demo autofill must stay disabled in production
- Test/demo accounts must not be shown in release screenshots
- Backend CORS must only allow real app/web origins in production
- Production JWT/database secrets must not be stored in source
- Privacy policy and support contact must be ready
- Account deletion/request flow must be available if required by store policy

## Quick Preflight

- `flutter analyze`
- `flutter test` if test suite exists
- Android release signing configured
- iOS signing and capabilities configured
- Production backend reachable over HTTPS
- Login, logout, push-critical flows, upload flows smoke-tested on real device

## Files Added For Release

- Android signing template:
  - `android/key.properties.example`
- Android production build:
  - `../scripts/build_mobile_release.sh`
- iOS production build:
  - `../scripts/build_ios_release.sh`
- iOS signing notes:
  - `IOS_SIGNING_GUIDE.md`

## Android Notes

- Package name set to `com.courseintellect.student`
- App label set to `CourseIntellect`
- Release build uses `key.properties` if present
- Debug build keeps cleartext for local development
- Release build disables cleartext traffic

## iOS Notes

- Bundle identifier set to `com.courseintellect.student`
- Display name set to `CourseIntellect`
- Arbitrary loads removed from ATS
- Local networking kept for development
