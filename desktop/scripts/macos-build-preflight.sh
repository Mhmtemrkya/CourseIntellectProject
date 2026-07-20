#!/usr/bin/env bash
# macOS'ta Tauri derlemesini bozan iki ortam kalıntısını derleme öncesi temizler.
# İkisi de "kod doğru ama build patlıyor" sınıfından olduğu için hatayı kaynakta
# aramak zaman kaybettiriyor; bu yüzden otomatik hâle getirildi.
#
# 1) com.apple.provenance özniteliği (proc-macro .dylib'leri)
#    macOS bu öznitelikli kitaplıkların rustc tarafından yüklenmesini bir süre
#    sonra reddediyor ve derleme şu yanıltıcı hatayla düşüyor:
#
#      error: .../libserde_derive-<hash>.dylib: dlopen(...): code signature ...
#             not valid for use in process: library load denied by system policy
#      error[E0463]: can't find crate for `tauri`
#
#    İmza aslında geçerlidir (codesign -v "valid on disk" der); engelleyen
#    özniteliktir. "can't find crate" hataları SONUÇTUR: proc-macro yüklenemeyince
#    ona bağlı crate'ler çözülemez.
#
# 2) Bağlı kalmış DMG diskleri
#    bundle_dmg.sh, ikon yerleşimini Finder'a AppleScript ile yaptırmak için
#    DMG'yi /Volumes/dmg.XXXXXX altına geçici olarak bağlar. Başarılı derlemeler
#    bile bu diski bazen ayırmadan bitiyor (sızıntı ölçüldü). Biriken diskler ve
#    elle açılıp çıkarılmamış /Volumes/<ProductName> sonraki derlemede Finder
#    adımını düşürüyor:
#
#      Error failed to bundle project error running bundle_dmg.sh
#
#    Hata KESİNTİLİDİR: bundle_dmg.sh'ın kendisi de bu yarışı biliyor ve
#    "Can't get disk (-1728)" için 2 sn bekliyor; her zaman yetmiyor. Bu yüzden
#    derleme öncesi ortamı temizlemek başarısızlık olasılığını belirgin düşürür.
#
# Script hiçbir koşulda derlemeyi düşürmez (exit 0) ve yalnızca derleme
# çıktılarına / kendi ürettiği diske dokunur.

set -u

[ "$(uname -s)" = "Darwin" ] || exit 0

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── 1) provenance temizliği ─────────────────────────────────────────────────
if command -v xattr >/dev/null 2>&1; then
  cleared=0
  for profile in debug release; do
    deps="$root/src-tauri/target/$profile/deps"
    [ -d "$deps" ] || continue
    for lib in "$deps"/*.dylib; do
      [ -e "$lib" ] || continue
      if [ -n "$(xattr "$lib" 2>/dev/null)" ]; then
        xattr -c "$lib" 2>/dev/null && cleared=$((cleared + 1))
      fi
    done
  done
  [ "$cleared" -gt 0 ] && echo "preflight: provenance özniteliği temizlendi ($cleared kitaplık)"
fi

# ── 2) bağlı kalmış DMG disklerini ayır ─────────────────────────────────────
if command -v hdiutil >/dev/null 2>&1; then
  # Ürün adı tauri.conf.json'dan okunur; yeniden adlandırmada script bozulmasın.
  conf="$root/src-tauri/tauri.conf.json"
  product=""
  [ -f "$conf" ] && product="$(sed -n 's/.*"productName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$conf" | head -1)"

  # Yalnızca disk imajı olarak bağlanmış birimleri topluyoruz; aynı adlı gerçek
  # bir diske (harici disk, ağ birimi) asla dokunmayalım diye hdiutil'e soruyoruz.
  mounted="$(hdiutil info 2>/dev/null | sed -n 's|^/dev/disk[^[:space:]]*[[:space:]].*[[:space:]]\(/Volumes/.*\)$|\1|p')"

  while IFS= read -r volume; do
    [ -n "$volume" ] || continue
    name="$(basename "$volume")"
    # bundle_dmg.sh'ın geçici bağlama noktası (dmg.XXXXXX) veya ürünün kendi DMG'si.
    case "$name" in
      dmg.*) ;;
      *) [ -n "$product" ] && [ "$name" = "$product" ] || continue ;;
    esac

    if hdiutil detach "$volume" -quiet 2>/dev/null; then
      echo "preflight: bağlı kalmış '$name' diski ayrıldı"
    else
      echo "preflight UYARI: '$volume' ayrılamadı (bir dosya açık olabilir)." >&2
      echo "preflight UYARI: Finder'dan çıkarıp derlemeyi tekrarlayın." >&2
    fi
  done <<< "$mounted"
fi

exit 0
