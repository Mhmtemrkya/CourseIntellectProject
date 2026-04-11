Rules

1-Düşünme analizi Opus 4.6 ile Kodlama işini Sonnet 4.6 yı kullan.

---

# CourseIntellect — Mimari Akış (Temel Taşı: KURUM / Tenant)

## Platform Akışı

1. **Müşteri (dershane/okul/kurs sahibi)** → Marketing web sitesine gelir
2. **Kurum Kaydı** (`/kurum-kaydi`) → Kayıt talebi oluşturur → `tenant_workspaces` tablosuna `status: "pending"` olarak eklenir
3. **Platform Admin (biz)** → Desktop superadmin panelinden veya marketing admin panelinden kurumu **onaylar** (`status: "active"`)
4. **Onay sonrası** → Kurum için otomatik bir admin kullanıcısı oluşturulur (kurum kayıt formundaki email/bilgilerle)
5. **Müşteri** → Marketing sitesinden `/giris` → "Kurum Girişi" ile giriş yapar
6. **Müşteri** → `/indir` sayfasından desktop/mobil uygulamaları indirir
7. **Platform Admin (biz)** → Superadmin panelinden kurumun logosunu, renklerini, branding'ini ayarlar (per-tenant, global'i kirletmeden)
8. **Kurum Yöneticisi** → Desktop/mobilde giriş yapıp kendi ekosistemini kurar:
   - Muhasebeci ekler
   - Öğretmen ekler
   - Sınıf/Grup oluşturur
   - Öğrenci kaydı yapar
   - Veli kaydı yapar
   - Ders programı oluşturur
   - İçerik yükler, sınav oluşturur vb.

## Mimari Temel Kurallar

- **KURUM (Tenant) her şeyin temelidir.** Tüm veriler tenant-scoped olmalıdır.
- `users` tablosunda `tenant_id` (FK → `tenant_workspaces.Id`) olmalı — her kullanıcı bir kuruma aittir.
- Desktop/mobil uygulama hangi tenant'a ait olduğunu bilmelidir (login sonrası tenant context).
- Branding/özelleştirme per-tenant okunmalı, `scopeKey: 'global'` kullanılmamalı.
- Kurum onaylandığında (`approve`) otomatik olarak o kurum için bir admin kullanıcı oluşturulmalı.
- Platform admin (superadmin) tüm kurumları yönetir. Kurum admin'i sadece kendi kurumunu yönetir.

## Tech Stack
- **Backend**: ASP.NET Core, PostgreSQL, EF Core
- **Desktop**: React + Tauri v2
- **Mobile**: Flutter
- **Marketing Website**: Next.js 16
- **DB**: PostgreSQL (localhost:5432, db: course_intellect)
