# Current Status

Aktif backend artık yalnızca:

- `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/backend/CourseIntellect.Api`

Aktif çözüm:

- `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/backend/CourseIntellect.sln`

Önemli notlar:

- Eski `CourseIntellect.WebAPI` yapısı kaldırıldı.
- Statik dosyalar artık `backend/CourseIntellect.Api/wwwroot` içinde tutuluyor.
- Mobil ve desktop istemcinin kullandığı kritik uyumluluk endpointleri `backend/CourseIntellect.Api/Controllers` içine taşındı.
- Backend build doğrulaması:
  `dotnet build backend/CourseIntellect.sln --no-restore /p:UseAppHost=false`
  sonucu temiz geçti.

Ana klasörler:

- `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/backend`
- `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/desktop`
- `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/mobile`
- `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject/frontend`
