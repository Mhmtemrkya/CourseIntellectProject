#!/usr/bin/env bash
# macOS, dosyalara `com.apple.provenance` genişletilmiş özniteliğini iliştirir.
# Cargo'nun ürettiği proc-macro .dylib'lerinde bu öznitelik bir süre sonra
# (XProtect/syspolicy veritabanı güncellendiğinde) rustc'nin onları yüklemesini
# engelliyor ve derleme şu yanıltıcı hatayla düşüyor:
#
#   error: .../libserde_derive-<hash>.dylib: dlopen(...): code signature ...
#          not valid for use in process: library load denied by system policy
#   error[E0463]: can't find crate for `tauri`
#
# İmza aslında geçerlidir (codesign -v "valid on disk" der); engelleyen öznitelik.
# "can't find crate" hataları bunun SONUCUDUR: proc-macro yüklenemeyince ona
# bağlı tüm crate'ler çözülemez. Bu yüzden hatayı Rust kodunda aramak boşunadır.
#
# Öznitelik yalnızca yeni oluşturulan dosyalara eklendiği için temizlik her
# derleme öncesi tekrarlanmalı. İşlem yalnızca derleme çıktılarına dokunur ve
# hiçbir koşulda derlemeyi düşürmez.

set -u

# Yalnızca macOS'ta anlamlı; diğer platformlarda sessizce çık.
[ "$(uname -s)" = "Darwin" ] || exit 0
command -v xattr >/dev/null 2>&1 || exit 0

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src-tauri/target"
[ -d "$root" ] || exit 0

cleared=0
for profile in debug release; do
  deps="$root/$profile/deps"
  [ -d "$deps" ] || continue
  for lib in "$deps"/*.dylib; do
    [ -e "$lib" ] || continue
    if [ -n "$(xattr "$lib" 2>/dev/null)" ]; then
      xattr -c "$lib" 2>/dev/null && cleared=$((cleared + 1))
    fi
  done
done

[ "$cleared" -gt 0 ] && echo "macOS provenance özniteliği temizlendi: $cleared proc-macro kitaplığı"

exit 0
