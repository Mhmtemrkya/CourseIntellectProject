# macOS (.dmg) üretimi

Bu proje Tauri v2 kullanıyor. `.dmg` üretmek için derleme işlemi **macOS üzerinde** yapılmalıdır (Windows'ta DMG üretilemez).

## Gereksinimler (Mac)

- Xcode Command Line Tools: `xcode-select --install`
- Node.js (LTS)
- Rust (stable): `rustup` ile

## Dağıtılabilir DMG üretme

Apple Developer ID ve notarization ortam değişkenlerini `MACOS_SIGNING.md`
dosyasındaki gibi ayarladıktan sonra `desktop` klasöründe:

```bash
npm run desktop:build:signed
```

DMG çıktısı:

- `src-tauri/target/release/bundle/dmg/*.dmg`

Betik Developer ID imzası, Apple noter bileti, stapling, Gatekeeper ve DMG
bütünlüğü kontrollerini otomatik çalıştırır. Bunlardan biri başarısızsa DMG
dağıtıma hazır kabul edilmez.

## Kurulum

GitHub Release içindeki doğrulanmış DMG'yi açıp uygulamayı `Applications`
klasörüne sürükleyin. Normal kurulumda Terminal komutu, `xattr` veya
**Open Anyway** gerekmemelidir.

Repo kökünde daha önce tutulan `CourseIntellect-macOS*.dmg` dosyaları imzasız
olduğu için dağıtılmamalıdır. Yeni paketler yalnız GitHub Releases üzerinden
yayınlanır.

## Görseller / Ayarlar

- DMG arkaplanı: `src-tauri/installer/dmg-background.png`
- DMG arkaplan kaynağı: `src-tauri/installer/dmg-background-base.png`
- Arkaplan üreticisi: `scripts/generate-dmg-background.swift`
- macOS override config: `src-tauri/tauri.macos.conf.json`
