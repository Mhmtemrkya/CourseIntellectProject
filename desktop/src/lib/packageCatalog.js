/**
 * Paket Özellik Kataloğu — tek doğruluk kaynağı.
 *
 * Platform admin, Paketler sayfasında her pakete rol → sayfa (modül) → işlem
 * (aksiyon) düzeyinde yetki tanımlar. Kurumun paketi hangi rolde hangi sayfayı
 * ve sayfa içi işlemi içeriyorsa kurum yalnızca onları kullanabilir.
 *
 * moduleKey'ler sidebar'daki MODULE_MENU_REGISTRY anahtarlarıyla birebir aynıdır;
 * böylece menü gizleme otomatik çalışır. Aksiyon anahtarları sayfa içi butonların
 * FeatureGate/useEntitlements ile sarmalanmasında kullanılır.
 */

// ─── Modül kütüphanesi: modül → etiket + sayfa içi işlemler ───────────────────
export const MODULE_LIBRARY = {
  dashboard: { label: 'Ana Panel', actions: {} },
  kpi: { label: 'Kurum Özeti (KPI)', actions: { export: 'Rapor dışa aktar' } },
  operations: { label: 'Operasyon Paneli', actions: {} },
  'global-search': { label: 'Kurum İçi Arama', actions: {} },
  tasks: { label: 'Görev Merkezi', actions: { create: 'Görev oluştur', assign: 'Görev ata', complete: 'Görev kapat' } },
  academics: { label: 'Akademik Yönetim', actions: { 'year-manage': 'Dönem/yıl yönetimi', 'curriculum-edit': 'Müfredat düzenle' } },
  students: {
    label: 'Öğrenciler',
    actions: { create: 'Öğrenci ekle', edit: 'Öğrenci düzenle', delete: 'Öğrenci sil', export: 'Listeyi dışa aktar', 'detail-view': 'Detay görüntüle' },
  },
  parents: { label: 'Veliler', actions: { create: 'Veli ekle', edit: 'Veli düzenle', link: 'Öğrenci eşleştir' } },
  teachers: { label: 'Öğretmenler', actions: { create: 'Öğretmen ekle', edit: 'Öğretmen düzenle', 'branch-assign': 'Branş/sınıf ata' } },
  classes: { label: 'Sınıflar & Gruplar', actions: { create: 'Sınıf oluştur', edit: 'Sınıf düzenle', delete: 'Sınıf sil', 'student-assign': 'Öğrenci ata' } },
  schedule: { label: 'Ders Programı', actions: { edit: 'Program düzenle', publish: 'Program yayınla', 'pdf-export': 'PDF çıktı' } },
  attendance: {
    label: 'Devamsızlık / Yoklama',
    actions: { take: 'Yoklama al', qr: 'QR yoklama', 'edit-past': 'Geçmiş kaydı düzenle', 'excuse-approve': 'Mazeret onayla', export: 'Rapor dışa aktar' },
  },
  courses: { label: 'Dersler', actions: { create: 'Ders tanımla', edit: 'Ders düzenle' } },
  duties: { label: 'Nöbet & Görevlendirme', actions: { create: 'Görev oluştur', assign: 'Nöbet ata' } },
  registrations: {
    label: 'Kayıt İşlemleri',
    actions: { 'student-register': 'Öğrenci kaydı', 'staff-register': 'Personel kaydı', 'branch-register': 'Şube kaydı', 'contract-create': 'Sözleşme oluştur' },
  },
  records: { label: 'İdari Kayıtlar', actions: { create: 'Kayıt ekle', edit: 'Kayıt düzenle', delete: 'Kayıt sil' } },
  documents: { label: 'Belge Merkezi', actions: { upload: 'Belge yükle', download: 'Belge indir', delete: 'Belge sil' } },
  'administrative-units': { label: 'İdari Birimler', actions: { manage: 'Birim yönetimi' } },
  approvals: { label: 'Onay Akışları', actions: { approve: 'Onayla/Reddet' } },
  'password-reset': { label: 'Şifre Sıfırlama Talepleri', actions: { approve: 'Talebi işle' } },
  content: {
    label: 'İçerik / Konu Anlatımı',
    actions: { upload: 'İçerik yükle', edit: 'İçerik düzenle', delete: 'İçerik sil', download: 'İçerik indir' },
  },
  questions: { label: 'Soru Kutusu', actions: { ask: 'Soru sor', reply: 'Cevapla', close: 'Konuyu kapat' } },
  'question-bank': {
    label: 'Soru Bankası',
    actions: { create: 'Soru oluştur', 'bulk-import': 'Toplu soru yükle', 'ai-generate': 'AI ile soru üret', export: 'Dışa aktar', practice: 'Soru çöz' },
  },
  exams: {
    label: 'Sınavlar',
    actions: { create: 'Sınav oluştur', edit: 'Sınav düzenle', delete: 'Sınav sil', 'publish-results': 'Sonuç yayınla', 'pdf-export': 'PDF çıktı', solve: 'Sınav çöz' },
  },
  'mock-exams': { label: 'Deneme Sınavları', actions: { create: 'Deneme oluştur', 'import-results': 'Sonuç aktar', analysis: 'Analiz görüntüle' } },
  'grade-entry': { label: 'Not Girişi', actions: { enter: 'Not gir', lock: 'Notları kilitle' } },
  assignments: { label: 'Ödevler', actions: { assign: 'Ödev ver', grade: 'Ödev değerlendir', submit: 'Ödev teslim et', delete: 'Ödev sil' } },
  'live-lessons': { label: 'Canlı Dersler', actions: { schedule: 'Ders planla', start: 'Ders başlat', join: 'Derse katıl' } },
  'study-plan': { label: 'Çalışma Planı & Rozetler', actions: { create: 'Plan oluştur', badges: 'Rozet sistemi' } },
  ai: { label: 'AI Asistan', actions: { chat: 'AI sohbet', 'question-solve': 'AI soru çözümü' } },
  reports: { label: 'Raporlar', actions: { 'pdf-export': 'PDF rapor', 'weekly-report': 'Haftalık rapor', 'exam-analysis': 'Sınav analizi' } },
  'branch-comparison': { label: 'Şube Karşılaştırma', actions: {} },
  guidance: { label: 'Rehberlik', actions: { sessions: 'Görüşme kaydı', inventories: 'Envanter uygula', planner: 'Planlayıcı', library: 'Kütüphane' } },
  finance: { label: 'Finans Paneli', actions: {} },
  'student-accounts': { label: 'Öğrenci Hesapları', actions: { 'account-view': 'Hesap görüntüle', 'account-edit': 'Hesap düzenle' } },
  collections: { label: 'Tahsilatlar', actions: { collect: 'Tahsilat al', refund: 'İade yap', 'receipt-print': 'Makbuz yazdır' } },
  installments: { label: 'Taksitler', actions: { 'plan-create': 'Taksit planı oluştur', edit: 'Taksit düzenle', delete: 'Taksit sil' } },
  'late-payments': { label: 'Geciken Ödemeler', actions: { notify: 'Hatırlatma gönder' } },
  billing: { label: 'Fatura & Makbuz', actions: { 'invoice-create': 'Fatura kes', 'receipt-create': 'Makbuz oluştur', cancel: 'İptal et', export: 'Dışa aktar' } },
  'discounts-scholarships': { label: 'İndirim & Burs', actions: { define: 'Tanımla', approve: 'Onayla' } },
  'collection-calendar': { label: 'Tahsilat Takvimi', actions: {} },
  reconciliation: { label: 'Mutabakat', actions: { run: 'Mutabakat çalıştır' } },
  'bulk-actions': { label: 'Toplu Finans İşlemleri', actions: { 'bulk-collect': 'Toplu tahsilat', 'bulk-notify': 'Toplu bildirim' } },
  'overdue-rules': { label: 'Gecikme Kuralları', actions: { define: 'Kural tanımla' } },
  salary: { label: 'Maaş Yönetimi', actions: { define: 'Maaş tanımla', pay: 'Ödeme yap' } },
  'cash-report': { label: 'Kasa Raporu', actions: { export: 'Dışa aktar' } },
  ledger: { label: 'Hesap Defteri', actions: { export: 'Dışa aktar' } },
  'finance-export': { label: 'Finans Dışa Aktarım', actions: { excel: 'Excel', pdf: 'PDF' } },
  'finance-audit-log': { label: 'Finans Denetim Kaydı', actions: {} },
  'finance-detail-hub': { label: 'Finans Detay Merkezi', actions: {} },
  payments: { label: 'Ödemelerim (Veli)', actions: { pay: 'Online ödeme' } },
  receipts: { label: 'Makbuzlarım (Veli)', actions: { download: 'Makbuz indir' } },
  feedback: { label: 'Geri Bildirim (Veli)', actions: { send: 'Geri bildirim gönder' } },
  excuse: { label: 'Mazeret Bildirimi (Veli)', actions: { send: 'Mazeret gönder' } },
  notifications: { label: 'Duyurular', actions: { create: 'Duyuru oluştur', 'target-groups': 'Hedef kitle seç', push: 'Push bildirim gönder', delete: 'Duyuru sil' } },
  meetings: { label: 'Görüşmeler', actions: { request: 'Görüşme talep et', approve: 'Görüşme onayla', cancel: 'Görüşme iptal' } },
  chat: { label: 'Mesajlaşma', actions: { send: 'Mesaj gönder', attachments: 'Dosya ekle', group: 'Grup sohbeti' } },
  support: { label: 'Destek Talepleri', actions: { create: 'Talep oluştur', reply: 'Yanıtla' } },
  service: { label: 'Servis Takibi', actions: { 'route-manage': 'Rota/araç yönetimi', 'live-track': 'Canlı konum takibi' } },
  cafeteria: { label: 'Yemekhane', actions: { 'menu-edit': 'Menü düzenle', publish: 'Menü yayınla' } },
  'role-management': { label: 'Rol Yönetimi', actions: { 'policy-edit': 'Rol yetkisi düzenle' } },
  library: {
    label: 'Kütüphane',
    actions: { 'catalog-manage': 'Kitap ekle/düzenle', lend: 'Ödünç ver', return: 'İade al', browse: 'Katalog görüntüle' },
  },
  'staff-hr': {
    label: 'Personel / İK',
    actions: { 'profile-edit': 'Personel dosyası düzenle', 'leave-approve': 'İzin onayla', 'asset-assign': 'Zimmet ata', export: 'Dışa aktar' },
  },
  'audit-log': { label: 'Denetim Kayıtları', actions: { export: 'Dışa aktar' } },
  'org-units': { label: 'Organizasyon Birimleri', actions: { manage: 'Birim oluştur/düzenle' } },
  rbac: { label: 'Yetki Matrisi', actions: { edit: 'Matris düzenle' } },
};

