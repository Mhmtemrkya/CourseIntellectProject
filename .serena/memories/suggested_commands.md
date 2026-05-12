## Suggested Commands (Windows / PowerShell)

> **Not**: Repo'nun kök `package.json` script'leri `zsh -lc` ile yazılmış (macOS kalıntısı); Windows'ta birebir çalışmaz. Her stack'in kendi alt klasöründe komut çalıştırılır. PowerShell'de çift komut için `;` veya `if ($?) { ... }`.

### Backend — .NET 8
```powershell
# Restore
dotnet restore backend\CourseIntellect.sln

# Build (CI'in kullandığı komut)
dotnet build backend\CourseIntellect.sln --no-restore /p:UseAppHost=false

# Run API (http://127.0.0.1:5206)
dotnet run --project backend\CourseIntellect.Api\CourseIntellect.Api.csproj

# User-secrets (DB connection)
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=course_intellect;Username=postgres;Password=<SECRET>" --project backend\CourseIntellect.Api\CourseIntellect.Api.csproj

# Migration ekle
$env:COURSE_INTELLECT_DB="Host=localhost;Port=5432;Database=course_intellect;Username=postgres;Password=<SECRET>"
dotnet tool run dotnet-ef migrations add <MigrationAdi> `
  --project backend\CourseIntellect.Infrastructure\CourseIntellect.Infrastructure.csproj `
  --startup-project backend\CourseIntellect.Api\CourseIntellect.Api.csproj `
  --output-dir Persistence\Migrations

# DB güncelle
dotnet tool run dotnet-ef database update `
  --project backend\CourseIntellect.Infrastructure\CourseIntellect.Infrastructure.csproj `
  --startup-project backend\CourseIntellect.Api\CourseIntellect.Api.csproj
```

### Desktop — Tauri + React (CRA/Craco)
```powershell
cd desktop
npm install              # veya yarn (yarn lock var)

# CRA dev server
npm start

# Üretim build (web)
npm run build

# Tauri dev/build — package.json'daki PATH=... önekleri macOS için; Windows'ta:
.\node_modules\.bin\tauri dev
.\node_modules\.bin\tauri build

# Smoke testler
npm run smoke:roles

# Playwright e2e
npx playwright test
```

### Mobile — Flutter
```powershell
cd mobile
flutter pub get
flutter analyze              # lint
flutter test                 # unit/widget testleri (varsa)
flutter run                  # bağlı cihaz/emülatör
flutter build apk --debug    # Android debug build
flutter build appbundle      # Play Store
# iOS: yalnızca macOS — bu makinede mümkün değil
```

### Marketing Website — Next.js
```powershell
cd "courseintellectmarketingwebsite (1)"
pnpm install                 # pnpm-lock.yaml var
pnpm dev                     # next dev
pnpm build                   # next build
pnpm start                   # next start
pnpm lint                    # eslint .
```

### Performance / load testing
```powershell
k6 run performance-tests\k6-content.js
```

### PostgreSQL — Windows
PostgreSQL 18 yüklü: `C:\Program Files\PostgreSQL\18\data` (additional working directory).
```powershell
# Service durum
Get-Service -Name postgresql*
# Bağlan
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d course_intellect_dev
```

### Git / Sistem (Windows-uyumlu)
| Operasyon | Komut |
|-----------|-------|
| Dosya/dizin listele | `Get-ChildItem` (alias `ls`, `dir`) |
| Dizin değiştir | `Set-Location` (alias `cd`) |
| Dosya içeriği | **Read tool** (Get-Content yerine) |
| Pattern arama | **Grep tool** (Select-String yerine) |
| Glob | **Glob tool** (Get-ChildItem -Recurse yerine) |
| Edit | **Serena replace_symbol_body / replace_content** (.NET/JS) veya **Edit tool** (Dart/Markdown) |
| Env var | `$env:NAME = "value"` |
| Komut zincirleme | `;` veya `if ($?) { ... }` (`&&` yok!) |
| Ardışık komut başarı zinciri | `cmd1; if ($?) { cmd2 }` |
| Git status/log/diff/branch | git komutları PowerShell'de doğrudan |
