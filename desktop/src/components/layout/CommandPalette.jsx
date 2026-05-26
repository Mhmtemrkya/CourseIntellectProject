import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  GraduationCap, 
  School, 
  Calendar, 
  ClipboardCheck, 
  QrCode, 
  HelpCircle, 
  FileQuestion, 
  BarChart3, 
  Settings,
  BookOpen,
  MessageSquare,
  Video,
  Brain,
  CreditCard,
  Bell,
  Building2,
  Shield,
  FileText,
  CheckSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command';

const navigationByRole = {
  admin: [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', keywords: ['ana sayfa', 'home'] },
    { path: '/students', icon: Users, label: 'Öğrenciler', keywords: ['student', 'öğrenci'] },
    { path: '/parents', icon: UserCheck, label: 'Veliler', keywords: ['parent', 'veli', 'aile'] },
    { path: '/teachers', icon: GraduationCap, label: 'Öğretmenler', keywords: ['teacher', 'öğretmen', 'hoca'] },
    { path: '/classes', icon: School, label: 'Sınıflar & Gruplar', keywords: ['class', 'sınıf', 'grup'] },
    { path: '/schedule', icon: Calendar, label: 'Ders Programı', keywords: ['schedule', 'program', 'takvim'] },
    { path: '/admin/finance-approvals', icon: Shield, label: 'Finans Onayları', keywords: ['finans onay', 'approval', 'onay'] },
    { path: '/attendance', icon: ClipboardCheck, label: 'Yoklama', keywords: ['attendance', 'yoklama', 'devamsızlık'] },
    { path: '/kiosk-qr', icon: QrCode, label: 'Kiosk QR', keywords: ['qr', 'kiosk', 'tarama'] },
    { path: '/content', icon: BookOpen, label: 'İçerikler', keywords: ['content', 'içerik'] },
    { path: '/questions', icon: HelpCircle, label: 'Sorular', keywords: ['question', 'soru'] },
    { path: '/exams', icon: FileQuestion, label: 'Sınavlar', keywords: ['exam', 'sınav'] },
    { path: '/reports', icon: BarChart3, label: 'Raporlar', keywords: ['report', 'rapor', 'analiz'] },
    { path: '/admin/meetings', icon: Calendar, label: 'Görüşme Akışı', keywords: ['meeting', 'görüşme', 'veli'] },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar', keywords: ['mesaj', 'chat'] },
    { path: '/settings', icon: Settings, label: 'Ayarlar', keywords: ['settings', 'ayar', 'config'] },
  ],
  administrative: [
    { path: '/admin/operations', icon: LayoutDashboard, label: 'İdari Operasyon', keywords: ['idari', 'operasyon'] },
    { path: '/admin/task-center', icon: CheckSquare, label: 'Görev Merkezi', keywords: ['görev', 'task'] },
    { path: '/admin/schedule', icon: Calendar, label: 'Ders Programı', keywords: ['ders programı', 'schedule', 'takvim'] },
    { path: '/admin/records', icon: FileText, label: 'İdari Kayıtlar', keywords: ['kayıt', 'records'] },
    { path: '/admin/announcements', icon: Bell, label: 'Duyurular', keywords: ['duyuru', 'announcement', 'bildirim'] },
    { path: '/admin/documents', icon: FileText, label: 'Belge Merkezi', keywords: ['belge', 'documents'] },
    { path: '/admin/personnel-approvals', icon: Shield, label: 'Personel Onayları', keywords: ['personel', 'onay'] },
    { path: '/admin/finance-approvals', icon: Shield, label: 'Finans Onayları', keywords: ['finans', 'onay'] },
    { path: '/admin/role-management', icon: Shield, label: 'Rol Yönetimi', keywords: ['rol', 'yetki'] },
    { path: '/admin/parent-registration', icon: UserCheck, label: 'Veli Kaydı', keywords: ['veli kaydı', 'parent registration'] },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar', keywords: ['mesaj', 'chat'] },
    { path: '/settings', icon: Settings, label: 'Ayarlar', keywords: ['ayar', 'settings'] },
  ],
  teacher: [
    { path: '/t/dashboard', icon: LayoutDashboard, label: 'Öğretmen Paneli', keywords: ['dashboard', 'öğretmen'] },
    { path: '/t/schedule', icon: Calendar, label: 'Ders Programı', keywords: ['schedule', 'program'] },
    { path: '/t/attendance', icon: ClipboardCheck, label: 'Yoklama', keywords: ['attendance', 'yoklama'] },
    { path: '/t/live-lessons', icon: Video, label: 'Canlı Dersler', keywords: ['live', 'canlı'] },
    { path: '/t/live-room', icon: Shield, label: 'Canlı Ders Odası', keywords: ['oda', 'room'] },
    { path: '/t/content', icon: BookOpen, label: 'İçerik Yönetimi', keywords: ['content', 'içerik'] },
    { path: '/t/question-bank', icon: Brain, label: 'Soru Bankası', keywords: ['soru bankası', 'practice'] },
    { path: '/t/questions', icon: HelpCircle, label: 'Soru Kutusu', keywords: ['question box', 'soru'] },
    { path: '/t/exams', icon: FileQuestion, label: 'Sınavlar', keywords: ['exam', 'sınav'] },
    { path: '/t/mock-exams', icon: ClipboardCheck, label: 'Deneme Sınavları', keywords: ['deneme', 'mock exam'] },
    { path: '/t/assignments', icon: FileText, label: 'Ödevler', keywords: ['assignment', 'ödev'] },
    { path: '/t/submissions', icon: ClipboardCheck, label: 'Teslim Merkezi', keywords: ['teslim', 'submission'] },
    { path: '/t/chat', icon: MessageSquare, label: 'Mesajlar', keywords: ['mesaj', 'chat'] },
    { path: '/settings', icon: Settings, label: 'Ayarlar', keywords: ['settings', 'ayar'] },
  ],
  student: [
    { path: '/s/dashboard', icon: LayoutDashboard, label: 'Öğrenci Paneli', keywords: ['dashboard', 'öğrenci'] },
    { path: '/s/schedule', icon: Calendar, label: 'Ders Programı', keywords: ['schedule', 'program'] },
    { path: '/s/study-plan', icon: ClipboardCheck, label: 'Çalışma Planım', keywords: ['study plan', 'plan'] },
    { path: '/s/live', icon: Video, label: 'Canlı Dersler', keywords: ['live', 'canlı'] },
    { path: '/s/attendance-qr', icon: QrCode, label: 'QR Yoklama', keywords: ['qr', 'attendance'] },
    { path: '/s/content', icon: BookOpen, label: 'Konu Anlatımı', keywords: ['content', 'içerik'] },
    { path: '/s/questions', icon: Brain, label: 'Soru Bankası', keywords: ['question bank', 'soru'] },
    { path: '/s/question-practice', icon: HelpCircle, label: 'Soru Çözüm Alanı', keywords: ['practice', 'cozum'] },
    { path: '/s/exams', icon: FileQuestion, label: 'Sınavlar', keywords: ['exam', 'sınav'] },
    { path: '/s/assignments', icon: FileText, label: 'Ödevler', keywords: ['assignment', 'ödev'] },
    { path: '/s/wrong-answers', icon: BarChart3, label: 'Yanlışlarım', keywords: ['wrong', 'yanlış'] },
    { path: '/s/ai', icon: Brain, label: 'AI Asistan', keywords: ['ai', 'assistant'] },
    { path: '/s/chat', icon: MessageSquare, label: 'Mesajlar', keywords: ['mesaj', 'chat'] },
    { path: '/s/profile', icon: UserCheck, label: 'Profilim', keywords: ['profil', 'profile'] },
  ],
  parent: [
    { path: '/p/dashboard', icon: LayoutDashboard, label: 'Veli Paneli', keywords: ['dashboard', 'veli'] },
    { path: '/p/children', icon: Users, label: 'Çocuklarım', keywords: ['children', 'çocuk'] },
    { path: '/p/attendance', icon: ClipboardCheck, label: 'Devamsızlık', keywords: ['attendance', 'devamsızlık'] },
    { path: '/p/exams', icon: FileQuestion, label: 'Sınav Sonuçları', keywords: ['exam', 'sınav'] },
    { path: '/p/payments', icon: CreditCard, label: 'Ödemeler', keywords: ['payment', 'ödeme'] },
    { path: '/p/receipts', icon: FileText, label: 'Makbuz Arşivi', keywords: ['receipt', 'makbuz'] },
    { path: '/p/feedback', icon: Bell, label: 'Geri Bildirim', keywords: ['feedback', 'geri bildirim'] },
    { path: '/p/meetings', icon: Calendar, label: 'Görüşmeler', keywords: ['meeting', 'görüşme'] },
    { path: '/p/announcements', icon: Bell, label: 'Duyurular', keywords: ['announcement', 'duyuru'] },
    { path: '/p/chat', icon: MessageSquare, label: 'Mesajlar', keywords: ['mesaj', 'chat'] },
    { path: '/p/profile', icon: UserCheck, label: 'Profilim', keywords: ['profil', 'profile'] },
  ],
  finance: [
    { path: '/finance/dashboard', icon: LayoutDashboard, label: 'Muhasebe Özet', keywords: ['finance', 'muhasebe'] },
    { path: '/finance/student-accounts', icon: Users, label: 'Öğrenci Hesapları', keywords: ['accounts', 'hesap'] },
    { path: '/finance/collections', icon: CreditCard, label: 'Tahsilatlar', keywords: ['collections', 'tahsilat'] },
    { path: '/finance/installments', icon: FileText, label: 'Taksitler', keywords: ['installment', 'taksit'] },
    { path: '/finance/invoices-receipts', icon: FileQuestion, label: 'Fatura ve Makbuz', keywords: ['invoice', 'receipt'] },
    { path: '/finance/late-payments', icon: Bell, label: 'Gecikenler', keywords: ['late', 'geciken'] },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar', keywords: ['mesaj', 'chat'] },
    { path: '/settings', icon: Settings, label: 'Ayarlar', keywords: ['settings', 'ayar'] },
  ],
  superadmin: [
    { path: '/sa/dashboard', icon: LayoutDashboard, label: 'Platform Özet', keywords: ['platform', 'overview'] },
    { path: '/sa/tenants', icon: Building2, label: 'Kurumlar', keywords: ['tenant', 'kurum'] },
    { path: '/sa/plans', icon: FileText, label: 'Paketler', keywords: ['plan', 'paket'] },
    { path: '/sa/billing', icon: CreditCard, label: 'Faturalama', keywords: ['billing', 'fatura'] },
    { path: '/sa/limits', icon: Shield, label: 'Limitler', keywords: ['limits', 'limit'] },
    { path: '/sa/ai', icon: Brain, label: 'AI Yönetimi', keywords: ['ai', 'yapay zeka'] },
    { path: '/sa/customization', icon: Settings, label: 'Kurum Özelleştirme', keywords: ['branding', 'özelleştirme'] },
    { path: '/sa/system', icon: Settings, label: 'Sistem Ayarları', keywords: ['system', 'sistem'] },
    { path: '/sa/support', icon: MessageSquare, label: 'Destek', keywords: ['support', 'destek'] },
  ],
};

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, user } = useApp();
  const navigate = useNavigate();

  const navigationItems = useMemo(() => {
    const role = user?.role || 'student';
    return navigationByRole[role] || navigationByRole.student;
  }, [user?.role]);

  const quickActions = useMemo(() => {
    switch (user?.role) {
      case 'admin':
        return [
          { path: '/students?action=new', icon: Users, label: 'Yeni Öğrenci Ekle' },
          { path: '/attendance', icon: ClipboardCheck, label: 'Yoklama Al' },
          { path: '/exams?action=new', icon: FileQuestion, label: 'Yeni Sınav Oluştur' },
        ];
      case 'administrative':
        return [
          { path: '/admin/task-center', icon: CheckSquare, label: 'Görev Merkezi Aç' },
          { path: '/admin/announcements', icon: Bell, label: 'Duyuruları Aç' },
          { path: '/admin/documents', icon: FileText, label: 'Belge Merkezini Aç' },
        ];
      case 'teacher':
        return [
          { path: '/t/assignments', icon: FileText, label: 'Ödev Oluştur' },
          { path: '/t/live-lessons', icon: Video, label: 'Canlı Ders Planla' },
          { path: '/t/question-bank', icon: Brain, label: 'Soru Ekle' },
          { path: '/t/mock-exams', icon: ClipboardCheck, label: 'Deneme Sınavı Oluştur' },
        ];
      case 'student':
        return [
          { path: '/s/question-practice', icon: Brain, label: 'Soru Çöz' },
          { path: '/s/study-plan', icon: ClipboardCheck, label: 'Çalışma Planımı Aç' },
          { path: '/s/ai', icon: Brain, label: 'AI Asistanı Aç' },
        ];
      case 'parent':
        return [
          { path: '/p/meetings', icon: Calendar, label: 'Görüşme Talebi Oluştur' },
          { path: '/p/payments', icon: CreditCard, label: 'Ödeme Durumunu Aç' },
          { path: '/p/announcements', icon: Bell, label: 'Duyuruları Aç' },
        ];
      case 'finance':
        return [
          { path: '/finance/collections', icon: CreditCard, label: 'Tahsilat Gir' },
          { path: '/finance/export', icon: FileText, label: 'Dışa Aktar' },
        ];
      case 'superadmin':
        return [
          { path: '/sa/tenants', icon: Building2, label: 'Kurum Aç' },
          { path: '/sa/support', icon: MessageSquare, label: 'Destek Taleplerini Aç' },
          { path: '/sa/customization', icon: Settings, label: 'Branding Ayarları' },
        ];
      default:
        return [];
    }
  }, [user?.role]);

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setCommandPaletteOpen]);

  const handleSelect = useCallback((path) => {
    setCommandPaletteOpen(false);
    navigate(path);
  }, [navigate, setCommandPaletteOpen]);

  return (
    <CommandDialog 
      open={commandPaletteOpen} 
      onOpenChange={setCommandPaletteOpen}
    >
      <CommandInput placeholder="Sayfa veya işlem ara..." />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        <CommandGroup heading="Sayfalar">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords.join(' ')}`}
                onSelect={() => handleSelect(item.path)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Hızlı İşlemler">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem 
                key={item.path}
                onSelect={() => handleSelect(item.path)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
