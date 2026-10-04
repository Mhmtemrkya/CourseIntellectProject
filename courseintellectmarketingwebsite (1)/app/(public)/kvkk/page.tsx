import { LegalDocument } from "@/components/site/legal-document"
function normalizeKvkkText(value:string){return value.replace(/\u00a0/g," ").replace(/\u00c2/g,"")}
const sections = [
  {
    id: "giris",
    title: "1. Giriş",
    content: `SchoolAsist olarak, kişisel verilerinizin güvenliği bizim için son derece önemlidir. Bu Gizlilik Politikası, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizin nasıl toplandığını, kullanıldığını, paylaşıldığını ve korunduğunu açıklamaktadır.

Bu politika, SchoolAsist platformunu (web sitesi, masaüstü ve mobil uygulamalar dahil) kullanan tüm kullanıcılar için geçerlidir.`,
  },
  {
    id: "veri-sorumlusu",
    title: "2. Veri Sorumlusu",
    content: `Veri sorumlusu olarak Maydanoz Yazılım aşağıdaki iletişim bilgileri üzerinden ulaşılabilirdir:

• E-posta: info@schoolasist.com
• Telefon: 0850 242 84 25`,
  },
  {
    id: "toplanan-veriler",
    title: "3. Toplanan Kişisel Veriler",
    content: `Hizmetlerimizi sunabilmek için aşağıdaki kişisel verileri toplamaktayız:

Kimlik Bilgileri:
• Ad, soyad
• T.C. kimlik numarası (yalnızca gerekli durumlarda)
• Doğum tarihi

İletişim Bilgileri:
• E-posta adresi
• Telefon numarası
• Adres

Eğitim Bilgileri:
• Okul ve sınıf bilgileri
• Ders programları
• Ödev ve sınav sonuçları
• Devamsızlık kayıtları

Teknik Veriler:
• IP adresi
• Cihaz bilgileri
• Çerez verileri
• Kullanım istatistikleri`,
  },
  {
    id: "isleme-amaci",
    title: "4. Kişisel Verilerin İşlenme Amaçları",
    content: `Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:

• Eğitim yönetim hizmetlerinin sunulması
• Kullanıcı hesaplarının oluşturulması ve yönetimi
• Öğrenci performansının takibi ve raporlanması
• Veli-öğretmen iletişiminin sağlanması
• Yasal yükümlülüklerin yerine getirilmesi
• Hizmet kalitesinin iyileştirilmesi
• Teknik destek sağlanması
• Güvenlik önlemlerinin alınması`,
  },
  {
    id: "veri-paylasimi",
    title: "5. Kişisel Verilerin Paylaşılması",
    content: `Kişisel verileriniz, aşağıdaki durumlarda üçüncü taraflarla paylaşılabilir:

• Eğitim kurumları (öğrenci ve veli verileri için okulun yetkili personeli)
• Yasal zorunluluklar kapsamında yetkili kamu kurum ve kuruluşları
• Hizmet sağlayıcılarımız (bulut hizmeti, ödeme işleme vb.)

Verileriniz, açık rızanız olmadan ticari amaçlarla üçüncü taraflarla paylaşılmaz.`,
  },
  {
    id: "veri-guvenligi",
    title: "6. Veri Güvenliği",
    content: `Kişisel verilerinizin güvenliğini sağlamak için aşağıdaki önlemleri almaktayız:

• Kurum ve kullanıcı rolüne göre erişim denetimi
• Parolaların geri çevrilemeyen özetlerinin saklanması
• Süreli doğrulama bağlantıları ve geçici parolalar
• Başvuru e-posta kuyruğundaki hassas içeriğin şifrelenmesi
• Halka açık formlarda güvenlik doğrulaması ve istek sınırları

Bu tedbirler, risklerin tamamen ortadan kalktığı anlamına gelmez. Hesap parolanızı üçüncü kişilerle paylaşmayın.`,
  },
  {
    id: "haklariniz",
    title: "7. KVKK Kapsamındaki Haklarınız",
    content: `KVKK'nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:

• Kişisel verilerinizin işlenip işlenmediğini öğrenme
• İşlenmişse buna ilişkin bilgi talep etme
• İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme
• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
• Eksik veya yanlış işlenmişse düzeltilmesini isteme
• KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme
• Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme
• İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme
• Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme`,
  },
  {
    id: "hesap-kurum-silme",
    title: "8. Hesap ve Kurum Silme",
    content: `Hesabınızı uygulama içinden (Ayarlar > Hesabımı Sil) silebilirsiniz. İşlem öncesinde kimliğinizi parolanızla yeniden doğrularsınız ve silmeyi açıkça onaylarsınız.

Verileriniz, hesabınız etkin olduğu (uygulamayı kullandığınız) sürece saklanır. Silme talebinden sonra 30 günlük iptal edilebilir bir bekleme süresi başlar; bu süre içinde talebi iptal edip hesabınızı geri alabilirsiniz. 30 gün dolduğunda silme otomatik ve kalıcı olarak tamamlanır. Kurum yöneticisi talebiniz platform yöneticisi tarafından; sıradan kullanıcı talepleri ise kurum yöneticisi tarafından keyfî olarak reddedilemez.

Silme tamamlandığında (talepten 30 gün sonra):
• Profil bilgileriniz, mesajlarınız, bildirimleriniz, yüklediğiniz dosyalar, profil görseliniz ve uygulama tercihleriniz kalıcı olarak silinir.
• Oturumlarınız ve bildirim cihaz kayıtlarınız iptal edilir; hesaba artık giriş yapılamaz.
• Finans (tahsilat, fatura, makbuz) ve eğitim (not, devamsızlık, sınav) kayıtlarındaki kişisel tanımlayıcılarınız (ad, kimlik no, iletişim, imza) silinir; geriye kalan tutar/sonuç satırları sizi tanımlamayan anonim kayıtlara dönüştürülür ve bu haliyle artık kişisel veri niteliği taşımaz.

Kurum (tenant) silme, kurum yöneticisinin talebi ve platform yöneticisinin onayıyla yapılır; işlem öncesinde etkilenecek kullanıcı, dosya ve kayıt sayıları gösterilir. Onaylanınca kurumdaki tüm kullanıcıların kişisel bilgileri temizlenir, erişim kapatılır ve kurum devre dışı bırakılır; finans ve eğitim kayıtları yukarıdaki esaslarla anonim saklanır. Kurum silme süreci, kullanıcıların kendi hesaplarını silme taleplerini engellemez.`,
  },
  {
    id: "cerezler",
    title: "9. Çerez Politikası",
    content: `Web sitemiz ve uygulamamız çerezler kullanmaktadır. Çerezler, aşağıdaki amaçlarla kullanılmaktadır:

Zorunlu Çerezler:
• Oturum yönetimi
• Güvenlik özellikleri

Analitik Çerezler:
• Kullanım istatistikleri
• Performans ölçümü

Tercih Çerezleri:
• Dil tercihleri
• Arayüz ayarları

Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz, ancak bu durumda bazı özellikler düzgün çalışmayabilir.`,
  },
  {
    id: "degisiklikler",
    title: "10. Politika Değişiklikleri",
    content: `Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişiklikler yapıldığında, web sitemiz ve uygulamamız üzerinden bilgilendirileceksiniz.

Son güncelleme: 1 Ekim 2026`,
  },
  {
    id: "iletisim",
    title: "11. İletişim",
    content: `KVKK kapsamındaki haklarınızı kullanmak veya sorularınız için bizimle iletişime geçebilirsiniz:

E-posta: info@schoolasist.com
Telefon: 0850 242 84 25

Başvurularınız en geç 30 gün içinde yanıtlanacaktır.`,
  },
]
export default function Page() { return <LegalDocument kind="kvkk" title="KVKK Aydınlatma Metni" introduction="SchoolAsist platformu kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni." sections={sections.map(section => ({...section,content:normalizeKvkkText(section.content)}))} /> }
