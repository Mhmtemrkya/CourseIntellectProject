# CourseIntellect Backend

Bu klasor, mobil Flutter uygulamasi ve ASP.NET web arayuzu tarafindan ortak kullanilacak `ASP.NET Core Web API` backend'idir.

## Mimari

- `CourseIntellect.Api`
  - controller'lar, auth middleware, uygulama giris noktasi
- `CourseIntellect.Application`
  - DTO'lar ve servis arayuzleri
- `CourseIntellect.Domain`
  - entity ve enum modelleri
- `CourseIntellect.Infrastructure`
  - EF Core, PostgreSQL, auth, servis implementasyonlari

## Su anda backend'e tasinmis ana moduller

- auth / login / refresh token
- users / roles
- ogrenci kaydi
- ogretmen / idari / muhasebe kaydi
- ogrenci listesi
- duyurular
- sinav sonuclari
- gorusme talepleri
- mesajlasma
- icerikler
- soru bankasi

## Teknoloji

- `.NET 8`
- `ASP.NET Core Web API`
- `EF Core 8`
- `PostgreSQL`
- `JWT + Refresh Token`

## Veritabani yaklasimi

Bu proje artik `EnsureCreated` kullanmiyor.

Onun yerine:

- `EF Core Migrations` kullanir
- uygulama acilisinda `Database.Migrate()` calisir
- ilk seed veriler migration sonrasi eklenir

Bu, sisteminiz icin daha dogru yaklasimdir; cunku:

- mobil ve web ayni veritabanini kullanir
- yeni tablo/alan eklemek kontrollu olur
- ekip calismasinda surum takibi saglanir
- production'a tasirken daha guvenlidir

## Migration dosyalari

- [20260315140438_InitialCreate.cs](/Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Infrastructure/Persistence/Migrations/20260315140438_InitialCreate.cs)
- [CourseIntellectDbContextModelSnapshot.cs](/Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Infrastructure/Persistence/Migrations/CourseIntellectDbContextModelSnapshot.cs)

## Gelistirme ortami kurulumu

### 1. PostgreSQL calistir

Makinede PostgreSQL'in acik oldugundan emin olun.

Varsayilan development baglantisi:

```json
Host=localhost;Port=5432;Database=course_intellect_dev;Username=postgres;Password=CHANGE_ME
```

Dosya:

- [appsettings.Development.json](/Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Api/appsettings.Development.json)

Gelistirme icin en guvenli iki yol:

- `dotnet user-secrets` ile API projesine local secret yazmak
- migration komutlari icin `COURSE_INTELLECT_DB` environment variable kullanmak

Ornek:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=course_intellect;Username=postgres;Password=<GUCLU_SIFRE>" --project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Api/CourseIntellect.Api.csproj
```

Design-time migration komutlari icin:

```bash
export COURSE_INTELLECT_DB="Host=localhost;Port=5432;Database=course_intellect;Username=postgres;Password=<GUCLU_SIFRE>"
```

### 2. Paketleri geri yukle

```bash
dotnet restore /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.sln
```

### 3. Migration'i veritabanina uygula

```bash
cd /Users/oguzhanmindivanli/Desktop/denemeler/backend
dotnet tool run dotnet-ef database update \
  --project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Infrastructure/CourseIntellect.Infrastructure.csproj \
  --startup-project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Api/CourseIntellect.Api.csproj
```

### 4. API'yi calistir

```bash
dotnet run --project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Api/CourseIntellect.Api.csproj
```

## Sik kullanilan komutlar

### Build

```bash
dotnet build /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.sln --no-restore
```

### Yeni migration olustur

```bash
cd /Users/oguzhanmindivanli/Desktop/denemeler/backend
dotnet tool run dotnet-ef migrations add <MigrationAdi> \
  --project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Infrastructure/CourseIntellect.Infrastructure.csproj \
  --startup-project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Api/CourseIntellect.Api.csproj \
  --output-dir Persistence/Migrations
```

### Veritabanini guncelle

```bash
cd /Users/oguzhanmindivanli/Desktop/denemeler/backend
dotnet tool run dotnet-ef database update \
  --project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Infrastructure/CourseIntellect.Infrastructure.csproj \
  --startup-project /Users/oguzhanmindivanli/Desktop/denemeler/backend/CourseIntellect.Api/CourseIntellect.Api.csproj
```

## Ilk endpoint seti

### Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Users / Roles

- `GET /api/users`
- `GET /api/users/roles`

### Students / Staff

- `GET /api/students`
- `POST /api/students`
- `GET /api/staff`
- `POST /api/staff`
- `POST /api/staff/accounting`

### Announcements

- `GET /api/announcements`
- `POST /api/announcements`

### Exam Results

- `GET /api/examresults`
- `POST /api/examresults`

### Meetings

- `GET /api/meetingrequests`
- `POST /api/meetingrequests`
- `PUT /api/meetingrequests/{id}/status`

### Messages

- `GET /api/messages/threads`
- `POST /api/messages/threads`
- `GET /api/messages/threads/{threadId}`
- `POST /api/messages/threads/{threadId}/messages`

### Contents

- `GET /api/contents`
- `POST /api/contents`
- `PUT /api/contents/{id}`
- `PUT /api/contents/{id}/status`

### Question Bank

- `GET /api/questionbank`
- `POST /api/questionbank`
- `PUT /api/questionbank/{id}`
- `DELETE /api/questionbank/{id}`
- `POST /api/questionbank/{id}/usage`

## Yetkilendirme

- login disindaki endpoint'ler JWT ister
- `Authorization: Bearer <token>` kullanilir
- admin-only endpoint'ler rol bazli korunur
- ogretmen endpoint'leri `Teacher,Admin`
- soru bankasi ve icerik yazma islemleri rol kontrolludur

## Bilinen development notu

Bu makinede `dotnet ef database update` komutu denendi ve migration tarafi dogru calisti; ancak PostgreSQL su anda acik olmadigi icin su hata alindi:

- `Failed to connect to 127.0.0.1:5432`

Yani backend kodu ve migration yapisi hazir, fakat development veritabaninin ayaga kalkmasi gerekiyor.

## Eski local veritabani kullaniliyorsa

Eger daha once `EnsureCreated` ile olusmus bir local database kullandiysan, migration gecisinde en temiz yol development DB'yi yeniden olusturmak olur. Bunun sebebi eski semanin `__EFMigrationsHistory` olmadan olusmus olmasidir.

## Sonraki mantikli adimlar

- icerik ve soru bankasinda dosya yukleme/storage katmani
- rol yonetimi yazma endpoint'leri
- muhasebe modullerinin backend'e tasinmasi
- SignalR ile gercek zamanli mesajlar ve bildirimler
