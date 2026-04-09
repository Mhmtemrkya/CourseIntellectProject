# CourseIntellect Backend API Planı

Bu döküman, CourseIntellect platformunun ASP.NET Core REST API backend mimarisini ve frontend entegrasyon adımlarını detaylı olarak açıklamaktadır.

---

## İçindekiler

1. [Proje Yapısı](#1-proje-yapısı)
2. [Veritabanı Şeması](#2-veritabanı-şeması)
3. [API Endpoint'leri](#3-api-endpointleri)
4. [Kimlik Doğrulama ve Yetkilendirme](#4-kimlik-doğrulama-ve-yetkilendirme)
5. [Frontend Entegrasyonu](#5-frontend-entegrasyonu)
6. [Deployment](#6-deployment)
7. [Görev Listesi](#7-görev-listesi)

---

## 1. Proje Yapısı

### 1.1 Solution Yapısı

\`\`\`
CourseIntellect.sln
├── src/
│   ├── CourseIntellect.API/              # Ana Web API projesi
│   ├── CourseIntellect.Core/             # Domain entities, interfaces
│   ├── CourseIntellect.Application/      # Business logic, DTOs, services
│   ├── CourseIntellect.Infrastructure/   # EF Core, external services
│   └── CourseIntellect.Shared/           # Ortak utilities
├── tests/
│   ├── CourseIntellect.UnitTests/
│   └── CourseIntellect.IntegrationTests/
└── docs/
\`\`\`

### 1.2 Katmanlı Mimari

\`\`\`
┌─────────────────────────────────────┐
│           Presentation              │
│         (API Controllers)           │
├─────────────────────────────────────┤
│           Application               │
│     (Services, DTOs, Validators)    │
├─────────────────────────────────────┤
│             Domain                  │
│    (Entities, Value Objects)        │
├─────────────────────────────────────┤
│          Infrastructure             │
│   (EF Core, Identity, Repositories) │
└─────────────────────────────────────┘
\`\`\`

### 1.3 Teknoloji Stack

| Teknoloji | Versiyon | Kullanım Alanı |
|-----------|----------|----------------|
| .NET | 8.0 | Framework |
| ASP.NET Core | 8.0 | Web API |
| Entity Framework Core | 8.0 | ORM |
| SQL Server | 2022 | Veritabanı |
| Redis | 7.x | Cache |
| JWT | - | Authentication |
| AutoMapper | 12.x | Object Mapping |
| FluentValidation | 11.x | Validation |
| Serilog | 3.x | Logging |
| Swagger/OpenAPI | 6.x | API Documentation |

---

## 2. Veritabanı Şeması

### 2.1 Kullanıcı Tabloları

\`\`\`sql
-- Kullanıcılar tablosu
CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Email NVARCHAR(256) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(MAX) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Phone NVARCHAR(20),
    Avatar NVARCHAR(500),
    Role NVARCHAR(50) NOT NULL, -- 'student', 'parent', 'teacher', 'accountant', 'admin', 'editor'
    SchoolId UNIQUEIDENTIFIER NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    EmailVerified BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LastLoginAt DATETIME2 NULL,
    
    CONSTRAINT FK_Users_Schools FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Kullanıcı rolleri tablosu (çoklu rol desteği için)
CREATE TABLE UserRoles (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    Role NVARCHAR(50) NOT NULL,
    
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Giriş kayıtları tablosu
CREATE TABLE LoginAttempts (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NULL,
    Email NVARCHAR(256) NOT NULL,
    Role NVARCHAR(50) NOT NULL,
    Success BIT NOT NULL,
    IpAddress NVARCHAR(45),
    UserAgent NVARCHAR(500),
    Timestamp DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_LoginAttempts_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- Refresh token tablosu
CREATE TABLE RefreshTokens (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    Token NVARCHAR(500) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    RevokedAt DATETIME2 NULL,
    ReplacedByToken NVARCHAR(500) NULL,
    
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
\`\`\`

### 2.2 Okul ve Sınıf Tabloları

\`\`\`sql
-- Okullar tablosu
CREATE TABLE Schools (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(200) NOT NULL,
    Code NVARCHAR(50) NOT NULL UNIQUE,
    Address NVARCHAR(500),
    Phone NVARCHAR(20),
    Email NVARCHAR(256),
    Logo NVARCHAR(500),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Sınıflar tablosu
CREATE TABLE Classes (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    SchoolId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Grade INT NOT NULL,
    Section NVARCHAR(10),
    AcademicYear NVARCHAR(20) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_Classes_Schools FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Öğrenci-Sınıf ilişkisi
CREATE TABLE StudentClasses (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StudentId UNIQUEIDENTIFIER NOT NULL,
    ClassId UNIQUEIDENTIFIER NOT NULL,
    EnrolledAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_StudentClasses_Users FOREIGN KEY (StudentId) REFERENCES Users(Id),
    CONSTRAINT FK_StudentClasses_Classes FOREIGN KEY (ClassId) REFERENCES Classes(Id)
);

-- Veli-Öğrenci ilişkisi
CREATE TABLE ParentStudents (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ParentId UNIQUEIDENTIFIER NOT NULL,
    StudentId UNIQUEIDENTIFIER NOT NULL,
    Relationship NVARCHAR(50) NOT NULL, -- 'mother', 'father', 'guardian'
    
    CONSTRAINT FK_ParentStudents_Parent FOREIGN KEY (ParentId) REFERENCES Users(Id),
    CONSTRAINT FK_ParentStudents_Student FOREIGN KEY (StudentId) REFERENCES Users(Id)
);
\`\`\`

### 2.3 Ders ve Kurs Tabloları

\`\`\`sql
-- Dersler tablosu
CREATE TABLE Courses (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    SchoolId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Code NVARCHAR(50) NOT NULL,
    Description NVARCHAR(1000),
    Credits INT NOT NULL DEFAULT 1,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_Courses_Schools FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Öğretmen-Ders ilişkisi
CREATE TABLE TeacherCourses (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TeacherId UNIQUEIDENTIFIER NOT NULL,
    CourseId UNIQUEIDENTIFIER NOT NULL,
    ClassId UNIQUEIDENTIFIER NOT NULL,
    AcademicYear NVARCHAR(20) NOT NULL,
    
    CONSTRAINT FK_TeacherCourses_Teacher FOREIGN KEY (TeacherId) REFERENCES Users(Id),
    CONSTRAINT FK_TeacherCourses_Course FOREIGN KEY (CourseId) REFERENCES Courses(Id),
    CONSTRAINT FK_TeacherCourses_Class FOREIGN KEY (ClassId) REFERENCES Classes(Id)
);
\`\`\`

### 2.4 Çeviri Tablosu

\`\`\`sql
-- Çeviriler tablosu
CREATE TABLE Translations (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    [Key] NVARCHAR(200) NOT NULL,
    Language NVARCHAR(5) NOT NULL, -- 'tr', 'en'
    Value NVARCHAR(MAX) NOT NULL,
    Category NVARCHAR(50) NOT NULL, -- 'navbar', 'hero', 'features', etc.
    IsCustom BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT UQ_Translations_Key_Language UNIQUE ([Key], Language)
);

-- Varsayılan çevirileri ekle
CREATE INDEX IX_Translations_Key ON Translations([Key]);
CREATE INDEX IX_Translations_Language ON Translations(Language);
CREATE INDEX IX_Translations_Category ON Translations(Category);
\`\`\`

### 2.5 Site İçerik Tablosu

\`\`\`sql
-- Site içerikleri tablosu (JSON olarak saklanır)
CREATE TABLE SiteContents (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Section NVARCHAR(50) NOT NULL UNIQUE, -- 'navbar', 'homepage', 'features', etc.
    Content NVARCHAR(MAX) NOT NULL, -- JSON içerik
    Language NVARCHAR(5) NOT NULL DEFAULT 'tr',
    Version INT NOT NULL DEFAULT 1,
    PublishedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedBy UNIQUEIDENTIFIER NULL,
    
    CONSTRAINT FK_SiteContents_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES Users(Id)
);
\`\`\`

---

## 3. API Endpoint'leri

### 3.1 Authentication API

\`\`\`
POST   /api/auth/register          - Yeni kullanıcı kaydı
POST   /api/auth/login             - Kullanıcı girişi
POST   /api/auth/refresh-token     - Token yenileme
POST   /api/auth/logout            - Çıkış yapma
POST   /api/auth/forgot-password   - Şifre sıfırlama isteği
POST   /api/auth/reset-password    - Şifre sıfırlama
POST   /api/auth/verify-email      - E-posta doğrulama
GET    /api/auth/me                - Mevcut kullanıcı bilgisi
\`\`\`

#### Request/Response Örnekleri

**POST /api/auth/register**
\`\`\`json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Ahmet Yılmaz",
  "role": "student",
  "phone": "+905551234567"
}

// Response 201 Created
{
  "success": true,
  "message": "Kayıt başarılı. Lütfen e-postanızı doğrulayın.",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
\`\`\`

**POST /api/auth/login**
\`\`\`json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "student"
}

// Response 200 OK
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "expiresIn": 3600,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "Ahmet Yılmaz",
      "role": "student",
      "avatar": null
    }
  }
}
\`\`\`

### 3.2 Users API

\`\`\`
GET    /api/users                  - Kullanıcı listesi (Admin)
GET    /api/users/{id}             - Kullanıcı detayı
PUT    /api/users/{id}             - Kullanıcı güncelleme
DELETE /api/users/{id}             - Kullanıcı silme
GET    /api/users/login-attempts   - Giriş kayıtları (Admin)
GET    /api/users/registrations    - Kayıt listesi (Admin)
PATCH  /api/users/{id}/activate    - Kullanıcı aktifleştirme
PATCH  /api/users/{id}/deactivate  - Kullanıcı pasifleştirme
\`\`\`

### 3.3 Schools API

\`\`\`
GET    /api/schools                - Okul listesi
POST   /api/schools                - Yeni okul oluştur
GET    /api/schools/{id}           - Okul detayı
PUT    /api/schools/{id}           - Okul güncelle
DELETE /api/schools/{id}           - Okul sil
GET    /api/schools/{id}/classes   - Okul sınıfları
GET    /api/schools/{id}/users     - Okul kullanıcıları
\`\`\`

### 3.4 Classes API

\`\`\`
GET    /api/classes                - Sınıf listesi
POST   /api/classes                - Yeni sınıf oluştur
GET    /api/classes/{id}           - Sınıf detayı
PUT    /api/classes/{id}           - Sınıf güncelle
DELETE /api/classes/{id}           - Sınıf sil
GET    /api/classes/{id}/students  - Sınıf öğrencileri
POST   /api/classes/{id}/students  - Öğrenci ekle
DELETE /api/classes/{id}/students/{studentId} - Öğrenci çıkar
\`\`\`

### 3.5 Courses API

\`\`\`
GET    /api/courses                - Ders listesi
POST   /api/courses                - Yeni ders oluştur
GET    /api/courses/{id}           - Ders detayı
PUT    /api/courses/{id}           - Ders güncelle
DELETE /api/courses/{id}           - Ders sil
\`\`\`

### 3.6 Translations API

\`\`\`
GET    /api/translations                    - Tüm çeviriler
GET    /api/translations/{language}         - Dile göre çeviriler
GET    /api/translations/{language}/{key}   - Tekil çeviri
POST   /api/translations                    - Çeviri ekle/güncelle
PUT    /api/translations/{id}               - Çeviri güncelle
DELETE /api/translations/{id}               - Çeviri sil
POST   /api/translations/bulk               - Toplu çeviri güncelle
GET    /api/translations/export             - Çevirileri dışa aktar
POST   /api/translations/import             - Çevirileri içe aktar
\`\`\`

### 3.7 Content API

\`\`\`
GET    /api/content                         - Tüm site içerikleri
GET    /api/content/{section}               - Bölüm içeriği
PUT    /api/content/{section}               - Bölüm güncelle
POST   /api/content/{section}/publish       - İçerik yayınla
GET    /api/content/{section}/history       - İçerik geçmişi
POST   /api/content/{section}/revert/{version} - Önceki versiyona dön
\`\`\`

### 3.8 Messages API

\`\`\`
GET    /api/messages                - Mesaj listesi
POST   /api/messages                - Yeni mesaj gönder
GET    /api/messages/{id}           - Mesaj detayı
PUT    /api/messages/{id}/read      - Okundu işaretle
DELETE /api/messages/{id}           - Mesaj sil
\`\`\`

---

## 4. Kimlik Doğrulama ve Yetkilendirme

### 4.1 JWT Configuration

```csharp
// appsettings.json
{
  "JwtSettings": {
    "Secret": "your-super-secret-key-min-32-characters",
    "Issuer": "CourseIntellect",
    "Audience": "CourseIntellect.Client",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 7
  }
}
