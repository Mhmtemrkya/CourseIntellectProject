## Task Completion Checklist

Bir görevi "bitti" diyebilmen için aşağıdakileri **etkilenen stack'e göre** çalıştır.

### Backend (.NET) değişiklikleri
1. `dotnet build backend\CourseIntellect.sln --no-restore /p:UseAppHost=false` — temiz geçmeli (CI'in birebir çalıştırdığı komut).
2. Migration eklediysen: `dotnet tool run dotnet-ef database update ...` ve uygulama açılışta `Database.Migrate()` ile çalıştığını doğrula.
3. Yeni endpoint eklediysen: `[Authorize]`/rol attribute'larının doğru olduğunu, tenant scope'un sağlandığını, DTO validation'ının (ModelState) çalıştığını kontrol et.
4. Multi-tenant kontrolü: yeni sorgular tenant ID'sine filtreleniyor mu? `scopeKey: 'global'` kullanılmış mı? — yoksa düzelt.

### Desktop (React + Tauri) değişiklikleri
1. `cd desktop; npm start` ile dev server'da hatasız açılmalı.
2. ESLint: hatalar konsola düşüyor — temizlemeden tamamlama.
3. Etkilenen role/sayfayı tarayıcıda aç (CRA :3000) ve **golden path + edge case** test et. Sadece tip/test geçmesi yeterli değil — UI değişikliği gerçekten görünmeli.
4. Playwright smoke: değişiklik kritik yoldaysa `npm run smoke:roles` veya `npx playwright test`.
5. API .env'i `http://127.0.0.1:5206` — backend ayrı terminalde açık olmalı.

### Mobile (Flutter) değişiklikleri
1. `cd mobile; flutter analyze` — uyarısız geçmeli.
2. Android: `flutter build apk --debug` — derleme hatasız.
3. iOS bu makinede yok (Windows). iOS için `mobile/run_ios.sh` macOS'ta gerekir.
4. UTF-8 string'lerin doğru render edildiğini doğrula (rastgele birkaç sayfa).
5. Singleton'lara saygı: `AuthSessionStore.instance`, `MessageApiService.instance` vb. — yeni paralel instance açma.

### Marketing Website (Next.js) değişiklikleri
1. `cd "courseintellectmarketingwebsite (1)"; pnpm lint` — hatasız.
2. `pnpm build` — type errors yok, bundle başarılı.
3. `pnpm dev` ile sayfayı tarayıcıda kontrol.

### Cross-cutting (her görevde)
- **UTF-8 koruması**: dosya yazarken encoding bozulmasın (`.editorconfig` `charset = utf-8`). Edit tool zaten UTF-8 yazar; Set-Content kullanılırsa `-Encoding utf8` zorunlu.
- **Multi-tenant**: `scopeKey: 'global'` veya `tenantId: null` yazılmaz. Yeni veri tablosu/state varsa mutlaka tenant scope'lu.
- **Mobile/ Dart**: Serena Dart desteklemiyor — orada Read/Glob/Grep + Edit kullan.
- **Token tasarrufu**: değiştirmeden önce `get_symbols_overview` → ihtiyaç duyulan symbol için `find_symbol`. Refactor öncesi `find_referencing_symbols` ZORUNLU (tüm referansları kontrol et, body'yi sadece gerekirse oku).
- **Build log dosyaları**: Çalıştırdığın komutlar `restore.log`, `infra-build.log`, `build-api.log`, `build-diag.log`'a yazılmamalı (bunlar tarihte commit edilmiş, gitignore'a alınmamış — yeni log üretmeye devam etme).
- **Rapor**: hangi dosya → hangi satır → ne değişti, kısa özet.
