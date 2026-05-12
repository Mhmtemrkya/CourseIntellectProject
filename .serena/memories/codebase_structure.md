## Codebase Structure

### Top-level
```
CourseIntellectProject/
├── backend/                              .NET 8 API
│   ├── CourseIntellect.sln
│   ├── Directory.Build.props
│   ├── CourseIntellect.Api/              ← entry point, runs on :5206
│   │   ├── Program.cs
│   │   ├── Controllers/                  39 controllers
│   │   ├── Hubs/                         SignalR
│   │   ├── Realtime/
│   │   ├── Properties/
│   │   ├── wwwroot/                      static files (uploads etc.)
│   │   ├── appsettings.json              Jwt issuer/audience/key
│   │   └── appsettings.Development.json
│   ├── CourseIntellect.Application/      DTOs, Interfaces, Exceptions
│   ├── CourseIntellect.Domain/           Entities, Enums
│   └── CourseIntellect.Infrastructure/   Auth, InMemory, Persistence (Migrations), Services
├── desktop/                              ← AKTİF Tauri+React istemci
│   ├── package.json                      craco scripts + tauri scripts
│   ├── craco.config.js
│   ├── tailwind.config.js
│   ├── components.json                   shadcn config
│   ├── playwright.config.js
│   ├── plugins/
│   ├── public/
│   ├── scripts/                          role-smoke.mjs, vb.
│   ├── src/
│   │   ├── App.js, index.js, App.css, index.css
│   │   ├── pages/                        Dashboard, Login, Schedule, Students, Teachers, Parents,
│   │   │   ├── admin/                    Classes, Content, Exams, Questions, Reports, Settings,
│   │   │   ├── chat/                       Attendance, KioskQR, MaintenancePage (15 top-level)
│   │   │   ├── finance/
│   │   │   ├── parent/
│   │   │   ├── student/
│   │   │   ├── superadmin/
│   │   │   └── teacher/
│   │   ├── components/                   shadcn/ui + custom
│   │   ├── context/, hooks/, lib/, store/, styles/, legal/, assets/
│   └── src-tauri/                        Rust shell (target/ ignore!)
├── frontend/                             paralel React+Tauri (sibling, daha az aktif)
├── mobile/                               Flutter — Dart, Serena Dart desteklemiyor
│   ├── pubspec.yaml
│   ├── analysis_options.yaml
│   ├── run_ios.sh                        iOS xattr workaround
│   ├── lib/
│   │   ├── main.dart, theme.dart, theme_provider.dart
│   │   ├── pages/                        rol bazlı sayfalar
│   │   ├── widgets/, services/, models/, navigation/, utils/, legal/
│   │   └── (ayrıca scripts/, assets/)
│   ├── android/, ios/, macos/, windows/, linux/, web/    platform shells
│   └── build/                            ignore!
├── courseintellectmarketingwebsite (1)/  Next.js 16 + React 19 (TypeScript)
│   ├── app/, components/, context/, data/, hooks/, lib/, styles/, types/, tools/
│   ├── next.config.mjs, tsconfig.json
│   └── public/
├── courseintellect-ai/                   sadece 00-rehber.md
├── performance-tests/                    k6-content.js
├── skills/                               Claude Code skills
├── yeni/                                 ayrık bir Xcode projesi
├── package.json                          monorepo orchestrator (bash/zsh script'leri var)
├── CURRENT_STATUS.md                     macOS path'leri ile eski referanslar
├── CODEX_PROMPT.md                       eski mobil bug-fix briefi
└── .github/workflows/dotnet.yml          backend CI
```

### Backend Controllers (39 toplam)
Accounting, Announcements, AppSettings, Attendance, Auth, Classes, ContactMessages, Contents, Courses, Dashboard, ExamResults, ExamSessions, Homework, LiveRoomSessions, LoginAttempts, MeetingRequests, Messages, Notifications, Parents, PlannedExams, PlatformConfigurations, PlatformOperations, PlatformSubscriptions, Push, QuestionBank, QuestionThreads, Reports, Schedule, SiteContents, Staff, Students, StudyPlans, SupportTickets, System, Translations, Uploads, Users, WrongAnswers + `CompatibilitySnapshotStore.cs` (yardımcı class).

### TARANMAYACAK klasörler (token israfı)
- `node_modules/`, `bin/`, `obj/`, `target/` (Rust), `build/` (Flutter & web), `.next/`, `out/`,
  `.dart_tool/`, `.idea/`, `.vs/`, `.serena/`, `.vscode/`, `.git/`, `dist/`,
  `mobile/build/`, `desktop/src-tauri/target/`, `frontend/src-tauri/target/`,
  `courseintellectmarketingwebsite (1)/.next/`, `courseintellectmarketingwebsite (1)/out/`
