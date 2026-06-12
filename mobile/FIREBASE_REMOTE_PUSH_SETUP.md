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

Backend artik FCM HTTP v1 kullanir. Firebase Console > Project settings > Service accounts ekranindan service account JSON indirilir ve sunucuya gizli olarak verilir.

Onerilen prod ayari:

`COURSE_INTELLECT_FCM_SERVICE_ACCOUNT_BASE64`

Bu deger service account JSON dosyasinin base64 halidir. Alternatifler:

- `COURSE_INTELLECT_FCM_SERVICE_ACCOUNT_JSON`: JSON icerigi direkt verilir.
- `COURSE_INTELLECT_FCM_SERVICE_ACCOUNT_PATH`: Sunucudaki JSON dosya yolu verilir.
- `COURSE_INTELLECT_FCM_PROJECT_ID`: Gerekirse JSON icindeki `project_id` uzerine yazar.

Backend bu ayarlar yoksa hata vermez; uygulama ici bildirim ve SignalR devam eder, sadece gercek remote push atlanir.

Veritabani icin migration uygulanmali:

`20260605162000_AddPushDeviceRegistrations`

## Not

Bu dosyalar eklenmeden:

- uygulama ici bildirim ve SignalR calisir
- fakat uygulama tamamen kapaliyken gercek remote push garanti calismaz
