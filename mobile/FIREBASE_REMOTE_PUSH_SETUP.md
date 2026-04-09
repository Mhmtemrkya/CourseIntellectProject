# Firebase Remote Push Kurulumu

Kod tarafi hazir. Uygulama tamamen kapaliyken uzaktan push icin su dosya ve ayarlar gereklidir:

## Android

- Firebase Console'dan Android uygulamasini ekle
- `google-services.json` dosyasini indir
- su konuma koy:

`mobile/android/app/google-services.json`

## iOS

- Firebase Console'dan iOS uygulamasini ekle
- `GoogleService-Info.plist` dosyasini indir
- su konuma koy:

`mobile/ios/Runner/GoogleService-Info.plist`

- Apple Developer tarafinda:
  - Push Notifications capability
  - Background Modes > Remote notifications
  - APNs anahtari veya sertifikasi

## Backend

`backend/CourseIntellect.Api/appsettings.Development.json` icindeki:

`Firebase:ServerKey`

alanina gecerli Firebase Cloud Messaging anahtarini gir.

## Not

Bu dosyalar eklenmeden:

- uygulama acikken veya yeniden one geldiginde yerel/native banner calisabilir
- fakat uygulama tamamen kapaliyken gercek remote push garanti calismaz
