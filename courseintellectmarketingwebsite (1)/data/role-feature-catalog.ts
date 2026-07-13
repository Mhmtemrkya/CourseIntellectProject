export type RoleKey =
  | "admin"
  | "branch-manager"
  | "administrative"
  | "finance"
  | "counselor"
  | "teacher"
  | "student"
  | "parent"
  | "cafeteria"

export type ModuleDefinition = {
  label: string
  actions: string[]
}

export const MODULE_CATALOG: Record<string, ModuleDefinition> = {
  dashboard: { label: "Ana Panel", actions: ["Rol bazlı özet ekranı", "Günlük durum ve hızlı erişimler"] },
  kpi: { label: "Kurum Özeti ve KPI", actions: ["Doluluk, tahsilat ve başarı göstergeleri", "Rapor dışa aktarma"] },
  operations: { label: "Operasyon Merkezi", actions: ["Bekleyen işler ve onaylar", "Günlük operasyon görünümü"] },
  "global-search": { label: "Kurum İçi Arama", actions: ["Öğrenci, personel, veli ve kayıtlarda arama"] },
  tasks: { label: "Görev Merkezi", actions: ["Görev oluşturma", "Personele görev atama", "Tamamlanma ve son tarih takibi"] },
  academics: { label: "Akademik Yönetim", actions: ["Akademik yıl ve dönem yönetimi", "Müfredat düzenleme"] },
  students: { label: "Öğrenci Yönetimi", actions: ["Öğrenci ekleme ve düzenleme", "Aktif/pasif durum yönetimi", "Detay dosyası görüntüleme", "Sınıfa atama ve dışa aktarma"] },
  parents: { label: "Veli Yönetimi", actions: ["Veli ekleme ve düzenleme", "Aktif/pasif hesap yönetimi", "Öğrenci-veli eşleştirme"] },
  teachers: { label: "Öğretmen Yönetimi", actions: ["Öğretmen ekleme ve düzenleme", "Aktif/pasif durum yönetimi", "Branş, sınıf ve danışman atama"] },
  classes: { label: "Sınıflar ve Gruplar", actions: ["Sınıf oluşturma ve düzenleme", "Öğrenci atama ve taşıma", "Danışman öğretmen atama", "Kapasite yönetimi"] },
  schedule: { label: "Ders Programı", actions: ["Sınıf ve öğretmen bazlı program", "Çakışma kontrolü", "Yayınlama ve PDF çıktısı"] },
  attendance: { label: "Yoklama ve Devamsızlık", actions: ["Günlük yoklama", "QR yoklama", "Geçmiş kayıt düzenleme", "Mazeret onayı", "Devamsızlık raporu"] },
  courses: { label: "Ders Yönetimi", actions: ["Ders tanımlama", "Ders bilgisi ve kapsam düzenleme"] },
  duties: { label: "Nöbet ve Görevlendirme", actions: ["Görev oluşturma", "Nöbet ve personel atama"] },
  registrations: { label: "Kayıt İşlemleri", actions: ["Öğrenci kaydı", "Personel kaydı", "Şube kaydı", "Sözleşme ve otomatik hesap oluşturma"] },
  records: { label: "İdari Kayıtlar", actions: ["Kayıt ekleme", "Düzenleme", "Arşivleme ve silme"] },
  documents: { label: "Belge Merkezi", actions: ["Belge yükleme", "Kategorileme ve arama", "İndirme ve silme"] },
  "administrative-units": { label: "İdari Birimler", actions: ["Birim oluşturma", "Birim sorumlusu ve kapsam yönetimi"] },
  approvals: { label: "Onay Akışları", actions: ["Talep inceleme", "Gerekçeli onay veya ret"] },
  "password-reset": { label: "Şifre Sıfırlama Talepleri", actions: ["Talep inceleme", "Güvenli sıfırlama işlemi"] },
  content: { label: "İçerik ve Konu Anlatımı", actions: ["PDF, video ve doküman yükleme", "Sınıfa paylaşma", "Düzenleme, indirme ve arşivleme"] },
  questions: { label: "Soru Kutusu", actions: ["Soru gönderme", "Yanıtlama", "Soru akışını kapatma"] },
  "question-bank": { label: "Soru Bankası", actions: ["Soru oluşturma", "Toplu soru yükleme", "AI ile soru üretme", "Dışa aktarma ve soru çözme"] },
  exams: { label: "Sınav Yönetimi", actions: ["Sınav oluşturma ve düzenleme", "Sınav kağıdı ve PDF", "Sonuç yayınlama", "Sınav çözme"] },
  "mock-exams": { label: "Deneme Sınavları", actions: ["Deneme oluşturma", "Sonuç aktarma", "Sınıf ve öğrenci analizi"] },
  "grade-entry": { label: "Not Girişi", actions: ["Toplu not girişi", "Notları kilitleme ve yayınlama"] },
  assignments: { label: "Ödev Yönetimi", actions: ["Ödev verme", "Teslim alma", "Değerlendirme", "Silme ve durum takibi"] },
  "live-lessons": { label: "Canlı Dersler", actions: ["Canlı ders planlama", "Ders başlatma", "Derse katılma"] },
  "study-plan": { label: "Çalışma Planı ve Rozetler", actions: ["Haftalık plan oluşturma", "Görev tamamlama", "Rozet ve motivasyon sistemi"] },
  ai: { label: "AI Öğrenme Asistanı", actions: ["AI sohbet", "Fotoğraf veya metinle soru çözümü"] },
  reports: { label: "Raporlama ve Analitik", actions: ["PDF rapor", "Haftalık gelişim raporu", "Sınav ve performans analizi"] },
  "branch-comparison": { label: "Şube Karşılaştırma", actions: ["Şubeleri KPI bazında karşılaştırma", "Şube bazlı filtreleme"] },
  guidance: { label: "Rehberlik Yönetimi", actions: ["Görüşme kayıtları", "Randevu yönetimi", "Envanter uygulama", "Bireysel çalışma planı", "Öğrenci dosyası ve raporlar"] },
  finance: { label: "Finans Paneli", actions: ["Gelir, gider ve tahsilat özeti", "Finansal risk ve vade görünümü"] },
  "student-accounts": { label: "Öğrenci Cari Hesapları", actions: ["Sözleşme, taksit ve ödeme geçmişi", "Hesap görüntüleme ve düzenleme"] },
  collections: { label: "Tahsilatlar", actions: ["Tahsilat alma", "Otomatik mahsuplaştırma", "İade", "Makbuz yazdırma"] },
  installments: { label: "Taksit Yönetimi", actions: ["Taksit planı oluşturma", "Düzenleme ve silme", "Vade takibi"] },
  "late-payments": { label: "Geciken Ödemeler", actions: ["Gecikme yaşlandırması", "Toplu hatırlatma gönderme"] },
  billing: { label: "Fatura ve Makbuz", actions: ["Fatura kesme", "Makbuz oluşturma", "İptal ve dışa aktarma"] },
  "discounts-scholarships": { label: "İndirim ve Burs", actions: ["İndirim/burs tanımlama", "Onay süreci"] },
  "collection-calendar": { label: "Tahsilat Takvimi", actions: ["Vade ve beklenen tahsilat görünümü"] },
  reconciliation: { label: "Mutabakat", actions: ["Ödeme kayıtlarını karşılaştırma", "Mutabakat çalıştırma"] },
  "bulk-actions": { label: "Toplu Finans İşlemleri", actions: ["Toplu tahsilat", "Toplu ödeme bildirimi"] },
  "overdue-rules": { label: "Gecikme Kuralları", actions: ["Kuruma özel gecikme kuralı tanımlama"] },
  salary: { label: "Maaş Yönetimi", actions: ["Maaş tanımlama", "Ödeme kaydı ve takip"] },
  "cash-report": { label: "Kasa Raporu", actions: ["Kasa hareketleri", "Dışa aktarma"] },
  ledger: { label: "Hesap Defteri", actions: ["Finans hareketleri ve filtreler", "Dışa aktarma"] },
  "finance-export": { label: "Finans Dışa Aktarım", actions: ["Excel çıktısı", "PDF çıktısı"] },
  "finance-audit-log": { label: "Finans Denetim Kaydı", actions: ["Kritik finans işlemlerinin zaman ve kullanıcı izi"] },
  "finance-detail-hub": { label: "Finans Detay Merkezi", actions: ["Öğrenci, ödeme ve hareket bazlı detay inceleme"] },
  payments: { label: "Ödemelerim", actions: ["Borç ve taksit görüntüleme", "Online ödeme"] },
  receipts: { label: "Makbuzlarım", actions: ["Ödeme makbuzlarını görüntüleme ve indirme"] },
  feedback: { label: "Geri Bildirim", actions: ["Kuruma geri bildirim gönderme", "Durum takibi"] },
  excuse: { label: "Mazeret Bildirimi", actions: ["Devamsızlık için mazeret gönderme", "Onay durumunu izleme"] },
  notifications: { label: "Duyuru ve Bildirimler", actions: ["Duyuru oluşturma", "Hedef kitle seçme", "Push bildirim", "Silme ve arşivleme"] },
  meetings: { label: "Görüşmeler", actions: ["Görüşme talebi", "Onaylama", "İptal ve zaman yönetimi"] },
  chat: { label: "Güvenli Mesajlaşma", actions: ["Mesaj gönderme", "Dosya ekleme", "Yetki kapsamlı grup sohbeti"] },
  service: { label: "Servis Takibi", actions: ["Araç, rota ve şoför yönetimi", "Canlı konum takibi"] },
  cafeteria: { label: "Yemekhane", actions: ["Haftalık menü düzenleme", "Menü yayınlama ve görüntüleme"] },
  "role-management": { label: "Özel Rol Yönetimi", actions: ["Taban rol seçme", "Modül ve işlem yetkisi düzenleme", "Personele özel rol atama"] },
  library: { label: "Kütüphane", actions: ["Katalog yönetimi", "Kitap arama", "Ödünç verme", "İade alma"] },
  "staff-hr": { label: "Personel ve İK", actions: ["Özlük dosyası", "Aktif/pasif durum yönetimi", "İzin onayı", "Zimmet", "Dışa aktarma"] },
  "audit-log": { label: "Denetim Kayıtları", actions: ["Kullanıcı, yetki, kayıt ve finans işlemlerinin tam izi", "Şube ve kategori filtresi", "Dışa aktarma"] },
  "org-units": { label: "Şubeler ve Organizasyon", actions: ["Şube/birim oluşturma", "Müdür atama", "Aktif/pasif durum ve kapsam yönetimi"] },
  rbac: { label: "Yetki Matrisi (RBAC)", actions: ["Rol-modül erişim matrisi", "Yetki düzenleme ve denetim izi"] },
}

