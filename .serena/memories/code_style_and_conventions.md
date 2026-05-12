## Code Style & Conventions

### Genel
- **Dosya kodlaması: UTF-8** (zorunlu — `.editorconfig` `charset = utf-8`). Türkçe karakterler (ç, ğ, ı, ö, ş, ü, İ, Ş, Ğ, Ö, Ü, Ç) kullanıcıya görünen tüm UI metinlerinde **doğru** yazılmalı. ASCII karşılıkları (`Sinif`, `Henuz`, `Ogretmen`, `Planlandi`, `Cozdukl`, `Subat`, `Mayis`, ...) UI string'lerinde kabul edilmez. JSON anahtarları, API endpoint path'leri ve enum string'leri Türkçeleştirilmez — sadece UI metni.
- Yorumlar: WHY için yaz, WHAT için yazma. Geliştiriciye apaçık bir kodu anlatmak için yorum eklemeyeceksin.
- Refactor minimalizmi: bug fix istenmişse etrafı temizleme; gereksiz abstraction yok.
- `CODEX_PROMPT.md` ve `CURRENT_STATUS.md` dosyalarındaki yollar **macOS** yollarıdır (eski) — Windows ortamında çalışırken bu yollar kılavuz olarak değil tarihsel referans olarak okunmalı.

### Backend (.NET 8 / C#)
- `Nullable enable`, `ImplicitUsings enable`.
- 4-katmanlı: Api → Application → Infrastructure → Domain. Yatay sızıntıdan kaçın (Controller doğrudan DbContext kullanmaz; Service/Interface üzerinden).
- EF Core migrations: `backend/CourseIntellect.Infrastructure/Persistence/Migrations/`. Yeni migration ekleneceğinde `dotnet-ef migrations add` kullanılır (komut için memory: suggested_commands).
- Auth: JWT Bearer + Refresh Token. Endpoint'lerin çoğu `[Authorize]`; rol bazlı (`Teacher,Admin`).
- Multi-tenant: tüm sorguların tenant ID'siyle filtrelenmesi gerek (memory: feedback_no_global_scope).

### Desktop / Frontend (React + JS)
- **JavaScript** (TypeScript yok — `jsconfig.json`). Bileşenler `.jsx`.
- **shadcn/ui** + Radix UI (`components.json` var). Tailwind utility-first.
- React Router v7 (Data Router olabilir).
- Zod + react-hook-form + `@hookform/resolvers` ile form doğrulama.
- ESLint 9 yapılandırması; Prettier yok.
- API client genellikle `axios` veya `@tauri-apps/plugin-http` üzerinden — `lib/` ve `services/` altında.
- State: kombine context + custom store (`store/` ve `context/` klasörleri).

### Mobile (Flutter / Dart)
- Lint: `flutter_lints` defaults (`analysis_options.yaml`).
- Singletonlar: `AuthSessionStore.instance`, `MessageApiService.instance`, `HomeworkApiService.instance`, `StudentRegistryStore` — yeni servis yazma yerine bunları kullan.
- API service'leri `mobile/lib/services/*_api_service.dart` adlandırma kuralında.
- Page'ler `mobile/lib/pages/<role>_<feature>_page.dart` veya `<feature>_page.dart`.

### Marketing Website (Next.js)
- TypeScript (strict tsconfig).
- Tailwind v4 + shadcn pattern.
- App Router (`app/` klasörü).

### Multi-Tenant Sözleşmesi (KRİTİK)
- Bir tenant'a ait veri **mutlaka** tenant ID'siyle scope'lanır. `scopeKey: 'global'` veya `tenantId: null` ile veri yazma/okuma **yapılmaz**. Bu kuralın istisnası yok — platform-level tablolar zaten tenant'tan bağımsız tablo şemasındadır.
