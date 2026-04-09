# macOS (.dmg) üretimi

Bu proje Tauri v2 kullanıyor. `.dmg` üretmek için derleme işlemi **macOS üzerinde** yapılmalıdır (Windows'ta DMG üretilemez).

## Gereksinimler (Mac)

- Xcode Command Line Tools: `xcode-select --install`
- Node.js (LTS)
- Rust (stable): `rustup` ile

## DMG üretme

Proje kökünde:

```bash
npm ci
npm exec -- tauri build
```

DMG çıktısı:

- `src-tauri/target/release/bundle/dmg/*.dmg`

## Kurulum (arkadaşın için)

DMG'yi açıp uygulamayı `Applications` klasörüne sürükle.

Gatekeeper uyarısı gelirse:

- Uygulamaya sağ tık → **Open**
  veya
- `System Settings -> Privacy & Security` ekranından **Open Anyway**

## Görseller / Ayarlar

- DMG arkaplanı: `src-tauri/installer/dmg-background.png`
- macOS override config: `src-tauri/tauri.macos.conf.json`