const adminModules = [
  "dashboard", "kpi", "operations", "global-search", "tasks", "academics", "students", "parents", "teachers", "classes", "schedule", "attendance", "courses", "duties", "registrations", "records", "administrative-units", "approvals", "password-reset", "content", "questions", "question-bank", "exams", "assignments", "live-lessons", "reports", "branch-comparison", "finance", "student-accounts", "collections", "installments", "billing", "late-payments", "discounts-scholarships", "collection-calendar", "reconciliation", "bulk-actions", "overdue-rules", "salary", "cash-report", "ledger", "finance-export", "finance-audit-log", "finance-detail-hub", "notifications", "meetings", "chat", "service", "cafeteria", "role-management", "library", "staff-hr", "audit-log", "org-units", "rbac",
]

export const ROLE_CATALOG: Array<{
  key: RoleKey
  label: string
  shortLabel: string
  description: string
  scope: string
  modules: string[]
}> = [
  { key: "admin", label: "Kurum Yöneticisi", shortLabel: "Kurum", description: "Tüm şubeleri, akademik süreçleri, finansı, personeli ve yetkileri tek merkezden yönetir.", scope: "Kurum genelinde tüm şubeler ve konsolide görünüm", modules: adminModules },
  { key: "branch-manager", label: "Şube Müdürü", shortLabel: "Şube", description: "Kurum yöneticisinin operasyon gücünü yalnızca sorumlu olduğu şubenin verileri üzerinde kullanır.", scope: "Atanmış şube ile otomatik veri izolasyonu", modules: adminModules.filter((key) => key !== "branch-comparison" && key !== "role-management" && key !== "rbac") },
  { key: "administrative", label: "İdari Personel", shortLabel: "İdari", description: "Kayıt, belge, duyuru, görev, servis ve günlük okul operasyonlarını yürütür.", scope: "Yetkilendirildiği kurum veya şube", modules: ["operations", "tasks", "schedule", "duties", "records", "documents", "password-reset", "registrations", "reports", "notifications", "meetings", "chat", "service", "cafeteria", "library", "staff-hr"] },
  { key: "finance", label: "Muhasebe", shortLabel: "Finans", description: "Öğrenci cari hesaplarından maaş ve kasa raporlarına kadar finansal akışın tamamını yönetir.", scope: "Yetkili olduğu kurum/şubelerin finans verileri", modules: ["finance", "student-accounts", "collections", "installments", "late-payments", "discounts-scholarships", "billing", "collection-calendar", "reconciliation", "bulk-actions", "overdue-rules", "cash-report", "ledger", "finance-export", "finance-audit-log", "finance-detail-hub", "salary", "chat"] },
  { key: "counselor", label: "Rehberlik Öğretmeni", shortLabel: "Rehberlik", description: "Görüşme, randevu, envanter ve bireysel planları gizlilik seviyeleriyle yönetir.", scope: "Atanmış öğrenciler ve gizlilik kontrollü rehberlik dosyaları", modules: ["guidance", "library", "chat"] },
  { key: "teacher", label: "Öğretmen", shortLabel: "Öğretmen", description: "Ders, içerik, yoklama, sınav, ödev, soru ve öğrenci iletişimini tek çalışma alanında yönetir.", scope: "Atanmış dersler, sınıflar ve öğrenciler", modules: ["dashboard", "schedule", "attendance", "live-lessons", "duties", "content", "question-bank", "questions", "exams", "mock-exams", "grade-entry", "reports", "assignments", "meetings", "notifications", "chat", "library"] },
  { key: "student", label: "Öğrenci", shortLabel: "Öğrenci", description: "Derslerinden sınavlarına, çalışma planından AI asistanına kadar kişisel öğrenme alanına erişir.", scope: "Yalnızca kendi akademik verileri", modules: ["dashboard", "schedule", "study-plan", "live-lessons", "content", "question-bank", "questions", "assignments", "ai", "exams", "mock-exams", "reports", "attendance", "cafeteria", "notifications", "chat", "library"] },
  { key: "parent", label: "Veli", shortLabel: "Veli", description: "Çocuğunun akademik, finansal ve günlük okul sürecini güvenli biçimde takip eder.", scope: "Yalnızca bağlı çocukların verileri", modules: ["dashboard", "parents", "attendance", "exams", "reports", "feedback", "excuse", "payments", "receipts", "cafeteria", "meetings", "notifications", "chat", "library"] },
  { key: "cafeteria", label: "Yemekhane Sorumlusu", shortLabel: "Yemekhane", description: "Haftalık menüyü hazırlar, yayınlar ve öğrenci/veli ekranlarına ulaştırır.", scope: "Atanmış kurum veya şubenin yemek menüsü", modules: ["cafeteria"] },
]

