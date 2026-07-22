# SchoolAsist Otomatik Güncelleme

Masaüstü uygulaması açılışta GitHub Releases üzerindeki `latest.json` dosyasını kontrol eder. Daha yeni bir SemVer sürümü varsa kullanıcıya güncelleme penceresi gösterilir. Paket indirilir, Tauri imzası doğrulanır, kurulur ve uygulama yeniden başlatılır.

## İlk kurulum

GitHub deposunda aşağıdaki Actions secret değerleri tanımlanmalıdır:

- `TAURI_SIGNING_PRIVATE_KEY`: `desktop/.tauri/courseintellect.key` dosyasının tamamı.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Anahtar parolası; mevcut yerel anahtar parolasız üretildiği için boş bırakılabilir.
- macOS dağıtımı için `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` ve `APPLE_TEAM_ID`. `APPLE_CERTIFICATE`, private key içeren `Developer ID Application` `.p12` dosyasının Base64 karşılığı olmalıdır; `APPLE_PASSWORD` normal hesap parolası değil uygulamaya özel paroladır.
- Windows üretim dağıtımında SmartScreen güveni için kod imzalama sertifikası ayrıca yapılandırılmalıdır.

Özel anahtar `.gitignore` kapsamındadır ve kesinlikle repoya eklenmemelidir. Güvenli bir parola yöneticisine yedeklenmelidir; kaybolursa mevcut kurulumlar yeni paketlerin imzasını doğrulayamaz.

## Yeni sürüm yayınlama

Sürüm numarasını mevcut sürümden büyük seçin ve etiketi gönderin:

```bash
git tag desktop-v1.1.0
git push origin desktop-v1.1.0
```

GitHub Actions macOS universal ve Windows NSIS paketlerini, imzaları ve `latest.json` dosyasını aynı release altında üretir. Uygulamayı kullanan kişiler bir sonraki açılışta güncellemeyi görür.

Yerelde sürüm dosyalarını birlikte güncellemek için:

```bash
cd desktop
npm run desktop:version -- 1.1.0
```

## Önemli

- macOS otomatik güncelleme için uygulamanın Developer ID ile imzalanmış ve notarize edilmiş olması gerekir.
- `npm run desktop:build:prod` imza/notarization bilgileri eksikse artık hata verir; müşteriye yanlışlıkla Gatekeeper tarafından engellenecek DMG çıkarmaz. Yalnızca yerel test için gerekirse açıkça `npm run desktop:build:unsigned` kullanılabilir ve bu paket dağıtılmamalıdır.
- Windows güncellemesi NSIS `passive` modunda çalışır; kurulum sırasında uygulama otomatik kapanır ve işlem bitince yeniden açılır.
- GitHub deposu/Release varlıkları anonim indirilemiyorsa updater endpointi erişilebilen bir CDN veya backend adresine taşınmalıdır.
