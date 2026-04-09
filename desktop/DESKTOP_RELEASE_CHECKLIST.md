# Desktop Release Checklist

## Production Config

- `REACT_APP_COURSE_INTELLECT_ENV=production`
- `REACT_APP_COURSE_INTELLECT_API_URL=https://your-api-domain`
- production buildde demo hesap kartlari gorunmez
- production buildde `localhost` fallback kullanilmaz

## Backend

- `platform_configurations` tablosu backend acilisinda otomatik olusur
- production JWT ayarlari ve HTTPS aktif olmali
- CORS sadece gerekli originlere acilmali

## Desktop Build

Gelistirme:

```bash
cd /Users/oguzhanmindivanli/Desktop/denemeler/desktop
npm run desktop:dev
```

Production:

```bash
/Users/oguzhanmindivanli/Desktop/denemeler/scripts/build_desktop_release.sh https://api.example.com
```

Mac app-only fallback:

```bash
/Users/oguzhanmindivanli/Desktop/denemeler/scripts/build_desktop_app_release.sh https://api.example.com
```

Artifact:

- `/Users/oguzhanmindivanli/Desktop/denemeler/desktop/src-tauri/target/release/bundle/macos/CourseIntellect.app`

Not:

- Bu makinede `.app` release bundle dogrulandi.
- `dmg` paketleme host ortaminda `bundle_dmg.sh` asamasinda ayrica kontrol istiyor; app bundle ise basarili uretiliyor.

## Kontrol Edilecek Ekranlar

- Login
- Admin dashboard
- Teacher dashboard
- Student dashboard
- Parent dashboard
- Finance dashboard
- Superadmin:
  - Paketler
  - Limitler
  - Sistem Ayarlari
  - Kurum Ozellestirme

## Son Kontrol

- build sonrasi installer/artifact olustu mu
- login production API ile aciliyor mu
- demo/test hesap kartlari gizli mi
- superadmin kayitlari tekrar acildiginda geri yukleniyor mu
- admin / teacher / student / parent / finance / superadmin rollerinde login smoke geciyor mu
- soru, mesaj, gorev, sinif programi ve rapor indirme akislari acik mi