// ─── Rol → kullanılabilir modüller (superadmin hariç tüm kurum rolleri) ───────
export const PACKAGE_ROLES = [
  { key: 'admin', label: 'Kurum Yöneticisi' },
  { key: 'administrative', label: 'İdari Personel' },
  { key: 'finance', label: 'Muhasebe' },
  { key: 'counselor', label: 'Rehberlik Öğretmeni' },
  { key: 'teacher', label: 'Öğretmen' },
  { key: 'student', label: 'Öğrenci' },
  { key: 'parent', label: 'Veli' },
  { key: 'cafeteria', label: 'Yemekhaneci' },
];

export const ROLE_MODULES = {
  admin: [
    'dashboard', 'kpi', 'operations', 'global-search', 'tasks',
    'academics', 'students', 'parents', 'teachers', 'classes', 'schedule', 'attendance', 'courses', 'duties',
    'registrations', 'records', 'administrative-units', 'approvals', 'password-reset',
    'content', 'questions', 'question-bank', 'exams', 'assignments', 'live-lessons',
    'reports', 'branch-comparison',
    'finance', 'student-accounts', 'collections', 'installments', 'billing', 'late-payments',
    'discounts-scholarships', 'collection-calendar', 'reconciliation', 'bulk-actions', 'overdue-rules',
    'salary', 'cash-report', 'ledger', 'finance-export', 'finance-audit-log', 'finance-detail-hub',
    'notifications', 'meetings', 'chat', 'support', 'service', 'cafeteria', 'role-management',
    'library', 'staff-hr', 'audit-log', 'org-units', 'rbac',
  ],
  administrative: [
    'operations', 'tasks', 'schedule', 'duties', 'records', 'documents', 'password-reset',
    'registrations', 'reports', 'notifications', 'meetings', 'chat', 'service', 'cafeteria',
    'library', 'staff-hr',
  ],
  finance: [
    'finance', 'student-accounts', 'collections', 'installments', 'late-payments',
    'discounts-scholarships', 'billing', 'collection-calendar', 'reconciliation', 'bulk-actions',
    'overdue-rules', 'cash-report', 'ledger', 'finance-export', 'finance-audit-log',
    'finance-detail-hub', 'salary', 'chat',
  ],
  counselor: ['guidance', 'library', 'chat'],
  teacher: [
    'dashboard', 'schedule', 'attendance', 'live-lessons', 'duties',
    'content', 'question-bank', 'questions', 'exams', 'mock-exams', 'grade-entry',
    'reports', 'assignments', 'meetings', 'notifications', 'chat', 'library',
  ],
  student: [
    'dashboard', 'schedule', 'study-plan', 'live-lessons',
    'content', 'question-bank', 'questions', 'assignments', 'ai',
    'exams', 'mock-exams', 'reports', 'attendance', 'cafeteria', 'notifications', 'chat', 'library',
  ],
  parent: [
    'dashboard', 'parents', 'attendance', 'exams', 'reports', 'feedback', 'excuse',
    'payments', 'receipts', 'cafeteria', 'meetings', 'notifications', 'chat', 'library',
  ],
  cafeteria: ['cafeteria'],
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** Bir rolün seçilebilir modüllerini { key, label, actions } listesi olarak döner. */
export function getRoleModuleOptions(roleKey) {
  return (ROLE_MODULES[roleKey] || []).map((moduleKey) => ({
    key: moduleKey,
    label: MODULE_LIBRARY[moduleKey]?.label || moduleKey,
    actions: MODULE_LIBRARY[moduleKey]?.actions || {},
  }));
}

/**
 * Paket yetki tanımından pazarlama sitesine yazılacak özellik listesi üretir.
 * Roller arasında tekrar eden modüller tek satır olur.
 */
export function buildMarketingFeatureList(rolesPayload) {
  const seen = new Set();
  const features = [];
  for (const roleKey of Object.keys(rolesPayload || {})) {
    const modules = rolesPayload[roleKey]?.modules || {};
    for (const [moduleKey, moduleValue] of Object.entries(modules)) {
      if (!moduleValue?.enabled || seen.has(moduleKey)) continue;
      seen.add(moduleKey);
      features.push(MODULE_LIBRARY[moduleKey]?.label || moduleKey);
    }
  }
  return features;
}

/**
 * Yeni paket için tüm rollerin tüm modül ve aksiyonları açık başlangıç tanımı.
 */
export function buildFullAccessRoles() {
  const roles = {};
  for (const { key: roleKey } of PACKAGE_ROLES) {
    const modules = {};
    for (const moduleKey of ROLE_MODULES[roleKey] || []) {
      const actions = {};
      for (const actionKey of Object.keys(MODULE_LIBRARY[moduleKey]?.actions || {})) {
        actions[actionKey] = true;
      }
      modules[moduleKey] = { enabled: true, actions };
    }
    roles[roleKey] = { modules };
  }
  return roles;
}
