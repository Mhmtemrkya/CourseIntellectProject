import type { ShowcaseAsset } from "./showcase-assets"

export type HighlightTopic = "learning" | "communication" | "finance" | "progress" | "operations"
const topics: Partial<Record<ShowcaseAsset, HighlightTopic>> = {
  "home-messages": "communication", "veli-messages": "communication", "personel-announcements": "communication",
  "muhasebe-plan": "finance", "muhasebe-payment": "finance", "platform-finance": "finance", "yonetici-reports": "finance",
  "platform-student": "progress", "yonetici-branches": "operations", "personel-tasks": "operations",
}
export function highlightTopic(asset: ShowcaseAsset): HighlightTopic { return topics[asset] || "learning" }
const headlines: Partial<Record<ShowcaseAsset, string>> = {
  "ogretmen-materials": "İçerik hazır.\nDers daha güçlü.",
  "ogretmen-homework": "Her çalışma.\nTakibi kolay.",
  "ogrenci-homework": "Sıradaki hedef.\nÖnünde.",
  "ogrenci-schedule": "Günün planı.\nHer zaman yanında.",
  "veli-lessons": "Günün her adımı.\nİçiniz daha rahat.",
  "muhasebe-payment": "Kaydı tamamlayın.\nAkışı izleyin.",
  "yonetici-branches": "Bütün şubeler.\nBir arada.",
  "yonetici-reports": "Büyük resim.\nBütün ayrıntılar.",
  "personel-tasks": "Günün işleri.\nBirlikte ilerler.",
  "personel-announcements": "Kurumun sesi.\nHerkese ulaşır.",
}
export function highlightHeadline(asset: ShowcaseAsset): string { return headlines[asset] || productHighlights[highlightTopic(asset)].headline }
export const productHighlights = {
  learning: { label: "Eğitim akışı", headline: "Güne hazır.\nHer derse bağlı.", points: [
    ["Programınız bir arada.", "Ders programını, sınıfları ve ilgili ders kayıtlarını aynı çalışma alanından takip edin."],
    ["Öğrenmenin devamı.", "Materyallere ve ödevlere rolünüzün izin verdiği alanlardan ulaşın."],
    ["Gelişim görünür.", "Yoklama, teslim ve değerlendirme bilgileriyle öğrencinin eğitim sürecini izleyin."],
  ] },
  communication: { label: "Kurum iletişimi", headline: "Doğru bilgi.\nDoğru kişide.", points: [
    ["Güncel duyurular.", "Kurumun paylaştığı duyurulara ve size ait bildirimlere tek yerden ulaşın."],
    ["İletişim kopmaz.", "Rolünüzün izin verdiği mesajlaşma alanlarından kurum ve eğitim ekibiyle iletişim kurun."],
    ["Öğrencinizin yanında.", "Veli çalışma alanından ders, devam ve öğrenciye ait güncel bilgileri takip edin."],
  ] },
  finance: { label: "Finansal görünüm", headline: "Her hareket.\nDaha net.", points: [
    ["Ödemeler kayıt altında.", "Tahsilatları ve ilgili öğrenci hesap hareketlerini yetkiniz dahilinde yönetin."],
    ["Vadeleri takip edin.", "Taksit planlarını, ödenen ve kalan tutarları, gecikmiş kayıtları inceleyin."],
    ["Bütüne bakın.", "Gelir, gider ve finans raporlarıyla kurumunuzun mali akışını izleyin."],
  ] },
  progress: { label: "Öğrenci gelişimi", headline: "Bir öğrencinin\nbütün yolculuğu.", points: [
    ["Günlük akış.", "Öğrencinin ders ve devam bilgilerine ilgili rolün çalışma alanından ulaşın."],
    ["Çalışmalar bir arada.", "Ödevleri, teslimleri ve değerlendirmeleri aynı eğitim sürecinin parçası olarak takip edin."],
    ["Gelişimin ayrıntıları.", "Rolünüzün erişebildiği sonuç ve öğrenci raporlarını inceleyin."],
  ] },
  operations: { label: "Kurum yönetimi", headline: "Birlikte çalışan\nbir kurum.", points: [
    ["Ekibinize hakim olun.", "Size tanımlanan erişimler kapsamında şube, ekip ve kullanıcı bilgilerini yönetin."],
    ["Günün işleri düzenli.", "Görevleri, kurum duyurularını ve günlük çalışma akışını takip edin."],
    ["Yetkiler belirli.", "Kurumunuzda her kullanıcı kendisine tanımlanan modül ve işlem izinleriyle çalışır."],
  ] },
} as const