export const MODULE_GROUPS = [
  { key: "control", label: "Yönetim ve Kontrol", modules: ["dashboard", "kpi", "operations", "global-search", "tasks", "branch-comparison", "audit-log", "org-units", "rbac", "role-management"] },
  { key: "academic", label: "Akademik Süreçler", modules: ["academics", "students", "parents", "teachers", "classes", "schedule", "attendance", "courses", "duties", "content", "questions", "question-bank", "exams", "mock-exams", "grade-entry", "assignments", "live-lessons", "study-plan", "ai", "reports", "guidance"] },
  { key: "administration", label: "İdari Operasyon", modules: ["registrations", "records", "documents", "administrative-units", "approvals", "password-reset", "staff-hr", "service", "cafeteria", "library"] },
  { key: "finance", label: "Finans ve Muhasebe", modules: ["finance", "student-accounts", "collections", "installments", "late-payments", "billing", "discounts-scholarships", "collection-calendar", "reconciliation", "bulk-actions", "overdue-rules", "salary", "cash-report", "ledger", "finance-export", "finance-audit-log", "finance-detail-hub", "payments", "receipts"] },
  { key: "communication", label: "İletişim ve Etkileşim", modules: ["notifications", "meetings", "chat", "feedback", "excuse"] },
] as const
