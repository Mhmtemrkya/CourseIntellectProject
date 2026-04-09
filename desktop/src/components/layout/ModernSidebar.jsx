import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, UserCheck, GraduationCap, School, Calendar, 
  ClipboardCheck, QrCode, HelpCircle, FileQuestion, BarChart3, Settings,
  BookOpen, MessageSquare, Wallet, CreditCard, Receipt,
  AlertCircle, Building2, Package, Server, Video, FileText, Bell, User,
  Gift, Download, CheckSquare, Ticket, Sparkles, Brain,
  Flame, Star, Menu, X, Palette, Bot
} from 'lucide-react';
import { Activity, Layers, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { FloatingParticles, GlowingOrb } from '../animations/AnimatedBackground';
import logoImage from '../../assets/brand/logo.png';
import { useTheme } from '../../context/ThemeContext';

// Menu items for each role
const menuConfigs = {
  admin: [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: '#3b82f6' },
    { path: '/admin/kpi', icon: BarChart3, label: 'KPI Paneli', color: '#22c55e' },
    { path: '/admin/operations', icon: Activity, label: 'Operasyon', color: '#14b8a6' },
    { path: '/admin/task-center', icon: CheckSquare, label: 'Görev Merkezi', color: '#f59e0b' },
    { path: '/students', icon: Users, label: 'Öğrenciler', color: '#8b5cf6' },
    { path: '/parents', icon: UserCheck, label: 'Veliler', color: '#ec4899' },
    { path: '/teachers', icon: GraduationCap, label: 'Öğretmenler', color: '#10b981' },
    { path: '/classes', icon: School, label: 'Sınıflar & Gruplar', color: '#f59e0b' },
    { path: '/schedule', icon: Calendar, label: 'Ders Programı', color: '#06b6d4' },
    { path: '/admin/finance-approvals', icon: CheckSquare, label: 'Finans Onayları', color: '#a855f7' },
    { path: '/admin/personnel-approvals', icon: CheckSquare, label: 'Personel Onayları', color: '#a855f7' },
    { path: '/admin/role-management', icon: Shield, label: 'Rol Yönetimi', color: '#6366f1' },
    { path: '/admin/meetings', icon: Calendar, label: 'Görüşme Akışı', color: '#ec4899' },
    { path: '/admin/global-search', icon: HelpCircle, label: 'Global Arama', color: '#0ea5e9' },
    { path: '/admin/records', icon: FileText, label: 'İdari Kayıtlar', color: '#f97316' },
    { path: '/admin/announcements', icon: Bell, label: 'Duyurular', color: '#f59e0b' },
    { path: '/admin/documents', icon: FileText, label: 'Belge Merkezi', color: '#ec4899' },
    { path: '/admin/student-registration', icon: Users, label: 'Öğrenci Kaydı', color: '#06b6d4' },
    { path: '/admin/parent-registration', icon: UserCheck, label: 'Veli Kaydı', color: '#7c3aed' },
    { path: '/admin/staff-registration', icon: UserCheck, label: 'Personel Kaydı', color: '#a855f7' },
    { path: '/admin/branch-comparison', icon: BarChart3, label: 'Şube Karşılaştırma', color: '#f97316' },
    { path: '/content', icon: BookOpen, label: 'İçerikler', color: '#f43f5e' },
    { path: '/questions', icon: HelpCircle, label: 'Sorular', color: '#14b8a6' },
    { path: '/exams', icon: FileQuestion, label: 'Sınavlar', color: '#a855f7' },
    { path: '/reports', icon: BarChart3, label: 'Raporlar', color: '#22c55e' },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar', color: '#0ea5e9' },
    { path: '/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
  administrative: [
    { path: '/admin/operations', icon: Activity, label: 'Operasyon', color: '#14b8a6' },
    { path: '/admin/task-center', icon: CheckSquare, label: 'Görev Merkezi', color: '#f59e0b' },
    { path: '/admin/schedule', icon: Calendar, label: 'Ders Programı', color: '#06b6d4' },
    { path: '/admin/records', icon: FileText, label: 'İdari Kayıtlar', color: '#f97316' },
    { path: '/admin/announcements', icon: Bell, label: 'Duyurular', color: '#f59e0b' },
    { path: '/admin/documents', icon: FileText, label: 'Belge Merkezi', color: '#ec4899' },
    { path: '/admin/personnel-approvals', icon: CheckSquare, label: 'Personel Onayları', color: '#a855f7' },
    { path: '/admin/finance-approvals', icon: CheckSquare, label: 'Finans Onayları', color: '#a855f7' },
    { path: '/admin/role-management', icon: Shield, label: 'Rol Yönetimi', color: '#6366f1' },
    { path: '/admin/meetings', icon: Calendar, label: 'Görüşme Akışı', color: '#ec4899' },
    { path: '/admin/parent-registration', icon: UserCheck, label: 'Veli Kaydı', color: '#7c3aed' },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar', color: '#0ea5e9' },
    { path: '/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
  finance: [
    { path: '/finance/dashboard', icon: LayoutDashboard, label: 'Muhasebe Özet', color: '#3b82f6' },
    { path: '/finance/student-accounts', icon: Users, label: 'Öğrenci Hesapları', color: '#8b5cf6' },
    { path: '/finance/collections', icon: CreditCard, label: 'Tahsilatlar', color: '#10b981' },
    { path: '/finance/installments', icon: Receipt, label: 'Taksitler', color: '#f59e0b' },
    { path: '/finance/invoices-receipts', icon: FileText, label: 'Fatura & Makbuz', color: '#06b6d4' },
    { path: '/finance/collection-calendar', icon: Calendar, label: 'Tahsilat Takvimi', color: '#14b8a6' },
    { path: '/finance/reconciliation', icon: Shield, label: 'Mutabakat', color: '#22c55e' },
    { path: '/finance/bulk-actions', icon: Layers, label: 'Toplu İşlemler', color: '#f97316' },
    { path: '/finance/audit-log', icon: Activity, label: 'Audit Log', color: '#6366f1' },
    { path: '/finance/discounts-scholarships', icon: Gift, label: 'İndirim & Burs', color: '#ec4899' },
    { path: '/finance/late-payments', icon: AlertCircle, label: 'Gecikenler', color: '#ef4444' },
    { path: '/finance/overdue-rules', icon: Bell, label: 'Gecikme Kuralları', color: '#f43f5e' },
    { path: '/finance/salary', icon: Wallet, label: 'Maaş Yönetimi', color: '#10b981' },
    { path: '/finance/cash-report', icon: Receipt, label: 'Kasa Raporu', color: '#a855f7' },
    { path: '/finance/ledger', icon: BookOpen, label: 'Hesap Defteri', color: '#6366f1' },
    { path: '/finance/export', icon: Download, label: 'Dışa Aktar', color: '#84cc16' },
    { path: '/chat', icon: MessageSquare, label: 'Mesajlar', color: '#0ea5e9' },
    { path: '/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
  superadmin: [
    { path: '/sa/dashboard', icon: LayoutDashboard, label: 'Platform Özet', color: '#3b82f6' },
    { path: '/sa/tenants', icon: Building2, label: 'Kurumlar', color: '#8b5cf6' },
    { path: '/sa/plans', icon: Package, label: 'Paketler', color: '#10b981' },
    { path: '/sa/billing', icon: Wallet, label: 'Faturalama', color: '#f59e0b' },
    { path: '/sa/limits', icon: Server, label: 'Limitler', color: '#ef4444' },
    { path: '/sa/ai', icon: Bot, label: 'AI Yönetimi', color: '#D9790B', special: true },
    { path: '/sa/customization', icon: Palette, label: 'Kurum Özelleştirme', color: '#ec4899' },
    { path: '/sa/system', icon: Settings, label: 'Sistem', color: '#06b6d4' },
    { path: '/sa/support', icon: Ticket, label: 'Destek', color: '#a855f7' },
    { path: '/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
  teacher: [
    { path: '/t/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: '#3b82f6' },
    { path: '/t/schedule', icon: Calendar, label: 'Ders Programı', color: '#06b6d4' },
    { path: '/t/attendance', icon: ClipboardCheck, label: 'Yoklama', color: '#84cc16' },
    { path: '/t/live-lessons', icon: Video, label: 'Canlı Dersler', color: '#ef4444', pulse: true },
    { path: '/t/live-room', icon: Server, label: 'Canlı Ders Odası', color: '#fb7185' },
    { path: '/t/content', icon: BookOpen, label: 'Konu Anlatımı', color: '#f43f5e' },
    { path: '/t/question-bank', icon: Brain, label: 'Soru Bankası', color: '#8b5cf6', special: true },
    { path: '/t/questions', icon: HelpCircle, label: 'Soru Kutusu', color: '#14b8a6' },
    { path: '/t/exams', icon: FileQuestion, label: 'Sınavlar', color: '#a855f7' },
    { path: '/t/assignments', icon: FileText, label: 'Ödevler', color: '#f59e0b' },
    { path: '/t/submissions', icon: CheckSquare, label: 'Teslim Merkezi', color: '#10b981' },
    { path: '/t/reports', icon: BarChart3, label: 'Raporlar', color: '#22c55e' },
    { path: '/t/announcements', icon: Bell, label: 'Duyurular', color: '#f59e0b' },
    { path: '/t/meeting-approvals', icon: Calendar, label: 'Görüşme Onayları', color: '#ec4899' },
    { path: '/t/profile', icon: User, label: 'Profilim', color: '#8b5cf6' },
    { path: '/t/chat', icon: MessageSquare, label: 'Mesajlar', color: '#0ea5e9' },
    { path: '/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
  student: [
    { path: '/s/dashboard', icon: LayoutDashboard, label: 'Ana Sayfa', color: '#3b82f6', special: true },
    { path: '/s/schedule', icon: Calendar, label: 'Ders Programı', color: '#06b6d4' },
    { path: '/s/study-plan', icon: ClipboardCheck, label: 'Çalışma Planım', color: '#22c55e' },
    { path: '/s/live', icon: Video, label: 'Canlı Dersler', color: '#ef4444', pulse: true },
    { path: '/s/attendance', icon: ClipboardCheck, label: 'Devamsızlık', color: '#84cc16' },
    { path: '/s/attendance-qr', icon: QrCode, label: 'QR Yoklama', color: '#6366f1' },
    { path: '/s/content', icon: BookOpen, label: 'Konu Anlatımı', color: '#f43f5e' },
    { path: '/s/exams', icon: FileQuestion, label: 'Deneme Sınavları', color: '#a855f7' },
    { path: '/s/exam-results', icon: BarChart3, label: 'Sınav Sonuçlarım', color: '#2563eb' },
    { path: '/s/questions', icon: Brain, label: 'Soru Bankası', color: '#14b8a6' },
    { path: '/s/question-box', icon: HelpCircle, label: 'Soru Sor', color: '#0ea5e9' },
    { path: '/s/wrong-answers', icon: AlertCircle, label: 'Yanlışlarım', color: '#f59e0b' },
    { path: '/s/assignments', icon: FileText, label: 'Ödevler', color: '#f59e0b' },
    { path: '/s/ai', icon: Sparkles, label: 'CourseIntellect AI', color: '#D9790B', special: true, new: true },
    { path: '/s/announcements', icon: Bell, label: 'Duyurular', color: '#f59e0b' },
    { path: '/s/chat', icon: MessageSquare, label: 'Mesajlar', color: '#0ea5e9' },
    { path: '/s/profile', icon: User, label: 'Profilim', color: '#8b5cf6' },
    { path: '/s/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
  parent: [
    { path: '/p/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: '#3b82f6' },
    { path: '/p/children', icon: Users, label: 'Çocuklarım', color: '#8b5cf6' },
    { path: '/p/attendance', icon: ClipboardCheck, label: 'Devamsızlık', color: '#84cc16' },
    { path: '/p/exams', icon: FileQuestion, label: 'Sınav Sonuçları', color: '#a855f7' },
    { path: '/p/payments', icon: CreditCard, label: 'Ödemeler', color: '#10b981' },
    { path: '/p/receipts', icon: Receipt, label: 'Makbuz Arşivi', color: '#06b6d4' },
    { path: '/p/weekly-report', icon: FileText, label: 'Haftalık Rapor', color: '#f59e0b' },
    { path: '/p/feedback', icon: Bell, label: 'Geri Bildirim', color: '#14b8a6' },
    { path: '/p/meetings', icon: Calendar, label: 'Görüşmeler', color: '#ec4899' },
    { path: '/p/excuse-request', icon: FileText, label: 'Mazeret Bildirimi', color: '#f97316' },
    { path: '/p/announcements', icon: Bell, label: 'Duyurular', color: '#f59e0b' },
    { path: '/p/chat', icon: MessageSquare, label: 'Mesajlar', color: '#0ea5e9' },
    { path: '/p/profile', icon: User, label: 'Profilim', color: '#8b5cf6' },
    { path: '/settings', icon: Settings, label: 'Ayarlar', color: '#64748b' },
  ],
};

// Student stats component for sidebar — fetches real XP data from API
function StudentStats({ collapsed }) {
  const [stats, setStats] = useState({ xp: 0, streak: 0, level: 1, xpToNext: 100 });

  useEffect(() => {
    let cancelled = false;
    import('../../lib/api/modules').then(({ fetchStudyPlan }) => {
      fetchStudyPlan()
        .then((plan) => {
          if (cancelled) return;
          const xp = Number(plan?.xpPoints) || 0;
          const streak = Number(plan?.streakCount) || 0;
          const level = Math.max(1, Math.floor(xp / 100) + 1);
          const xpToNext = Math.max(0, 100 - (xp % 100));
          setStats({ xp, streak, level, xpToNext });
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  const progressPercent = stats.xpToNext < 100 ? 100 - stats.xpToNext : 0;

  return (
    <AnimatePresence>
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mx-3 mb-4 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
              >
                <Flame className="h-5 w-5 text-orange-400" />
              </motion.div>
              <span className="text-sm font-medium text-white/90">{stats.streak} Gün Serisi</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">{stats.xp.toLocaleString('tr-TR')} XP</span>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, progressPercent)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
          <p className="text-xs text-white/60 mt-2">Seviye {stats.level} • {stats.xpToNext} XP kaldı</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModernSidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, user } = useApp();
  const location = useLocation();
  const { tenantLogo, tenantName, primaryColor, accentColor } = useTheme();

  const userRole = user?.role || 'student';
  const menuItems = menuConfigs[userRole] || menuConfigs.student;
  const isStudent = userRole === 'student';

  // Sidebar variants for animation
  const sidebarVariants = {
    expanded: {
      width: 280,
      x: 0,
      transition: { duration: 0.3, ease: 'easeInOut' }
    },
    collapsed: {
      width: 280,
      x: -280,
      transition: { duration: 0.3, ease: 'easeInOut' }
    }
  };

  return (
    <>
      {/* Hamburger Menu Button - visible when sidebar is collapsed */}
      <AnimatePresence>
        {sidebarCollapsed && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarCollapsed(false)}
            className="fixed top-4 left-4 z-50 p-3 rounded-xl text-white shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: `linear-gradient(to right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))` }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            data-testid="sidebar-open-button"
          >
            <Menu className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarCollapsed(true)}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        data-testid="sidebar"
        variants={sidebarVariants}
        initial={false}
        animate={sidebarCollapsed ? 'collapsed' : 'expanded'}
        className={cn(
          "h-screen text-white flex flex-col border-r border-white/10 z-40 overflow-hidden flex-shrink-0",
          "fixed lg:relative"
        )}
        style={{
          width: 280,
          background: `linear-gradient(to bottom, var(--sidebar-from, #00354F), var(--sidebar-via, #002a40), var(--sidebar-to, #001f30))`,
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <GlowingOrb color={accentColor} size={200} className="-top-20 -right-20" />
          <GlowingOrb color={primaryColor} size={150} className="bottom-20 -left-20" />
          <FloatingParticles count={15} colors={[accentColor, primaryColor, '#22c55e']} />
        </div>

        {/* Logo Section with Close Button */}
        <div className="relative h-16 flex items-center justify-between px-4 border-b border-white/10">
          <motion.div 
            className="flex items-center gap-3 overflow-hidden"
            initial={false}
          >
            {tenantLogo ? (
              <motion.img
                src={tenantLogo}
                alt={tenantName || 'Logo'}
                className="h-10 w-10 rounded-xl object-contain flex-shrink-0"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <motion.div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: `linear-gradient(to bottom right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))` }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <GraduationCap className="h-6 w-6 text-white" />
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              className="overflow-hidden"
            >
              <span className="font-heading font-bold text-lg whitespace-nowrap bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                {tenantName || 'CourseIntellect'}
              </span>
            </motion.div>
          </motion.div>

          {/* Close Button */}
          <motion.button
            onClick={() => setSidebarCollapsed(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            data-testid="sidebar-close-button"
          >
            <X className="h-5 w-5 text-white/70" />
          </motion.button>
        </div>

        {/* Student XP Stats */}
        {isStudent && <StudentStats collapsed={false} />}

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-white/10">
          <TooltipProvider delayDuration={0}>
            <ul className="space-y-1">
              {menuItems.map((item, index) => {
                const isActive = location.pathname === item.path || 
                                location.pathname.startsWith(item.path + '/');
                const Icon = item.icon;

                return (
                  <motion.li 
                    key={item.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.path}
                          onClick={() => {
                            // Close sidebar on mobile after navigation
                            if (window.innerWidth < 1024) {
                              setSidebarCollapsed(true);
                            }
                          }}
                          data-testid={`nav-${item.path.replace(/\//g, '-').slice(1)}`}
                          className={cn(
                            "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden",
                            isActive
                              ? "text-white shadow-lg"
                              : "hover:bg-white/10 text-white/70 hover:text-white"
                          )}
                          style={isActive ? { background: `linear-gradient(to right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))` } : undefined}
                        >
                          {/* Animated background on hover */}
                          {!isActive && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0"
                              initial={{ x: '-100%' }}
                              whileHover={{ x: '100%' }}
                              transition={{ duration: 0.5 }}
                            />
                          )}

                          {/* Icon with animations */}
                          <motion.div
                            className="relative z-10"
                            whileHover={{ scale: 1.2, rotate: isActive ? 0 : 10 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <div 
                              className={cn(
                                "p-2 rounded-lg transition-all duration-300",
                                isActive 
                                  ? "bg-white/20" 
                                  : "bg-transparent group-hover:bg-white/10"
                              )}
                              style={{ 
                                boxShadow: isActive ? `0 0 15px ${item.color}40` : 'none'
                              }}
                            >
                              <Icon 
                                className="h-5 w-5 flex-shrink-0" 
                                style={{ color: isActive ? '#fff' : item.color }}
                              />
                            </div>
                            
                            {/* Pulse effect for live items */}
                            {item.pulse && (
                              <motion.div
                                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                            )}
                            
                            {/* New badge */}
                            {item.new && (
                              <motion.div
                                className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-[10px] font-bold"
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                YENİ
                              </motion.div>
                            )}
                          </motion.div>

                          {/* Label */}
                          <motion.span
                            className={cn(
                              "relative z-10 text-sm font-medium whitespace-nowrap",
                              item.special && !isActive && "bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"
                            )}
                          >
                            {item.label}
                          </motion.span>

                          {/* Active indicator */}
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"
                              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                          )}
                        </NavLink>
                      </TooltipTrigger>
                    </Tooltip>
                  </motion.li>
                );
              })}
            </ul>
          </TooltipProvider>
        </nav>

        {/* User info section */}
        <div className="relative border-t border-white/10 p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-2 rounded-xl bg-white/5 backdrop-blur-sm"
          >
            <motion.div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ background: `linear-gradient(to bottom right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))` }}
              whileHover={{ scale: 1.1 }}
            >
              {user?.name?.[0] || 'Ö'}
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Öğrenci'}</p>
              <p className="text-xs text-white/60 truncate">{user?.email || 'ogrenci@okul.com'}</p>
            </div>
          </motion.div>
        </div>

        {/* Project Logo at the bottom */}
        <div className="relative border-t border-white/10 p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <img 
              src={logoImage} 
              alt="CourseIntellect Logo" 
              className="h-12 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            />
          </motion.div>
          <motion.p 
            className="text-[10px] text-white/40 text-center mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            © 2025 CourseIntellect
          </motion.p>
        </div>
      </motion.aside>
    </>
  );
}
