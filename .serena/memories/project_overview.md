## CourseIntellect — Multi-Tenant SaaS Education Platform

**Amaç**: Okullar (kurslar / dershaneler / özel eğitim kurumları) için tam donanımlı bir okul yönetim ve eğitim platformu. Her okul ayrı bir **tenant**'tır — tüm veriler tenant ID'sine scope'lanır.

**Roller**: Öğrenci (student), Öğretmen (teacher), Veli (parent), Muhasebeci (accounting), Admin (kurum yöneticisi), Superadmin (platform sahibi).

**Akış**: Tenant kayıt → onay → login → ekosistem (dersler, sınavlar, ödevler, mesajlaşma, içerik kütüphanesi, soru bankası, finans, raporlar, canlı ders).

**Repo formatı**: Monorepo. Her client ayrı bir alt klasör; backend tek başına orta noktada (.NET 8 API + PostgreSQL).

**Aktif istemciler**:
- `desktop/` — Tauri + React (CRA + Craco). Tüm rolleri kapsayan masaüstü uygulaması.
- `mobile/` — Flutter (öğrenci/veli/öğretmen mobil app, paket adı `student`).
- `frontend/` — Eski / sibling React+Tauri çalışması (desktop'a paralel; başlıca değişiklikler `desktop/` içinde yapılır).
- `courseintellectmarketingwebsite (1)/` — Next.js 16 + React 19 ile pazarlama sitesi (v0 destekli).
- `courseintellect-ai/` — sadece bir `00-rehber.md` içeriyor (AI rehber dökümanı).

**Geçmiş**: Repo ilk olarak macOS'ta `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/` altında geliştirildi; CURRENT_STATUS.md ve backend/README.md hâlâ macOS yollarına atıfta bulunuyor. Şu an Windows ortamında `c:\Users\KAYA\Desktop\Mehmet Emir KAYA\CourseIntellectProject2\CourseIntellectProject\` altında.

**Kullanıcı**: Mehmet Emir KAYA — full-stack developer, ürünü tek başına geliştiriyor (memory: user_role).

**Önemli Kural**: Tenant scope ihlali yapma — `scopeKey: 'global'` ASLA kullanılmaz, her şey tenant ID'sine scope edilir (memory: feedback_no_global_scope).
