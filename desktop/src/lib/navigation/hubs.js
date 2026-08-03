import {
  Activity,
  AlertCircle,
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarPlus,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Gift,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Layers,
  Library,
  Megaphone,
  Receipt,
  RotateCcw,
  ScrollText,
  Shield,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Konu hub'ları: bir işi bitirmek için gereken ekranlar tek menü girişinde
 * toplanır, aralarında sekmeyle geçilir. Rotalar DEĞİŞMEZ — eski adresler,
 * yer imleri ve testler çalışmaya devam eder; yalnız menüde tek satır görünür
 * ve hub açıldığında kardeş ekranlar sekme olarak listelenir.
 *
 * Menüde ayrı satırı olan ekranlar (Muhasebe Özet, Cari Hesaplar) hub'a
 * girmez: biri panodur, diğeri muhasebecinin gün boyu açık tuttuğu ekrandır.
 */
export const FINANCE_HUBS = [
  {
    id: 'finance-collections',
    label: 'Tahsilat',
    icon: CreditCard,
    color: '#10b981',
    tabs: [
      { path: '/finance/collections', label: 'Tahsilatlar', icon: CreditCard },
      { path: '/finance/installments', label: 'Taksitler', icon: Receipt },
      { path: '/finance/late-payments', label: 'Gecikenler', icon: AlertCircle },
      { path: '/finance/collection-calendar', label: 'Tahsilat Takvimi', icon: Calendar },
      { path: '/finance/overdue-rules', label: 'Gecikme Kuralları', icon: Bell },
      { path: '/finance/bulk-actions', label: 'Toplu İşlemler', icon: Layers },
    ],
  },
  {
    id: 'finance-documents',
    label: 'Belgeler',
    icon: FileText,
    color: '#06b6d4',
    tabs: [
      { path: '/finance/invoices-receipts', label: 'Fatura & Makbuz', icon: FileText },
      { path: '/finance/refunds', label: 'İadeler', icon: RotateCcw },
      { path: '/finance/discounts-scholarships', label: 'İndirim & Burs', icon: Gift },
    ],
  },
  {
    id: 'finance-costs',
    label: 'Gider & Bordro',
    icon: TrendingDown,
    color: '#e11d48',
    tabs: [
      { path: '/finance/expenses', label: 'Giderler', icon: TrendingDown },
      { path: '/finance/salary', label: 'Maaş Yönetimi', icon: Wallet },
    ],
  },
  {
    id: 'finance-reports',
    label: 'Rapor & Denetim',
    icon: BarChart3,
    color: '#a855f7',
    tabs: [
      { path: '/finance/cash-report', label: 'Kasa Raporu', icon: Receipt },
      { path: '/finance/ledger', label: 'Hesap Defteri', icon: BookOpen },
      { path: '/finance/reconciliation', label: 'Mutabakat', icon: Shield },
      { path: '/finance/export', label: 'Dışa Aktar', icon: Download },
      { path: '/finance/audit-log', label: 'Denetim Kaydı', icon: Activity },
    ],
  },
];

/**
 * Yönetici hub'ları. Kurum yöneticisinin menüsü 50'yi aşan satıra ulaşmıştı;
 * aynı işi bitiren ekranlar tek girişte toplanır. Günlük ekranlar (Öğrenciler,
 * Ders Programı gibi) hub'ın İLK sekmesidir — tek tıkla yine açılır.
 */
export const ADMIN_HUBS = [
  {
    id: 'admin-directory',
    label: 'Kişiler',
    icon: Users,
    color: '#3b82f6',
    tabs: [
      { path: '/students', label: 'Öğrenciler', icon: Users },
      { path: '/teachers', label: 'Öğretmenler', icon: GraduationCap },
      { path: '/parents', label: 'Veliler', icon: HeartHandshake },
      { path: '/admin/staff', label: 'Personeller', icon: UserCheck },
    ],
  },
  {
    id: 'admin-academics',
    label: 'Akademik',
    icon: BookOpen,
    color: '#8b5cf6',
    tabs: [
      { path: '/admin/academics', label: 'Akademik Yönetim', icon: BookOpen },
      { path: '/classes', label: 'Sınıflar & Gruplar', icon: Users },
      { path: '/schedule', label: 'Ders Programı', icon: Calendar },
      { path: '/attendance', label: 'Devamsızlık', icon: UserCheck },
      { path: '/exams', label: 'Sınavlar', icon: ClipboardList },
      { path: '/admin/exam-papers', label: 'Sınav Kağıtları', icon: FileText },
    ],
  },
  {
    id: 'admin-registration',
    // Menü grubu da "Kayıt İşlemleri" adını taşıdığı için hub "Yeni Kayıt".
    label: 'Yeni Kayıt',
    icon: UserPlus,
    color: '#22c55e',
    tabs: [
      { path: '/admin/student-registration', label: 'Öğrenci Kaydı', icon: UserPlus },
      { path: '/admin/staff-registration', label: 'Personel Kaydı', icon: UserCheck },
      { path: '/admin/accounting-registration', label: 'Muhasebe Kaydı', icon: Wallet },
      { path: '/admin/branch-registration', label: 'Şube Kaydı', icon: Building2 },
    ],
  },
  {
    id: 'admin-approvals',
    label: 'Onay & Talepler',
    icon: ClipboardCheck,
    color: '#f59e0b',
    tabs: [
      { path: '/admin/finance-approvals', label: 'Finans Onayları', icon: Wallet },
      { path: '/admin/personnel-approvals', label: 'Personel Onayları', icon: UserCheck },
      { path: '/admin/password-reset-requests', label: 'Şifre Talepleri', icon: KeyRound },
      { path: '/admin/meetings', label: 'Görüşme Akışı', icon: HeartHandshake },
    ],
  },
  {
    id: 'admin-hr',
    label: 'İK & Nöbet',
    icon: ClipboardList,
    color: '#0ea5e9',
    tabs: [
      { path: '/admin/staff-hr', label: 'Personel / İK', icon: UserCheck },
      { path: '/admin/duties', label: 'Tüm Nöbetler', icon: ShieldCheck },
      { path: '/admin/duty-create', label: 'Nöbet Oluştur', icon: CalendarPlus },
      { path: '/admin/timetable', label: 'Öğretmen Programı', icon: CalendarRange },
    ],
  },
  {
    id: 'admin-authority',
    label: 'Yetki & Organizasyon',
    icon: ShieldCheck,
    color: '#6366f1',
    tabs: [
      { path: '/admin/rbac', label: 'Yetki Matrisi', icon: ShieldCheck },
      { path: '/admin/role-management', label: 'Rol Yönetimi', icon: UserCog },
      { path: '/admin/org-units', label: 'Organizasyon Birimleri', icon: Building2 },
      { path: '/admin/administrative-units', label: 'İdari Birimler', icon: Building2 },
    ],
  },
  {
    id: 'admin-archive',
    label: 'Kayıt & Arşiv',
    icon: Archive,
    color: '#a855f7',
    tabs: [
      { path: '/admin/records', label: 'İdari Kayıtlar', icon: ScrollText },
      { path: '/admin/documents', label: 'Belge Merkezi', icon: FileText },
      { path: '/admin/passive-records', label: 'Pasif Kayıtlar', icon: UserX },
      { path: '/admin/audit-log', label: 'Kayıt Geçmişi', icon: Activity },
      { path: '/admin/data-backup', label: 'Verilerimi İndir', icon: Download },
    ],
  },
  {
    id: 'admin-announcements',
    label: 'Duyuru & Bildirim',
    icon: Bell,
    color: '#ec4899',
    tabs: [
      { path: '/admin/announcements', label: 'Duyurular', icon: Megaphone },
      { path: '/admin/notifications', label: 'Bildirimler', icon: Bell },
    ],
  },
  {
    id: 'admin-content',
    label: 'İçerik & Kütüphane',
    icon: Library,
    color: '#14b8a6',
    tabs: [
      { path: '/content', label: 'İçerikler', icon: Library },
      { path: '/questions', label: 'Sorular', icon: ClipboardList },
      { path: '/library', label: 'Kütüphane', icon: BookOpen },
      { path: '/admin/courses', label: 'Kurs Yönetimi', icon: GraduationCap },
    ],
  },
];

export const ALL_HUBS = [...FINANCE_HUBS, ...ADMIN_HUBS];

/**
 * Menüdeki görünür girişleri hub'lara katlar. Filtrelerden (rol, modül, paket,
 * kurum türü, kapalı özellik) GEÇMİŞ liste ile çalışır: bir hub yalnız görünür
 * kalan sekmelerinden oluşur, hiç sekmesi kalmayan hub menüde çizilmez.
 * Katlanan girişin yolu ilk görünür sekmedir; sıra, hub'ın ilk üyesinin
 * menüdeki yerini korur (grup yapısı bozulmaz).
 */
export function collapseMenuHubs(items) {
  const list = Array.isArray(items) ? items : [];
  const byPath = new Map(list.map((item) => [item.path, item]));
  const consumed = new Set();
  const hubForFirstPath = new Map();

  for (const hub of ALL_HUBS) {
    const visibleTabs = hub.tabs.filter((tab) => byPath.has(tab.path));
    if (visibleTabs.length < 2) continue;
    visibleTabs.forEach((tab) => consumed.add(tab.path));
    hubForFirstPath.set(visibleTabs[0].path, {
      path: visibleTabs[0].path,
      icon: hub.icon,
      label: hub.label,
      color: hub.color,
      hubId: hub.id,
      covers: visibleTabs.map((tab) => tab.path),
    });
  }

  const result = [];
  for (const item of list) {
    const hubEntry = hubForFirstPath.get(item.path);
    if (hubEntry) {
      result.push(hubEntry);
      continue;
    }
    if (!consumed.has(item.path)) result.push(item);
  }
  return result;
}

/** Bir adres hangi hub'a ait? (bilinmeyen adreste null) */
export function findHubByPath(pathname) {
  return (
    ALL_HUBS.find((hub) =>
      hub.tabs.some((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`)),
    ) || null
  );
}
