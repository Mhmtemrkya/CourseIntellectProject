"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
  {
    id: "giris",
    title: "1. Giriş",
    content: `Bu Kullanım Şartları ("Şartlar"), CourseIntellect platformunu ("Platform") kullanımınızı düzenlemektedir. Platformu kullanarak bu Şartları kabul etmiş olursunuz.

Platform, CourseIntellect Eğitim Teknolojileri A.Ş. ("Şirket") tarafından işletilmektedir. Platform, web sitesi, masaüstü uygulamaları ve mobil uygulamaları kapsamaktadır.`,
  },
  {
    id: "tanimlar",
    title: "2. Tanımlar",
    content: `Bu Şartlarda kullanılan terimler:

• "Platform": CourseIntellect web sitesi, masaüstü ve mobil uygulamaları
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
    content: `Ücretli Hizmetler:
• Bazı özellikler ücretli paketler dahilinde sunulmaktadır
• Fiyatlar web sitemizde belirtilmektedir ve değişiklik gösterebilir
• Ödemeler güvenli ödeme altyapımız üzerinden gerçekleştirilir

İade Politikası:
• Yıllık aboneliklerde 14 gün içinde tam iade
• Aylık aboneliklerde iade yapılmamaktadır
• Teknik sorunlar nedeniyle hizmet alınamadığı durumlarda orantılı iade`,
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

E-posta: legal@courseintellect.com
Adres: Levent, Büyükdere Cad. No:123, 34330 Beşiktaş/İstanbul
Telefon: +90 (212) 555 0123

Son güncelleme: 15 Ocak 2026`,
  },
]

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState("giris")

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      }))

      for (const section of sectionElements) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect()
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Kullanım Şartları</h1>
            <p className="text-muted-foreground">Son güncelleme: 15 Ocak 2026</p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex gap-12 max-w-6xl mx-auto">
            {/* Sticky TOC */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24">
                <h3 className="text-sm font-semibold text-foreground mb-4">İçindekiler</h3>
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" })
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                        activeSection === section.id
                          ? "bg-accent/10 text-accent font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                      )}
                    >
                      <ChevronRight
                        className={cn("w-4 h-4 transition-transform", activeSection === section.id && "rotate-90")}
                      />
                      <span className="truncate">{section.title}</span>
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="prose prose-gray max-w-none">
                {sections.map((section, index) => (
                  <motion.div
                    key={section.id}
                    id={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: index * 0.05 }}
                    className="mb-12 scroll-mt-24"
                  >
                    <h2 className="text-xl font-bold text-foreground mb-4">{section.title}</h2>
                    <div className="text-muted-foreground whitespace-pre-line leading-relaxed">{section.content}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
