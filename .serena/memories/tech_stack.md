## Tech Stack — CourseIntellect

### Backend (`backend/`)
- **.NET 8** (ASP.NET Core Web API)
- **PostgreSQL** + **EF Core 8** (`Database.Migrate()` açılışta; eski `EnsureCreated` kaldırıldı)
- **JWT + Refresh Token** (8 saatlik access, 14 günlük refresh — `appsettings.json`)
- **SignalR** (`Hubs/`, `Realtime/` klasörleri — gerçek zamanlı mesajlaşma & bildirim)
- 4 katmanlı clean architecture:
  - `CourseIntellect.Api` — Controllers, Auth middleware, Program.cs, Hubs, wwwroot
  - `CourseIntellect.Application` — DTOs, Interfaces, Exceptions
  - `CourseIntellect.Domain` — Entities, Enums
  - `CourseIntellect.Infrastructure` — Persistence (EF + Migrations), Services, Auth, InMemory
- **39 Controller** (bkz. memory: codebase_structure) — auth, students, staff, classes, exams, attendance, contents, questionbank, messages, homework, schedule, dashboard, payments, support, vb.
- Solution: `backend/CourseIntellect.sln`. CI: `.github/workflows/dotnet.yml` (ubuntu-latest, dotnet 8).

### Desktop (`desktop/`) — ASIL üzerinde çalışılan istemci
- **Tauri 2** (`@tauri-apps/cli ^2.10.1`, Rust src-tauri/) + **React 18.3** (CRA via **Craco**)
- **Tailwind 3 + shadcn/ui** (Radix primitives) — `components.json`, `tailwind.config.js`
- `framer-motion`, `react-router-dom v7`, `zod`, `react-hook-form`, `@microsoft/signalr 9`, `axios`, `recharts`, `embla-carousel-react`, `sonner` (toasts)
- Plugins: `@tauri-apps/plugin-deep-link`, `plugin-http`, `plugin-shell`
- ESLint 9 + Playwright e2e (`playwright.config.js`); JS-only (`jsconfig.json`, no TS)
- API URL .env'den: `REACT_APP_COURSE_INTELLECT_API_URL=http://127.0.0.1:5206`
- Smoke testler: `scripts/role-smoke.mjs`

### Frontend (`frontend/`)
- Aynı stack (CRA+Craco+Tauri+React 18+Radix+Tailwind), ancak desktop'a göre eksik script setiyle. Aktif geliştirme `desktop/` üzerinde — `frontend/` muhtemelen erken iterasyon / yedek.

### Mobile (`mobile/`)
- **Flutter** SDK ^3.9.0, paket adı `student` (Flutter projesi ismi)
- Önemli paketler: `signalr_netcore`, `firebase_messaging`, `firebase_core`, `video_player`, `file_picker`, `image_picker`, `mobile_scanner`, `qr_flutter`, `flutter_local_notifications`, `shared_preferences`, `pdf`, `share_plus`, `open_filex`
- Lint: `flutter_lints ^6.0.0` (varsayılan)
- API client: `mobile/lib/services/*_api_service.dart`; oturum: `AuthSessionStore`
- iOS imza/build için ayrı `run_ios.sh` (iCloud/xattr workaround) ve `IOS_SIGNING_GUIDE.md`

### Marketing Website (`courseintellectmarketingwebsite (1)/`)
- **Next.js 16.0.10** (App Router) + **React 19.2** + **Tailwind v4**
- v0/Vercel ekosistemi (`@vercel/analytics`), 3D için `@react-three/fiber` + `drei` + `three`
- TypeScript (`tsconfig.json`)
- Klasörler: `app/`, `components/`, `context/`, `data/`, `hooks/`, `lib/`, `public/`, `styles/`, `types/`, `tools/`

### Diğer
- `performance-tests/k6-content.js` — k6 yük testi
- `infra-build.log`, `build-api.log`, `build-diag.log`, `restore.log` — log dosyaları (gitignore'a alınmalı)
- `yeni/` — bir Xcode projesi (yeni.xcodeproj) — ana koddan ayrı
- `skills/` — muhtemelen Claude Code skill'leri
