import { LegalDocument } from "@/components/site/legal-document"
const sections = [
  {
    id: "giris",
    title: "1. Giriş",
    content: `Bu Kullanım Şartları ("Şartlar"), SchoolAsist platformunu ("Platform") kullanımınızı düzenlemektedir. Platformu kullanarak bu Şartları kabul etmiş olursunuz.

Platform, Maydanoz Yazılım ("Şirket") tarafından işletilmektedir. Platform, web sitesi, masaüstü uygulamaları ve mobil uygulamaları kapsamaktadır.

Kurum başvurusu şu anda paket seçmeden ücretsiz yapılır. E-posta doğrulaması ve platform yöneticisinin onayından sonra kurum kullanımı başlar. Kurum erişimi kapatıldığında o kuruma bağlı kullanıcıların erişimi de engellenir.`,
  },
  {
    id: "tanimlar",
    title: "2. Tanımlar",
    content: `Bu Şartlarda kullanılan terimler:

• "Platform": SchoolAsist web sitesi, masaüstü ve mobil uygulamaları
• "Kullanıcı": Platformu kullanan öğretmen, öğrenci, veli veya yönetici
• "Hesap": Kullanıcının Platforma erişim için oluşturduğu kullanıcı hesabı
• "İçerik": Platform üzerinde paylaşılan metin, görsel, video ve diğer materyaller
• "Hizmet": Platform aracılığıyla sunulan eğitim yönetim hizmetleri`,
  },
  {
    id: "hesap-olusturma",
    title: "3. Hesap Oluşturma ve Güvenlik",
    content: `Hesap Oluşturma:
• Platformu kullanmak için geçerli bir hesap oluşturmanız gerekmektedir
• Hesap oluştururken doğru ve güncel bilgiler sağlamalısınız
• 18 yaşından küçük kullanıcılar, ebeveyn veya veli onayı ile hesap oluşturabilir

Hesap Güvenliği:
• Hesap bilgilerinizi gizli tutmak sizin sorumluluğunuzdadır
• Hesabınızda gerçekleşen tüm işlemlerden siz sorumlusunuz
• Yetkisiz erişim şüphesi durumunda derhal bizi bilgilendirmelisiniz`,
  },
  {
    id: "kullanim-kurallari",
    title: "4. Kullanım Kuralları",
    content: `Platformu kullanırken aşağıdaki kurallara uymalısınız:

Yapılması Gerekenler:
• Platformu yalnızca yasal amaçlarla kullanmak
• Diğer kullanıcılara saygılı davranmak
• Telif haklarına ve fikri mülkiyet haklarına uymak
• Kişisel verileri korumak

Yasaklanan Davranışlar:
• Zararlı yazılım veya virüs yaymak
• Diğer kullanıcıların hesaplarına izinsiz erişim
• Platform güvenliğini tehlikeye atacak eylemler
• Spam veya istenmeyen içerik paylaşımı
• Yasadışı, tehditkar veya taciz edici içerik paylaşımı`,
  },
  {
    id: "icerik-politikasi",
    title: "5. İçerik Politikası",
    content: `Kullanıcı İçeriği:
• Platform üzerinde paylaştığınız içeriklerden siz sorumlusunuz
• İçeriklerinizin telif hakkı size aittir, ancak Şirket'e sınırlı lisans vermiş olursunuz
• Uygunsuz içerikler önceden haber verilmeksizin kaldırılabilir

Şirket İçeriği:
• Platform üzerindeki tüm Şirket içerikleri telif hakkı ile korunmaktadır
• İçerikleri izinsiz kopyalamak, dağıtmak veya değiştirmek yasaktır`,
  },
  {
    id: "gizlilik",
    title: "6. Gizlilik",
    content: `Kişisel verilerinizin toplanması, kullanılması ve korunması hakkında detaylı bilgi için Gizlilik Politikamızı inceleyiniz.

Platformu kullanarak, Gizlilik Politikamızda belirtilen şekilde kişisel verilerinizin işlenmesini kabul etmiş olursunuz.`,
  },
  {
    id: "odeme-iade",
    title: "7. Ödeme ve İade Politikası",
    content: `Kurum başvurusu ve mevcut kullanım için paket seçimi veya ödeme istenmez. Başvurular e-posta doğrulamasından sonra platform yöneticisi tarafından değerlendirilir.

İleride ücretli bir hizmet sunulursa kapsamı, fiyatı ve uygulanacak koşullar kullanım öncesinde ayrıca bildirilir. Bu başvuru üzerinden ödeme veya abonelik başlatılmaz.`,
  },
  {
    id: "sorumluluk-siniri",
    title: "8. Sorumluluk Sınırı",
    content: `Şirket, aşağıdaki durumlardan sorumlu tutulamaz:

• Platformun kesintisiz veya hatasız çalışacağının garantisi
• Kullanıcıların paylaştığı içerikler
• Üçüncü taraf hizmetleri veya web siteleri
• Kullanıcıların yaşadığı veri kayıpları (kendi ihmallerinden kaynaklanan)
• Mücbir sebepler (doğal afetler, savaş, hükümet kararları vb.)

Şirketin toplam sorumluluğu, son 12 ayda ödediğiniz toplam ücretle sınırlıdır.`,
  },
  {
    id: "fesih",
    title: "9. Hesap Feshi",
    content: `Kullanıcı Tarafından Fesih:
• Hesabınızı istediğiniz zaman kapatabilirsiniz
• Hesap kapatıldığında verileriniz 30 gün içinde silinir

Şirket Tarafından Fesih:
• Kullanım şartlarının ihlali durumunda hesabınız askıya alınabilir veya kapatılabilir
• Ciddi ihlallerde önceden bildirim yapılmaksızın hesap kapatılabilir`,
  },
  {
    id: "degisiklikler",
    title: "10. Şartlarda Değişiklik",
    content: `Bu Kullanım Şartları zaman zaman güncellenebilir. Önemli değişiklikler yapıldığında:

• E-posta ile bilgilendirileceksiniz
• Platform üzerinde duyuru yapılacaktır
• Değişiklikler yayınlandıktan 30 gün sonra yürürlüğe girer

Değişiklikleri kabul etmiyorsanız, yürürlük tarihinden önce hesabınızı kapatabilirsiniz.`,
  },
  {
    id: "uyusmazlik",
    title: "11. Uyuşmazlık Çözümü",
    content: `Bu Şartlar Türkiye Cumhuriyeti yasalarına tabidir.

Uyuşmazlıkların çözümünde İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.

Şirket, tüketici haklarını korumayı taahhüt eder ve uyuşmazlıkların öncelikle dostane yollarla çözülmesini tercih eder.`,
  },
  {
    id: "iletisim",
    title: "12. İletişim",
    content: `Bu Kullanım Şartları hakkında sorularınız için:

E-posta: info@schoolasist.com
Telefon: 0850 242 84 25

Son güncelleme: 15 Ocak 2026`,
  },
]
export default function Page() { return <LegalDocument kind="terms" title="Kullanım Koşulları" introduction="SchoolAsist platformunun kullanımı, hesaplar ve kurum onayına ilişkin koşullar." sections={sections} /> }
