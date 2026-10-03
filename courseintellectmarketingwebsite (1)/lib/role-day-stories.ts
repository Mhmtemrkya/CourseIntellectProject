import type { RoleId } from "./site-experience-data"

type Phase = { label: string; title: string; description: string; rows: readonly [string, string, string][] }
export type RoleDayStory = { accent: string; journey: string; phases: readonly Phase[] }
const phase = (label: string, title: string, description: string, rows: Phase["rows"]): Phase => ({ label, title, description, rows })

export const roleDayStories: Record<RoleId, RoleDayStory> = {
  yonetici: { accent: "Günü birlikte yönetin.", journey: "Bir gün. Birbiriyle bağlı kararlar.", phases: [
    phase("Sabah", "Güne aynı planla başlayın.", "Kurumun programını, ekiplerin görevlerini ve günün önceliklerini birlikte görün.", [["Ders programı", "Demo sınıfların günlük planı", "Hazır"], ["Görev merkezi", "Ekibin günlük görevleri", "Planlandı"], ["Kurum özeti", "Günün ortak görünümü", "Güncel"]]),
    phase("Ders saatinde", "Her gelişme, yerli yerinde.", "Ders, yoklama ve ekip kayıtlarını yetkiniz kapsamında takip edin. Günün akışını görün, gerektiğinde aksiyon alın.", [["Demo 1", "Matematik · 5-A", "Ders sürüyor"], ["Demo 2", "Türkçe · 6-B", "Yoklama hazır"], ["Demo 3", "Fen Bilimleri · 7-A", "Planlandı"]]),
    phase("Gün sonunda", "Günün bütününü görün.", "Akademik raporları, finans kayıtlarını ve bekleyen onayları aynı yönetim alanında inceleyin.", [["Akademik rapor", "Ders ve devam kayıtları", "Hazır"], ["Finansal görünüm", "Tahsilat ve gider özeti", "Güncel"], ["Onaylar", "Yetkinize ait işlemler", "İncelenecek"]]),
  ] },
  ogretmen: { accent: "Gününüz tek bir akışta.", journey: "Hazırlık, ders ve gelişim. Birlikte.", phases: [
    phase("Hazırlık", "Ders başlamadan, planınız hazır.", "Ders programınızı, içeriklerinizi ve soru hazırlığını kendi çalışma alanınızda düzenleyin.", [["Matematik", "Demo sınıf · Ders planı", "Hazır"], ["Konu anlatımı", "Ders materyalleri", "İncelenecek"], ["Soru bankası", "Konuya ait sorular", "Güncel"]]),
    phase("Ders saatinde", "Derse odaklanın. Akışı takip edin.", "Kendi derslerinizde yoklamayı kaydedin, öğrencilerinizi ve size atanan görevleri takip edin.", [["Demo 1", "Matematik · Ders akışı", "Ders sürüyor"], ["Yoklama", "Sorumlu olduğunuz sınıf", "Kaydedildi"], ["Görevlerim", "Günlük görev ve nöbet", "Planlandı"]]),
    phase("Değerlendirme", "Her çalışmanın karşılığını görün.", "Ödev teslimlerini, sınav kayıtlarını ve öğrenci gelişimini yetkiniz kapsamında değerlendirin.", [["Ödevler", "Demo 1 · Teslim durumu", "Teslim edildi"], ["Not girişi", "Değerlendirme kayıtları", "İncelenecek"], ["Raporlar", "Öğrenci gelişimi", "Hazır"]]),
  ] },
  veli: { accent: "Bilgi hep yanınızda.", journey: "Çocuğunuzun günü. Adım adım.", phases: [
    phase("Günün planı", "Bugünün programını görün.", "Hesabınıza bağlı çocuğunuzun ders ve devam bilgilerini tek görünümde takip edin.", [["Demo 1", "Bugünün ders programı", "Hazır"], ["Ders ve devam", "Paylaşılan devam kaydı", "Güncel"], ["Kurum duyurusu", "Günlük bilgilendirme", "Yeni"]]),
    phase("Gün içinde", "Doğru bilgi, tam yerinde.", "Kurumun paylaştığı bildirimlere ve yetkinize açık öğretmen iletişimine ulaşın.", [["Duyurular", "Kurumdan gelen bilgi", "Yeni"], ["Mesajlar", "Öğretmenle iletişim", "Güncel"], ["Görüşmeler", "Paylaşılan görüşme planı", "Planlandı"]]),
    phase("Günün özeti", "Gelişimi birlikte takip edin.", "Paylaşılan ödev, sınav ve haftalık raporları inceleyin. Her çocuk için bilgiler ayrı görünür.", [["Ödev takibi", "Demo 1 · Çalışmaları", "Güncel"], ["Sınav sonuçları", "Paylaşılan değerlendirme", "Hazır"], ["Haftalık rapor", "Gelişim ve devam özeti", "İncelenecek"]]),
  ] },
  ogrenci: { accent: "Her adımın bir arada.", journey: "Planla. Çalış. Gelişimini gör.", phases: [
    phase("Planla", "Bugünkü hedefini seç.", "Kişisel ders programını ve sana atanan çalışmaları gör, gününü planla.", [["Derslerim", "Bugünün programı", "Hazır"], ["Ödevlerim", "Sana atanan çalışmalar", "Güncel"], ["Duyurular", "Kurumdan gelen bilgi", "Yeni"]]),
    phase("Çalış", "Çalışmalarına odaklan.", "Ders içeriklerini incele, ödevlerini tamamla ve yetkili olduğun sınavlara ulaş.", [["Matematik", "Demo çalışma · Konu anlatımı", "Hazır"], ["Ödev", "Atanan çalışma", "Çalışılıyor"], ["Sınavlar", "Sana açılan sınavlar", "Planlandı"]]),
    phase("Değerlendir", "İlerlemeni yakından gör.", "Paylaşılan sonuçlarını ve geri bildirimlerini incele, sonraki çalışmanı planla.", [["Sınav sonuçlarım", "Paylaşılan sonuçlar", "Hazır"], ["Ödev teslimi", "Tamamlanan çalışma", "Teslim edildi"], ["Gelişim", "Paylaşılan geri bildirim", "Güncel"]]),
  ] },
  muhasebe: { accent: "Günün hesabı bir arada.", journey: "Kayıttan rapora. Her adım net.", phases: [
    phase("Günün planı", "Ödeme akışını önceden görün.", "Vadesi gelen taksitleri, cari hesapları ve tahsilat takvimini takip edin.", [["Tahsilat takvimi", "Günün ödeme planı", "Hazır"], ["Demo 1", "Cari hesap ve taksitler", "İncelenecek"], ["Geciken ödemeler", "Vadesi geçen kayıtlar", "Güncel"]]),
    phase("Kayıt", "Her hareketin kaydını koruyun.", "Yetkiniz dahilinde tahsilat, gider, belge ve iade işlemlerini yönetin.", [["Tahsilat", "Demo 1 · Ödeme kaydı", "Kaydedildi"], ["Makbuz", "İlgili ödeme belgesi", "Hazır"], ["Gider", "Kurumun gider kaydı", "İncelenecek"]]),
    phase("Rapor", "Günün hesabını tamamlayın.", "Kasa raporu, hesap defteri ve mutabakat kayıtlarını birlikte inceleyin.", [["Kasa raporu", "Dönemin gelir ve giderleri", "Hazır"], ["Hesap defteri", "Kayıtlı hareketler", "Güncel"], ["Mutabakat", "Karşılaştırılan kayıtlar", "İncelenecek"]]),
  ] },
  personel: { accent: "Günlük işler bir arada.", journey: "Görevden iletişime. Düzenli bir gün.", phases: [
    phase("Plan", "Günün görevlerini görün.", "Size atanan görevleri, duyuruları ve erişiminize açık günlük kayıtları inceleyin.", [["Görevlerim", "Atanan günlük işler", "Planlandı"], ["Duyurular", "Kurum bilgilendirmeleri", "Yeni"], ["Günlük akış", "Birim kayıtları", "Güncel"]]),
    phase("Görev", "Ekibinizle aynı akışta.", "Tanımlanan izinleriniz kapsamında görevleri ve kurum işlemlerini takip edin.", [["Demo görev", "Sorumlu olduğunuz işlem", "Çalışılıyor"], ["Birim kayıtları", "Size açılan kayıtlar", "Güncel"], ["Mesajlar", "Kurum içi iletişim", "Yeni"]]),
    phase("Takip", "İşlerin durumunu kaybetmeyin.", "Tamamlanan görevleri ve kalan işleri izleyin; kişisel çalışma alanınızı düzenleyin.", [["Görev takibi", "Günlük ilerleme", "Güncel"], ["Kayıtlar", "Yetkinize açık bilgiler", "İncelenecek"], ["Profil", "Kişisel tercihler", "Hazır"]]),
  ] },
  rehberlik: { accent: "Her adım özenle takipte.", journey: "Görüşmeden gelişime. Özenli bir süreç.", phases: [
    phase("Planlama", "Görüşmelere hazırlıklı başlayın.", "Randevuları ve yetkinize açık öğrenci dosyalarını birlikte inceleyin.", [["Randevular", "Günün görüşme planı", "Planlandı"], ["Demo 1", "Yetkili öğrenci dosyası", "İncelenecek"], ["Çalışma planı", "Paylaşılan program", "Hazır"]]),
    phase("Görüşme", "Her öğrenciye ayrılan özel alan.", "Görüşme kayıtlarını ve çalışma planlarını yalnızca tanımlanan erişim kapsamında yönetin.", [["Demo görüşme", "Randevu durumu", "Planlandı"], ["Çalışma planı", "Öğrenciye ait plan", "Güncel"], ["Envanterler", "Yetkinize açık araçlar", "Hazır"]]),
    phase("Takip", "Sürecin bütününü takip edin.", "Öğrenci gelişimini ve planların durumunu erişiminiz kapsamında değerlendirin.", [["Gelişim takibi", "Yetkili öğrenci kayıtları", "Güncel"], ["Görüşmeler", "Kayıtlı görüşme akışı", "İncelenecek"], ["Çalışma planı", "Sonraki adımlar", "Planlandı"]]),
  ] },
  "sube-muduru": { accent: "Günü birlikte yönetin.", journey: "Şubenizin günü. Bütün ayrıntılarıyla.", phases: [
    phase("Sabah", "Şubenizin planı hazır.", "Kendi şubenizin ders, ekip ve günlük operasyon kayıtlarını birlikte görün.", [["Demo Şube", "Günlük program", "Hazır"], ["Ekip", "Şubenin görev planı", "Planlandı"], ["Ders programı", "Şubeye ait dersler", "Güncel"]]),
    phase("Gün içinde", "Şubenizin akışını takip edin.", "Akademik ve ekip işlemlerini kendi şubenizin veri kapsamında yönetin.", [["Dersler", "Şubenin ders akışı", "Ders sürüyor"], ["Yoklama", "Şube devam kayıtları", "Güncel"], ["Ekip", "Şube görevleri", "Planlandı"]]),
    phase("Gün sonunda", "Şubenizin özetini görün.", "Şubeye ait raporları, finans kayıtlarını ve yetkinize açık işlemleri inceleyin.", [["Şube raporu", "Akademik ve günlük özet", "Hazır"], ["Finansal görünüm", "Şubeye ait kayıtlar", "Güncel"], ["İşlem takibi", "Tanımlanan yetkiler", "İncelenecek"]]),
  ] },
  yemekhane: { accent: "Günün menüsü bir arada.", journey: "Menüden besin bilgisine. Planlı öğünler.", phases: [
    phase("Menü", "Haftanın planını hazırlayın.", "Haftalık menüyü ve erişiminize açık yemek programı işlemlerini düzenleyin.", [["Haftalık menü", "Günlere göre yemek planı", "Hazır"], ["Öğünler", "Günün yemek programı", "Planlandı"], ["Menü bilgisi", "Paylaşılan içerik", "Güncel"]]),
    phase("Öğün", "Öğünün bütün ayrıntılarını görün.", "Yemek içeriklerini, besin değerlerini ve alerjen bilgilerini aynı görünümde takip edin.", [["Günün menüsü", "Paylaşılan yemekler", "Hazır"], ["Besin değerleri", "Kayıtlı besin bilgileri", "Güncel"], ["Alerjenler", "Menünün alerjen bilgileri", "İncelenecek"]]),
    phase("Paylaşım", "Menü bilgileri erişilebilir olsun.", "Kurumun paylaştığı yemek programını ve güncellenen menü bilgilerini takip edin.", [["Yemek programı", "Kurumun paylaştığı menü", "Güncel"], ["Öğün bilgisi", "Yayınlanan içerik", "Hazır"], ["Alerjen bilgisi", "Paylaşılan bilgiler", "Güncel"]]),
  ] },
  "servis-soforu": { accent: "Her adım aynı rotada.", journey: "Rotadan varışa. Takip edilen bir yolculuk.", phases: [
    phase("Hazırlık", "Atanan rotanızı görün.", "Size atanan rotayı, öğrenci alım listesini ve sefer bilgilerini mobilde inceleyin.", [["Demo rota", "Atanan güzergâh", "Hazır"], ["Öğrenci listesi", "Seferin alım listesi", "İncelenecek"], ["Sefer bilgisi", "Günün yolculuk planı", "Planlandı"]]),
    phase("Sefer", "Yolculuğun durumunu takip edin.", "Atanan seferin durumunu ve konum paylaşımını kurumun tanımladığı kapsamda yönetin.", [["Sefer durumu", "Atanan yolculuk", "Sefer sürüyor"], ["Öğrenci alımı", "Güncel alım listesi", "Güncel"], ["Konum paylaşımı", "Sefer kapsamında", "Etkin"]]),
    phase("Varış", "Yolculuğun kaydını tamamlayın.", "Seferin bitiş durumunu ve ilgili öğrenci listesini kontrol edin.", [["Varış", "Atanan seferin son durumu", "Kaydedildi"], ["Öğrenci listesi", "İlgili sefer kayıtları", "Güncel"], ["Sefer durumu", "Yolculuk özeti", "Tamamlandı"]]),
  ] },
}
