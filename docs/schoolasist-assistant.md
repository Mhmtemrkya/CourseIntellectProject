# SchoolAsist Asistan — v1

SchoolAsist Asistan, harici yapay zekâya veri göndermeyen kural tabanlı bir ilk sürümdür. Kullanıcı metni doğrudan SQL'e dönüştürülmez. Akış; normalize edilmiş mesaj, tanımlı intent, rol/kapsam kontrolü, tenant/branch filtreli EF Core sorgusu ve yapılandırılmış cevap şeklindedir.

## Yapılandırma

```json
{
  "Assistant": {
    "Provider": "RuleBased",
    "EnableExternalAi": false,
    "RateLimit": { "PermitPerMinute": 30 }
  }
}
```

Harici sağlayıcı v1'de kullanılmaz. `EnableExternalAi=false` tutulmalıdır.

## Endpointler

- `POST /api/assistant/conversations`
- `GET /api/assistant/conversations`
- `GET /api/assistant/conversations/{id}`
- `GET /api/assistant/conversations/{id}/messages`
- `DELETE /api/assistant/conversations/{id}`
- `POST /api/assistant/messages`
- `GET /api/assistant/suggestions`
- `POST /api/assistant/actions`

Örnek mesaj:

```json
{
  "conversationId": null,
  "message": "Ahmet Yılmaz 10-A öğrencisinin devamsızlığını göster",
  "clientMessageId": "c70ce3b1-e7ab-4df2-b497-e826b8cbe48f",
  "context": { "currentRoute": "/dashboard", "selectedStudentId": null }
}
```

`context` yalnız kullanıcı deneyimi ipucudur; yetki kaynağı değildir. Seçilen öğrenci her action çağrısında yeniden doğrulanır.

## Erişim matrisi

| Rol | Akademik | Finans | Servis | Sürücü kursu | Kapsam |
|---|---:|---:|---:|---:|---|
| Admin / Şube Müdürü | Evet | Evet | Evet | Evet | Tenant ve etkin branch |
| Öğretmen | Evet | Hayır | Gerektiğinde | Evet | Ders programındaki sınıflar |
| İdari | Evet | Rol/paket kadar | Evet | Evet | Tenant ve etkin branch |
| Muhasebe | Hayır | Evet | Hayır | Finans özeti | Tenant ve etkin branch |
| Öğrenci / Kursiyer | Kendi | İzinli özet | Kendi | Kendi | JWT user → StudentProfile |
| Veli | Bağlı çocuklar | Bağlı çocuklar | Bağlı çocuklar | Bağlı çocuklar | ParentUserId ilişkisi |

Özel rol ve kurum paketleri mevcut `IEntitlementService` üzerinden ayrıca daraltılır. Öğrenci, veli ve öğretmen ilişkisel kapsamları tool çalışmadan önce uygulanır. TC cevaplarda gösterilmez; audit kayıtlarında mesaj veya TC tutulmaz.

## Veri ve migration

Migration: `20260720092814_AddSchoolAsistAssistant`

Tablolar:

- `assistant_conversations`
- `assistant_messages`
- `assistant_audit_logs`

Migration production başlangıcındaki mevcut otomatik migration akışıyla veya `scripts/apply_production_migrations.sh` üzerinden uygulanır.

## Çalıştırma ve doğrulama

```bash
dotnet build backend/CourseIntellect.sln
dotnet test backend/CourseIntellect.Tests/CourseIntellect.Tests.csproj
cd desktop && npm run build
cd mobile && flutter analyze
```

Masaüstünde tüm oturum açmış roller sağ alttaki `Asistan` drawer'ını kullanır. Mobilde öğrenci hızlı işlemleri; veli/öğretmen floating action; yönetici/idari/muhasebe AppBar; sürücü kursiyeri ana kart üzerinden erişir.

## Gelecek LLM entegrasyonu

İkinci aşamada yeni provider yalnız intent çıkarımı ve doğal cevap üretimi için eklenmelidir. Veri sorgusu, authorization ve tool registry backend'de kalmalı; LLM'ye SQL, DbContext, token veya tenant dışı ham veri verilmemelidir. Provider configuration ile açılmalı ve varsayılan `RuleBased` korunmalıdır.
