import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronLeft,
  BookOpen,
  MessageSquare,
  Wallet,
  CreditCard,
  Receipt,
  AlertCircle,
  Building2,
  Package,
  Server,
  Video,
  FileText,
  Bell,
  User,
  Gift,
  Download,
  CheckSquare,
  Ticket
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

// Menu items for each role
const menuConfigs = {
  admin: [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/students', icon: Users, label: 'Öğrenciler' },
    { path: '/parents', icon: UserCheck, label: 'Veliler' },
    { path: '/teachers', icon: GraduationCap, label: 'Öğretmenler' },
    { path: '/classes', icon: School, label: 'Sınıflar & Gruplar' },
    { path: '/schedule', icon: Calendar, label: 'Ders Programı' },
    { path: '/admin/finance-approvals', icon: CheckSquare, label: 'Finans Onayları' },
    { path: '/attendance', icon: ClipboardCheck, label: 'Yoklama' },
    { path: '/kiosk-qr', icon: QrCode, label: 'Kiosk (QR)' },
    { path: '/content', icon: BookOpen, label: 'İçerikler' },
    { path: '/questions', icon: HelpCircle, label: 'Sorular' },
    { path: '/exams', icon: FileQuestion, label: 'Sınavlar' },
    { path: '/reports', icon: BarChart3, label: 'Raporlar' },
    { path: '/admin/student-registration', icon: Users, label: 'Öğrenci Kaydı' },
    { path: '/admin/staff-registration', icon: UserCheck, label: 'Personel Kaydı' },
    { path: '/admin/branch-comparison', icon: BarChart3, label: 'Şube Karşılaştırma' },
    { path: '/admin/meetings', icon: Calendar, label: 'Görüşme Akışı' },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ],
  administrative: [
    { path: '/admin/operations', icon: LayoutDashboard, label: 'Operasyon' },
    { path: '/admin/task-center', icon: CheckSquare, label: 'Görev Merkezi' },
    { path: '/admin/schedule', icon: Calendar, label: 'Ders Programı' },
    { path: '/admin/records', icon: FileText, label: 'İdari Kayıtlar' },
    { path: '/admin/announcements', icon: Bell, label: 'Duyurular' },
    { path: '/admin/documents', icon: FileText, label: 'Belge Merkezi' },
    { path: '/admin/personnel-approvals', icon: CheckSquare, label: 'Personel Onayları' },
    { path: '/admin/finance-approvals', icon: CheckSquare, label: 'Finans Onayları' },
    { path: '/admin/role-management', icon: CheckSquare, label: 'Rol Yönetimi' },
    { path: '/admin/meetings', icon: Calendar, label: 'Görüşme Akışı' },
    { path: '/admin/parent-registration', icon: UserCheck, label: 'Veli Kaydı' },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ],
  finance: [
    { path: '/finance/dashboard', icon: LayoutDashboard, label: 'Muhasebe Özet' },
    { path: '/finance/student-accounts', icon: Users, label: 'Öğrenci Hesapları' },
    { path: '/finance/collections', icon: CreditCard, label: 'Tahsilatlar' },
    { path: '/finance/installments', icon: Receipt, label: 'Taksitler' },
    { path: '/finance/invoices-receipts', icon: FileText, label: 'Fatura & Makbuz' },
    { path: '/finance/discounts-scholarships', icon: Gift, label: 'İndirim & Burs' },
    { path: '/finance/late-payments', icon: AlertCircle, label: 'Gecikenler' },
    { path: '/finance/overdue-rules', icon: Bell, label: 'Gecikme Kuralları' },
    { path: '/finance/salary', icon: Wallet, label: 'Maaş Yönetimi' },
    { path: '/finance/cash-report', icon: Receipt, label: 'Kasa Raporu' },
    { path: '/finance/ledger', icon: BookOpen, label: 'Hesap Defteri' },
    { path: '/finance/export', icon: Download, label: 'Dışa Aktar' },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ],
  superadmin: [
    { path: '/sa/dashboard', icon: LayoutDashboard, label: 'Platform Özet' },
    { path: '/sa/tenants', icon: Building2, label: 'Kurumlar' },
    { path: '/sa/plans', icon: Package, label: 'Paketler' },
    { path: '/sa/billing', icon: Wallet, label: 'Faturalama' },
    { path: '/sa/limits', icon: Server, label: 'Limitler' },
    { path: '/sa/system', icon: Settings, label: 'Sistem' },
    { path: '/sa/support', icon: Ticket, label: 'Destek' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ],
  teacher: [
    { path: '/t/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/t/schedule', icon: Calendar, label: 'Ders Programı' },
    { path: '/t/attendance', icon: ClipboardCheck, label: 'Yoklama' },
    { path: '/t/live-lessons', icon: Video, label: 'Canlı Dersler' },
    { path: '/t/content', icon: BookOpen, label: 'İçerikler' },
    { path: '/t/questions', icon: HelpCircle, label: 'Soru Kutusu' },
    { path: '/t/exams', icon: FileQuestion, label: 'Sınavlar' },
    { path: '/t/assignments', icon: FileText, label: 'Ödevler' },
    { path: '/t/reports', icon: BarChart3, label: 'Raporlar' },
    { path: '/t/meeting-approvals', icon: Calendar, label: 'Görüşme Onayları' },
    { path: '/t/profile', icon: User, label: 'Profilim' },
    { path: '/t/chat', icon: MessageSquare, label: 'Mesajlar' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ],
  student: [
    { path: '/s/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/s/schedule', icon: Calendar, label: 'Ders Programı' },
    { path: '/s/live', icon: Video, label: 'Canlı Dersler' },
    { path: '/s/content', icon: BookOpen, label: 'İçerikler' },
    { path: '/s/exams', icon: FileQuestion, label: 'Sınavlar' },
    { path: '/s/assignments', icon: FileText, label: 'Ödevler' },
    { path: '/s/questions', icon: HelpCircle, label: 'Soru Sor' },
    { path: '/s/announcements', icon: Bell, label: 'Duyurular' },
    { path: '/s/chat', icon: MessageSquare, label: 'Mesajlar' },
    { path: '/s/profile', icon: User, label: 'Profilim' },
    { path: '/s/settings', icon: Settings, label: 'Ayarlar' },
  ],
  parent: [
    { path: '/p/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/p/attendance', icon: ClipboardCheck, label: 'Devamsızlık' },
    { path: '/p/exams', icon: FileQuestion, label: 'Sınav Sonuçları' },
    { path: '/p/payments', icon: CreditCard, label: 'Ödemeler' },
    { path: '/p/excuse-request', icon: FileText, label: 'Mazeret Bildirimi' },
    { path: '/p/announcements', icon: Bell, label: 'Duyurular' },
    { path: '/p/chat', icon: MessageSquare, label: 'Mesajlar' },
    { path: '/p/profile', icon: User, label: 'Profilim' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ],
};

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, user } = useApp();
  const location = useLocation();

  // Get menu items based on user role
  const userRole = user?.role || 'admin';
  const menuItems = menuConfigs[userRole] || menuConfigs.admin;

  return (
    <motion.aside
      data-testid="sidebar"
      initial={false}
      animate={{ width: sidebarCollapsed ? 76 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-brand-primary text-white flex flex-col border-r border-[#00283B] relative z-30"
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <motion.div 
          className="flex items-center gap-3 overflow-hidden"
          animate={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
        >
          <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-6 w-6 text-brand-accent" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="font-heading font-bold text-lg whitespace-nowrap overflow-hidden"
              >
                CourseIntellect
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <TooltipProvider delayDuration={0}>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path || 
                              location.pathname.startsWith(item.path + '/');
              const Icon = item.icon;

              return (
                <li key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.path}
                        data-testid={`nav-${item.path.replace(/\//g, '-').slice(1)}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                          "hover:bg-white/10",
                          isActive && "bg-brand-accent text-white shadow-lg"
                        )}
                      >
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                        </motion.div>
                        <AnimatePresence>
                          {!sidebarCollapsed && (
                            <motion.span
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.2 }}
                              className="text-sm font-medium whitespace-nowrap"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </NavLink>
                    </TooltipTrigger>
                    {sidebarCollapsed && (
                      <TooltipContent side="right" className="bg-brand-primary text-white border-brand-accent">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </nav>

      {/* Collapse Toggle */}
      <button
        data-testid="sidebar-toggle"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-20 bg-brand-primary border-2 border-white/20 rounded-full p-1 hover:bg-brand-accent transition-colors"
      >
        <motion.div
          animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronLeft className="h-4 w-4" />
        </motion.div>
      </button>
    </motion.aside>
  );
}
