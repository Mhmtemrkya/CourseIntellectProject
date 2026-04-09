"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Shield, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

function normalizeKvkkText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\u00c2/g, "")
}

const sections = [
  {
    id: "giris",
    title: "1. Giriş",
    content: `CourseIntellect olarak, kişisel verilerinizin güvenliği bizim için son derece önemlidir. Bu Gizlilik Politikası, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizin nasıl toplandığını, kullanıldığını, paylaşıldığını ve korunduğunu açıklamaktadır.

Bu politika, CourseIntellect platformunu (web sitesi, masaüstü ve mobil uygulamalar dahil) kullanan tüm kullanıcılar için geçerlidir.`,
  },
  {
    id: "veri-sorumlusu",
    title: "2. Veri Sorumlusu",
    content: `Veri sorumlusu olarak CourseIntellect Eğitim Teknolojileri A.Ş. aşağıdaki iletişim bilgileri üzerinden ulaşılabilirdir:

• Adres: Levent, Büyükdere Cad. No:123, 34330 Beşiktaş/İstanbul
• E-posta: kvkk@courseintellect.com
• Telefon: +90 (212) 555 0123`,
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

Teknik Önlemler:
• 256-bit SSL şifreleme
• Güvenli veri merkezleri
• Düzenli güvenlik denetimleri
• İzinsiz erişim önleme sistemleri

Organizasyonel Önlemler:
• Personel gizlilik eğitimleri
• Erişim yetkilendirme politikaları
• Veri işleme sözleşmeleri`,
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
    id: "cerezler",
    title: "8. Çerez Politikası",
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
    title: "9. Politika Değişiklikleri",
    content: `Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişiklikler yapıldığında, web sitemiz ve uygulamamız üzerinden bilgilendirileceksiniz.

Son güncelleme: 15 Ocak 2026`,
  },
  {
    id: "iletisim",
    title: "10. İletişim",
    content: `KVKK kapsamındaki haklarınızı kullanmak veya sorularınız için bizimle iletişime geçebilirsiniz:

E-posta: kvkk@courseintellect.com
Adres: Levent, Büyükdere Cad. No:123, 34330 Beşiktaş/İstanbul
Telefon: +90 (212) 555 0123

Başvurularınız en geç 30 gün içinde yanıtlanacaktır.`,
  },
]

export default function PrivacyPage() {
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
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Gizlilik Politikası ve KVKK</h1>
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
                    <div className="text-muted-foreground whitespace-pre-line leading-relaxed">
                      {normalizeKvkkText(section.content)}
                    </div>
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
