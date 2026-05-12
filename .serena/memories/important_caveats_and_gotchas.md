## Important Caveats & Gotchas

### 1. Serena Dart DESTEKLEMİYOR
`mobile/` klasörü Dart kodu — Serena'nın LSP destekleri (`get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, vb.) burada çalışmaz. Mobile'da klasik Read/Glob/Grep + Edit/Write kullan. Refactor için `Grep` ile referans aramak zorundasın.

Aktif Serena dilleri: **TypeScript** (Next.js sitesi), **JavaScript** (desktop/frontend), **C#** (backend). `.NET` için Roslyn LSP, JS/TS için typescript-language-server/eslint çalışıyor olmalı.

### 2. Path bilgileri ESKİ
- `CURRENT_STATUS.md` ve `backend/README.md` macOS path'leri içeriyor (`/Users/oguzhanmindivanli/Desktop/...`). Bunlar tarihsel — **gerçek konum**: `c:\Users\KAYA\Desktop\Mehmet Emir KAYA\CourseIntellectProject2\CourseIntellectProject\`.
- `CODEX_PROMPT.md` eski bir mobil bug-fix listesidir (11 madde) — yeni göreve karıştırma.

### 3. `package.json` script'leri zsh kalıntısı
Kök `package.json` `dev:web`, `dev:all`, `mobile:sim` script'leri `zsh -lc` ile yazılmış — Windows PowerShell'de çalışmaz. Her stack'i kendi klasöründe ayrı ayrı çalıştır.

`desktop/package.json` script'leri `PATH=...` önekleri içeriyor (homebrew rustup yolu) — Windows'ta `.\node_modules\.bin\tauri dev` doğrudan çalıştır.

### 4. `desktop/` mü `frontend/` mi?
Aktif istemci **`desktop/`**. `frontend/` paralel ama eksik (sadece `build` ve `test` script'i var, `start`/`desktop:dev` yok). Genel kural: değişiklik `desktop/`'a, sonra gerekirse `frontend/`'e mirror'lanır. Dokunulan dosyaların sembolik karşılığı `frontend/`'de varsa kullanıcıya sor.

### 5. TARANMAYACAK klasörler
`node_modules/`, `bin/`, `obj/`, `target/` (Rust), `build/`, `.next/`, `out/`, `.dart_tool/`, `.idea/`, `.vs/`, `.git/`, `mobile/build/`, `desktop/src-tauri/target/`, `frontend/src-tauri/target/`, `courseintellectmarketingwebsite (1)/.next/`. Glob/Grep çağrılarken path kısıtla.

### 6. Multi-tenant kuralı (KRİTİK — feedback_no_global_scope memory'de var)
`scopeKey: 'global'` ya da `tenantId: null` ile veri yazılmaz. Tenant ID **her** sorgu, her cache key, her storage key'in parçasıdır. Mevcut kod tabanını izle — `tenant_workspaces` tablosu temel taş.

### 7. Marketing site klasör adı boşluk içeriyor
`courseintellectmarketingwebsite (1)/` — boşluk + parantez. PowerShell'de tek tırnak içinde tut: `'courseintellectmarketingwebsite (1)'`. `pnpm-lock.yaml` var → **pnpm** kullan, npm/yarn değil.

### 8. PostgreSQL servisi
`C:\Program Files\PostgreSQL\18\data` additional working directory — Postgres 18 yüklü. Backend bağlanamadığında ilk kontrol `Get-Service postgresql*`.

### 9. Mobil iOS xattr sorunu
iCloud senkronu yüzünden xcode codesign reddediyor. Çözüm `mobile/run_ios.sh` (xattr strip + ad-hoc sign). Bu makinede (Windows) iOS build mümkün değil.

### 10. Log dosyaları repoda
`build-api.log`, `infra-build.log`, `build-diag.log`, `restore.log` — kök dizinde commit edilmiş. Yeni komut çıktılarını bu dosyalara yönlendirme.

### 11. Git durumu (onboarding anı)
Kullanıcı `mobile/`'da generated_plugin_registrant ve pubspec.lock değişikliklerini henüz commit etmemiş — bunlar Flutter build çıktısı, normalde gitignore'da olmalı. `.serena/` dizini de untracked (yeni eklendi).
