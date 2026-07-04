import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getDisabledFeatureKeys, isPathDisabled } from "../../lib/tenantFeatures";
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
  Ticket,
  Sparkles,
  Brain,
  Flame,
  Star,
  Menu,
  X,
  Palette,
  Bot,
  LifeBuoy,
  BusFront,
  UtensilsCrossed,
  KeyRound,
  ChevronDown,
} from "lucide-react";
import { Activity, Layers, Shield, ShieldCheck, CalendarPlus, CalendarRange } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { cn } from "../../lib/utils";
import {
  FloatingParticles,
  GlowingOrb,
} from "../animations/AnimatedBackground";
import logoImage from "../../assets/brand/logo.png";
import { useTheme } from "../../context/ThemeContext";
import { getUserRoles, mergeMenuItemsForRoles } from "../../lib/permissions";

// Menu items for each role
// Muhasebe rolündeki tüm finans sayfaları. Kurum yöneticisi (admin) de bu
// sayfaların tamamına "Finans" grubu altında erişebilsin diye paylaşılır.
const FINANCE_MENU_ITEMS = [
  { path: "/finance/dashboard", icon: LayoutDashboard, label: "Muhasebe Özet", color: "#3b82f6" },
  { path: "/finance/student-accounts", icon: Users, label: "Öğrenci Hesapları", color: "#8b5cf6" },
  { path: "/finance/collections", icon: CreditCard, label: "Tahsilatlar", color: "#10b981" },
  { path: "/finance/installments", icon: Receipt, label: "Taksitler", color: "#f59e0b" },
  { path: "/finance/invoices-receipts", icon: FileText, label: "Fatura & Makbuz", color: "#06b6d4" },
  { path: "/finance/collection-calendar", icon: Calendar, label: "Tahsilat Takvimi", color: "#14b8a6" },
  { path: "/finance/reconciliation", icon: Shield, label: "Mutabakat", color: "#22c55e" },
  { path: "/finance/bulk-actions", icon: Layers, label: "Toplu İşlemler", color: "#f97316" },
  { path: "/finance/audit-log", icon: Activity, label: "Audit Log", color: "#6366f1" },
  { path: "/finance/discounts-scholarships", icon: Gift, label: "İndirim & Burs", color: "#ec4899" },
  { path: "/finance/late-payments", icon: AlertCircle, label: "Gecikenler", color: "#ef4444" },
  { path: "/finance/overdue-rules", icon: Bell, label: "Gecikme Kuralları", color: "#f43f5e" },
  { path: "/finance/salary", icon: Wallet, label: "Maaş Yönetimi", color: "#10b981" },
  { path: "/finance/cash-report", icon: Receipt, label: "Kasa Raporu", color: "#a855f7" },
  { path: "/finance/ledger", icon: BookOpen, label: "Hesap Defteri", color: "#6366f1" },
  { path: "/finance/export", icon: Download, label: "Dışa Aktar", color: "#84cc16" },
];

export const menuConfigs = {
  admin: [
    {
      path: "/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      color: "#3b82f6",
    },
    {
      path: "/admin/kpi",
      icon: BarChart3,
      label: "Kurum Özeti",
      color: "#22c55e",
    },
    {
      path: "/admin/academics",
      icon: GraduationCap,
      label: "Akademik Yönetim",
      color: "#2563eb",
    },
    {
      path: "/admin/operations",
      icon: Activity,
      label: "Operasyon",
      color: "#14b8a6",
    },
    {
      path: "/admin/service-tracking",
      icon: BusFront,
      label: "Servis Takip",
      color: "#0f766e",
    },
    {
      path: "/cafeteria/menu",
      icon: UtensilsCrossed,
      label: "Yemekhane",
      color: "#f97316",
    },
    {
      path: "/admin/finance",
      icon: Wallet,
      label: "Finans Kontrolü",
      color: "#16a34a",
    },
    // Kurum yöneticisi muhasebedeki tüm finans sayfalarına erişir.
    ...FINANCE_MENU_ITEMS,
    {
      path: "/admin/exam-papers",
      icon: FileText,
      label: "Sınav Kağıtları",
      color: "#a855f7",
    },
    {
      path: "/admin/duty-create",
      icon: CalendarPlus,
      label: "Nöbet Oluştur",
      color: "#f97316",
    },
    {
      path: "/admin/duties",
      icon: ShieldCheck,
      label: "Tüm Nöbetler",
      color: "#f59e0b",
    },
    {
      path: "/admin/timetable",
      icon: CalendarRange,
      label: "Öğretmen Programı",
      color: "#06b6d4",
    },
    {
      path: "/admin/task-center",
      icon: CheckSquare,
      label: "Görev Merkezi",
      color: "#f59e0b",
    },
    { path: "/students", icon: Users, label: "Öğrenciler", color: "#8b5cf6" },
    { path: "/parents", icon: UserCheck, label: "Veliler", color: "#ec4899" },
    {
      path: "/teachers",
      icon: GraduationCap,
      label: "Öğretmenler",
      color: "#10b981",
    },
    {
      path: "/classes",
      icon: School,
      label: "Sınıflar & Gruplar",
      color: "#f59e0b",
    },
    {
      path: "/schedule",
      icon: Calendar,
      label: "Ders Programı",
      color: "#06b6d4",
    },
    {
      path: "/attendance",
      icon: ClipboardCheck,
      label: "Devamsızlık",
      color: "#84cc16",
    },
    {
      path: "/admin/finance-approvals",
      icon: CheckSquare,
      label: "Finans Onayları",
      color: "#a855f7",
    },
    {
      path: "/admin/personnel-approvals",
      icon: CheckSquare,
      label: "Personel Onayları",
      color: "#a855f7",
    },
    {
      path: "/admin/staff-hr",
      icon: CheckSquare,
      label: "Personel / İK",
      color: "#0ea5e9",
    },
    {
      path: "/admin/audit-log",
      icon: CheckSquare,
      label: "Denetim Kayıtları",
      color: "#64748b",
    },
    {
      path: "/admin/org-units",
      icon: CheckSquare,
      label: "Organizasyon Birimleri",
      color: "#0d9488",
    },
    {
      path: "/admin/rbac",
      icon: CheckSquare,
      label: "Yetki Matrisi",
      color: "#9333ea",
    },
    {
      path: "/admin/password-reset-requests",
      icon: KeyRound,
      label: "Şifre Talepleri",
      color: "#f97316",
    },
    {
      path: "/admin/role-management",
      icon: Shield,
      label: "Rol Yönetimi",
      color: "#6366f1",
    },
    {
      path: "/admin/meetings",
      icon: Calendar,
      label: "Görüşme Akışı",
      color: "#ec4899",
    },
    {
      path: "/admin/global-search",
      icon: HelpCircle,
      label: "Kurum İçi Arama",
      color: "#0ea5e9",
    },
    {
      path: "/admin/records",
      icon: FileText,
      label: "İdari Kayıtlar",
      color: "#f97316",
    },
    {
      path: "/admin/administrative-units",
      icon: Building2,
      label: "İdari Birimler",
      color: "#0f766e",
    },
    {
      path: "/admin/announcements",
      icon: Bell,
      label: "Duyurular",
      color: "#f59e0b",
    },
    {
      path: "/admin/notifications",
      icon: Bell,
      label: "Bildirimler",
      color: "#ef4444",
    },
    {
      path: "/admin/documents",
      icon: FileText,
      label: "Belge Merkezi",
      color: "#ec4899",
    },
    {
      path: "/admin/student-registration",
      icon: Users,
      label: "Öğrenci Kaydı",
      color: "#06b6d4",
    },
    {
      path: "/admin/staff-registration",
      icon: UserCheck,
      label: "Personel Kaydı",
      color: "#a855f7",
    },
    {
      path: "/admin/accounting-registration",
      icon: Wallet,
      label: "Muhasebe Kaydı",
      color: "#16a34a",
    },
    {
      path: "/admin/branch-registration",
      icon: Building2,
      label: "Şube Kaydı",
      color: "#0ea5e9",
    },
    {
      path: "/admin/branch-comparison",
      icon: BarChart3,
      label: "Şube Karşılaştırma",
      color: "#f97316",
    },
    { path: "/content", icon: BookOpen, label: "İçerikler", color: "#f43f5e" },
    { path: "/admin/courses", icon: BookOpen, label: "Kurs Yönetimi", color: "#f43f5e" },
    {
      path: "/questions",
      icon: HelpCircle,
      label: "Sorular",
      color: "#14b8a6",
    },
    { path: "/exams", icon: FileQuestion, label: "Sınavlar", color: "#a855f7" },
    { path: "/reports", icon: BarChart3, label: "Raporlar", color: "#22c55e" },
    { path: "/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
    { path: "/admin/destek", icon: LifeBuoy, label: "Destek", color: "#a855f7" },
    { path: "/admin/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  administrative: [
    {
      path: "/admin/operations",
      icon: Activity,
      label: "Operasyon",
      color: "#14b8a6",
    },
    {
      path: "/admin/duty-create",
      icon: CalendarPlus,
      label: "Nöbet Oluştur",
      color: "#f97316",
    },
    {
      path: "/admin/duties",
      icon: ShieldCheck,
      label: "Tüm Nöbetler",
      color: "#f59e0b",
    },
    {
      path: "/admin/timetable",
      icon: CalendarRange,
      label: "Öğretmen Programı",
      color: "#06b6d4",
    },
    {
      path: "/admin/service-tracking",
      icon: BusFront,
      label: "Servis Takip",
      color: "#0f766e",
    },
    {
      path: "/cafeteria/menu",
      icon: UtensilsCrossed,
      label: "Yemekhane",
      color: "#f97316",
    },
    {
      path: "/admin/task-center",
      icon: CheckSquare,
      label: "Görev Merkezi",
      color: "#f59e0b",
    },
    {
      path: "/admin/schedule",
      icon: Calendar,
      label: "Ders Programı",
      color: "#06b6d4",
    },
    {
      path: "/admin/records",
      icon: FileText,
      label: "İdari Kayıtlar",
      color: "#f97316",
    },
    {
      path: "/admin/announcements",
      icon: Bell,
      label: "Duyurular",
      color: "#f59e0b",
    },
    {
      path: "/admin/documents",
      icon: FileText,
      label: "Belge Merkezi",
      color: "#ec4899",
    },
    {
      path: "/admin/staff-hr",
      icon: CheckSquare,
      label: "Personel / İK",
      color: "#0ea5e9",
    },
    {
      path: "/admin/org-units",
      icon: CheckSquare,
      label: "Organizasyon Birimleri",
      color: "#0d9488",
    },
    {
      path: "/admin/password-reset-requests",
      icon: KeyRound,
      label: "Şifre Talepleri",
      color: "#f97316",
    },
    {
      path: "/admin/meetings",
      icon: Calendar,
      label: "Görüşme Akışı",
      color: "#ec4899",
    },
    { path: "/reports", icon: BarChart3, label: "Raporlar", color: "#22c55e" },
    {
      path: "/admin/staff-registration",
      icon: UserCheck,
      label: "Personel Kaydı",
      color: "#a855f7",
    },
    { path: "/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
    { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  finance: [
    {
      path: "/finance/dashboard",
      icon: LayoutDashboard,
      label: "Muhasebe Özet",
      color: "#3b82f6",
    },
    {
      path: "/finance/student-accounts",
      icon: Users,
      label: "Öğrenci Hesapları",
      color: "#8b5cf6",
    },
    {
      path: "/finance/collections",
      icon: CreditCard,
      label: "Tahsilatlar",
      color: "#10b981",
    },
    {
      path: "/finance/installments",
      icon: Receipt,
      label: "Taksitler",
      color: "#f59e0b",
    },
    {
      path: "/finance/invoices-receipts",
      icon: FileText,
      label: "Fatura & Makbuz",
      color: "#06b6d4",
    },
    {
      path: "/finance/collection-calendar",
      icon: Calendar,
      label: "Tahsilat Takvimi",
      color: "#14b8a6",
    },
    {
      path: "/finance/reconciliation",
      icon: Shield,
      label: "Mutabakat",
      color: "#22c55e",
    },
    {
      path: "/finance/bulk-actions",
      icon: Layers,
      label: "Toplu İşlemler",
      color: "#f97316",
    },
    {
      path: "/finance/audit-log",
      icon: Activity,
      label: "Audit Log",
      color: "#6366f1",
    },
    {
      path: "/finance/discounts-scholarships",
      icon: Gift,
      label: "İndirim & Burs",
      color: "#ec4899",
    },
    {
      path: "/finance/late-payments",
      icon: AlertCircle,
      label: "Gecikenler",
      color: "#ef4444",
    },
    {
      path: "/finance/overdue-rules",
      icon: Bell,
      label: "Gecikme Kuralları",
      color: "#f43f5e",
    },
    {
      path: "/finance/salary",
      icon: Wallet,
      label: "Maaş Yönetimi",
      color: "#10b981",
    },
    {
      path: "/finance/cash-report",
      icon: Receipt,
      label: "Kasa Raporu",
      color: "#a855f7",
    },
    {
      path: "/finance/ledger",
      icon: BookOpen,
      label: "Hesap Defteri",
      color: "#6366f1",
    },
    {
      path: "/finance/export",
      icon: Download,
      label: "Dışa Aktar",
      color: "#84cc16",
    },
    { path: "/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
    { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  superadmin: [
    {
      path: "/sa/dashboard",
      icon: LayoutDashboard,
      label: "Platform Özet",
      color: "#3b82f6",
    },
    {
      path: "/sa/tenants",
      icon: Building2,
      label: "Kurumlar",
      color: "#8b5cf6",
    },
    { path: "/sa/plans", icon: Package, label: "Paketler", color: "#10b981" },
    {
      path: "/sa/billing",
      icon: Wallet,
      label: "Faturalama",
      color: "#f59e0b",
    },
    { path: "/sa/limits", icon: Server, label: "Limitler", color: "#ef4444" },
    {
      path: "/sa/ai",
      icon: Bot,
      label: "AI Yönetimi",
      color: "#D9790B",
      special: true,
    },
    {
      path: "/sa/customization",
      icon: Palette,
      label: "Kurum Özelleştirme",
      color: "#ec4899",
    },
    { path: "/sa/system", icon: Settings, label: "Sistem", color: "#06b6d4" },
    { path: "/sa/support", icon: Ticket, label: "Destek", color: "#a855f7" },
    { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  teacher: [
    {
      path: "/t/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      color: "#3b82f6",
    },
    {
      path: "/t/schedule",
      icon: Calendar,
      label: "Ders Programı",
      color: "#06b6d4",
    },
    {
      path: "/t/attendance",
      icon: ClipboardCheck,
      label: "Yoklama",
      color: "#84cc16",
    },
    {
      path: "/t/live-lessons",
      icon: Video,
      label: "Canlı Dersler",
      color: "#ef4444",
      pulse: true,
    },
    {
      path: "/t/live-room",
      icon: Server,
      label: "Canlı Ders Odası",
      color: "#fb7185",
    },
    {
      path: "/t/content",
      icon: BookOpen,
      label: "Konu Anlatımı",
      color: "#f43f5e",
    },
    {
      path: "/t/question-bank",
      icon: Brain,
      label: "Soru Bankası",
      color: "#8b5cf6",
      special: true,
    },
    {
      path: "/t/questions",
      icon: HelpCircle,
      label: "Soru Kutusu",
      color: "#14b8a6",
    },
    {
      path: "/t/exams",
      icon: FileQuestion,
      label: "Sınavlar",
      color: "#a855f7",
    },
    {
      path: "/t/grade-entry",
      icon: FileText,
      label: "Not Girişi",
      color: "#ff8a00",
    },
    {
      path: "/t/mock-exams",
      icon: ClipboardCheck,
      label: "Deneme Sınavları",
      color: "#f97316",
    },
    {
      path: "/t/student-exams",
      icon: ClipboardCheck,
      label: "Öğrenci Sınavları",
      color: "#0ea5e9",
    },
    {
      path: "/t/assignments",
      icon: FileText,
      label: "Ödevler",
      color: "#f59e0b",
    },
    {
      path: "/t/submissions",
      icon: CheckSquare,
      label: "Teslim Merkezi",
      color: "#10b981",
    },
    {
      path: "/t/reports",
      icon: BarChart3,
      label: "Raporlar",
      color: "#22c55e",
    },
    {
      path: "/t/duties",
      icon: ShieldCheck,
      label: "Görevlerim",
      color: "#f97316",
    },
    {
      path: "/t/announcements",
      icon: Bell,
      label: "Duyurular",
      color: "#f59e0b",
    },
    {
      path: "/t/meeting-approvals",
      icon: Calendar,
      label: "Görüşme Onayları",
      color: "#ec4899",
    },
    { path: "/t/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    {
      path: "/t/chat",
      icon: MessageSquare,
      label: "Mesajlar",
      color: "#0ea5e9",
    },
    { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  student: [
    {
      path: "/s/dashboard",
      icon: LayoutDashboard,
      label: "Ana Sayfa",
      color: "#3b82f6",
      special: true,
    },
    {
      path: "/s/schedule",
      icon: Calendar,
      label: "Ders Programı",
      color: "#06b6d4",
    },
    {
      path: "/s/study-plan",
      icon: ClipboardCheck,
      label: "Çalışma Planım",
      color: "#22c55e",
    },
    {
      path: "/s/live",
      icon: Video,
      label: "Canlı Dersler",
      color: "#ef4444",
      pulse: true,
    },
    {
      path: "/s/attendance",
      icon: ClipboardCheck,
      label: "Devamsızlık",
      color: "#84cc16",
    },
    {
      path: "/s/attendance-qr",
      icon: QrCode,
      label: "QR Yoklama",
      color: "#6366f1",
    },
    {
      path: "/s/content",
      icon: BookOpen,
      label: "Konu Anlatımı",
      color: "#f43f5e",
    },
    {
      path: "/s/exams",
      icon: FileQuestion,
      label: "Sınavlarım",
      color: "#a855f7",
    },
    {
      path: "/s/mock-exams",
      icon: ClipboardCheck,
      label: "Deneme Sınavları",
      color: "#f97316",
    },
    {
      path: "/s/exam-results",
      icon: BarChart3,
      label: "Sınav Sonuçlarım",
      color: "#2563eb",
    },
    {
      path: "/s/questions",
      icon: Brain,
      label: "Soru Bankası",
      color: "#14b8a6",
    },
    {
      path: "/s/question-box",
      icon: HelpCircle,
      label: "Soru Sor",
      color: "#0ea5e9",
    },
    {
      path: "/s/wrong-answers",
      icon: AlertCircle,
      label: "Yanlışlarım",
      color: "#f59e0b",
    },
    {
      path: "/s/assignments",
      icon: FileText,
      label: "Ödevler",
      color: "#f59e0b",
    },
    {
      path: "/s/cafeteria",
      icon: UtensilsCrossed,
      label: "Yemekhane",
      color: "#f97316",
    },
    {
      path: "/s/ai",
      icon: Sparkles,
      label: "SchoolAsist AI",
      color: "#D9790B",
      special: true,
      new: true,
    },
    {
      path: "/s/announcements",
      icon: Bell,
      label: "Duyurular",
      color: "#f59e0b",
    },
    {
      path: "/s/chat",
      icon: MessageSquare,
      label: "Mesajlar",
      color: "#0ea5e9",
    },
    { path: "/s/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    { path: "/s/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  parent: [
    {
      path: "/p/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      color: "#3b82f6",
    },
    { path: "/p/children", icon: Users, label: "Çocuklarım", color: "#8b5cf6" },
    {
      path: "/p/attendance",
      icon: ClipboardCheck,
      label: "Devamsızlık",
      color: "#84cc16",
    },
    {
      path: "/p/exams",
      icon: FileQuestion,
      label: "Sınav Sonuçları",
      color: "#a855f7",
    },
    {
      path: "/p/payments",
      icon: CreditCard,
      label: "Ödemeler",
      color: "#10b981",
    },
    {
      path: "/p/receipts",
      icon: Receipt,
      label: "Makbuz Arşivi",
      color: "#06b6d4",
    },
    {
      path: "/p/weekly-report",
      icon: FileText,
      label: "Haftalık Rapor",
      color: "#f59e0b",
    },
    {
      path: "/p/cafeteria",
      icon: UtensilsCrossed,
      label: "Yemekhane",
      color: "#f97316",
    },
    {
      path: "/p/feedback",
      icon: Bell,
      label: "Geri Bildirim",
      color: "#14b8a6",
    },
    {
      path: "/p/meetings",
      icon: Calendar,
      label: "Görüşmeler",
      color: "#ec4899",
    },
    {
      path: "/p/excuse-request",
      icon: FileText,
      label: "Mazeret Bildirimi",
      color: "#f97316",
    },
    {
      path: "/p/requests",
      icon: FileText,
      label: "Taleplerim",
      color: "#6366f1",
    },
    {
      path: "/p/academic",
      icon: FileText,
      label: "Akademik Özet",
      color: "#16a34a",
    },
    {
      path: "/p/service",
      icon: FileText,
      label: "Servis Takip",
      color: "#0891b2",
    },
    {
      path: "/p/cafeteria",
      icon: FileText,
      label: "Yemek Menüsü",
      color: "#ea580c",
    },
    {
      path: "/p/announcements",
      icon: Bell,
      label: "Duyurular",
      color: "#f59e0b",
    },
    {
      path: "/p/chat",
      icon: MessageSquare,
      label: "Mesajlar",
      color: "#0ea5e9",
    },
    { path: "/p/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
  ],
  cafeteria: [
    {
      path: "/cafeteria/menu",
      icon: UtensilsCrossed,
      label: "Haftalık Yemek Programı",
      color: "#f97316",
      special: true,
    },
  ],
};

export const ROLE_LABELS = {
  admin: "Kurum Yöneticisi",
  administrative: "İdari Personel",
  finance: "Muhasebe",
  superadmin: "Platform Admin",
  teacher: "Öğretmen",
  student: "Öğrenci",
  parent: "Veli",
  cafeteria: "Yemekhaneci",
};

const ROLE_MENU_GROUPS = {
  admin: [
    { id: "main", title: "Ana Panel", modules: ["dashboard", "kpi", "operations", "global-search", "tasks"] },
    { id: "academics", title: "Akademik Yönetim", modules: ["academics", "students", "parents", "teachers", "classes", "schedule", "attendance", "courses", "duties"] },
    { id: "registrations", title: "Kayıt İşlemleri", modules: ["registrations", "records", "administrative-units", "approvals", "password-reset"] },
    { id: "learning", title: "İçerik & Eğitim", modules: ["content", "questions", "question-bank", "exams", "assignments", "live-lessons"] },
    { id: "reports", title: "Raporlar", modules: ["reports", "branch-comparison"] },
    { id: "finance", title: "Finans", modules: ["finance", "student-accounts", "collections", "installments", "billing", "late-payments", "discounts-scholarships", "collection-calendar", "reconciliation", "bulk-actions", "overdue-rules", "salary", "cash-report", "ledger", "finance-export", "finance-audit-log", "finance-detail-hub"] },
    { id: "communication", title: "İletişim", modules: ["notifications", "meetings", "chat", "support"] },
    { id: "services", title: "Servis & Yemekhane", modules: ["service", "cafeteria"] },
    { id: "system", title: "Sistem", modules: ["role-management", "profile", "system"] },
  ],
  administrative: [
    { id: "main", title: "Ana Panel", modules: ["operations", "tasks", "schedule", "duties"] },
    { id: "records", title: "İdari İşler", modules: ["records", "documents", "password-reset", "registrations"] },
    { id: "reports", title: "Raporlar", modules: ["reports"] },
    { id: "communication", title: "İletişim", modules: ["notifications", "meetings", "chat"] },
    { id: "services", title: "Servis & Yemekhane", modules: ["service", "cafeteria"] },
    { id: "system", title: "Sistem", modules: ["system"] },
  ],
  finance: [
    { id: "main", title: "Ana Panel", modules: ["finance"] },
    { id: "accounts", title: "Öğrenci Finans", modules: ["student-accounts", "collections", "installments", "late-payments", "discounts-scholarships"] },
    { id: "billing", title: "Fatura & Tahsilat", modules: ["billing", "collection-calendar", "reconciliation", "bulk-actions", "overdue-rules"] },
    { id: "reports", title: "Rapor & Kayıt", modules: ["cash-report", "ledger", "finance-export", "finance-audit-log", "finance-detail-hub"] },
    { id: "staff", title: "Personel", modules: ["salary"] },
    { id: "communication", title: "İletişim", modules: ["chat"] },
    { id: "system", title: "Sistem", modules: ["system"] },
  ],
  superadmin: [
    { id: "main", title: "Ana Panel", modules: ["platform"] },
    { id: "institutions", title: "Kurum Yönetimi", modules: ["tenants", "plans", "billing", "limits", "customization"] },
    { id: "intelligence", title: "AI & Sistem", modules: ["ai-management", "system"] },
    { id: "support", title: "Destek", modules: ["support"] },
  ],
  teacher: [
    { id: "main", title: "Ana Panel", modules: ["dashboard", "schedule", "attendance", "live-lessons", "duties"] },
    { id: "learning", title: "Ders & İçerik", modules: ["content", "question-bank", "questions"] },
    { id: "assessment", title: "Sınav & Not", modules: ["exams", "mock-exams", "grade-entry", "reports"] },
    { id: "students", title: "Öğrenci Takibi", modules: ["assignments", "meetings"] },
    { id: "communication", title: "İletişim", modules: ["notifications", "chat"] },
    { id: "system", title: "Sistem", modules: ["profile", "system"] },
  ],
  student: [
    { id: "main", title: "Ana Panel", modules: ["dashboard", "schedule", "study-plan", "live-lessons"] },
    { id: "learning", title: "Öğrenme", modules: ["content", "question-bank", "questions", "assignments", "ai"] },
    { id: "assessment", title: "Sınavlar", modules: ["exams", "mock-exams", "reports"] },
    { id: "life", title: "Okul Hayatı", modules: ["attendance", "cafeteria"] },
    { id: "communication", title: "İletişim", modules: ["notifications", "chat"] },
    { id: "system", title: "Sistem", modules: ["profile", "system"] },
  ],
  parent: [
    { id: "main", title: "Ana Panel", modules: ["dashboard", "parents"] },
    { id: "student", title: "Öğrenci Takibi", modules: ["attendance", "exams", "reports", "feedback", "excuse"] },
    { id: "finance", title: "Finans", modules: ["payments", "receipts"] },
    { id: "school", title: "Okul Hayatı", modules: ["cafeteria", "meetings"] },
    { id: "communication", title: "İletişim", modules: ["notifications", "chat"] },
    { id: "system", title: "Sistem", modules: ["profile", "system"] },
  ],
  cafeteria: [
    { id: "main", title: "Yemekhane", modules: ["cafeteria"] },
  ],
};

const MODULE_MENU_REGISTRY = {
  dashboard: {
    default: { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", color: "#3b82f6" },
    administrative: { path: "/admin/operations", icon: Activity, label: "Operasyon", color: "#14b8a6" },
    finance: { path: "/finance/dashboard", icon: LayoutDashboard, label: "Muhasebe Özet", color: "#3b82f6" },
    superadmin: { path: "/sa/dashboard", icon: LayoutDashboard, label: "Platform Özet", color: "#3b82f6" },
    teacher: { path: "/t/dashboard", icon: LayoutDashboard, label: "Dashboard", color: "#3b82f6" },
    student: { path: "/s/dashboard", icon: LayoutDashboard, label: "Ana Sayfa", color: "#3b82f6", special: true },
    parent: { path: "/p/dashboard", icon: LayoutDashboard, label: "Dashboard", color: "#3b82f6" },
  },
  kpi: { default: { path: "/admin/kpi", icon: BarChart3, label: "Kurum Özeti", color: "#22c55e" } },
  academics: { default: { path: "/admin/academics", icon: GraduationCap, label: "Akademik Yönetim", color: "#2563eb" } },
  students: { default: { path: "/students", icon: Users, label: "Öğrenciler", color: "#8b5cf6" } },
  parents: { default: { path: "/parents", icon: UserCheck, label: "Veliler", color: "#ec4899" }, parent: { path: "/p/children", icon: Users, label: "Çocuklarım", color: "#8b5cf6" } },
  teachers: { default: { path: "/teachers", icon: GraduationCap, label: "Öğretmenler", color: "#10b981" } },
  // Sınıf oluşturma yalnızca yönetici akışıdır; öğrenci menüsüne verilmez.
  classes: {
    default: { path: "/classes", icon: School, label: "Sınıflar & Gruplar", color: "#f59e0b" },
  },
  schedule: {
    default: { path: "/schedule", icon: Calendar, label: "Ders Programı", color: "#06b6d4" },
    administrative: { path: "/admin/schedule", icon: Calendar, label: "Ders Programı", color: "#06b6d4" },
    teacher: { path: "/t/schedule", icon: Calendar, label: "Ders Programı", color: "#06b6d4" },
    student: { path: "/s/schedule", icon: Calendar, label: "Ders Programı", color: "#06b6d4" },
  },
  attendance: {
    default: { path: "/attendance", icon: ClipboardCheck, label: "Devamsızlık", color: "#84cc16" },
    teacher: { path: "/t/attendance", icon: ClipboardCheck, label: "Yoklama", color: "#84cc16" },
    student: { path: "/s/attendance", icon: ClipboardCheck, label: "Devamsızlık", color: "#84cc16" },
    parent: { path: "/p/attendance", icon: ClipboardCheck, label: "Devamsızlık", color: "#84cc16" },
  },
  content: {
    default: { path: "/content", icon: BookOpen, label: "İçerikler", color: "#f43f5e" },
    teacher: { path: "/t/content", icon: BookOpen, label: "Konu Anlatımı", color: "#f43f5e" },
    student: { path: "/s/content", icon: BookOpen, label: "Konu Anlatımı", color: "#f43f5e" },
  },
  questions: {
    default: { path: "/questions", icon: HelpCircle, label: "Sorular", color: "#14b8a6" },
    teacher: { path: "/t/questions", icon: HelpCircle, label: "Soru Kutusu", color: "#14b8a6" },
    student: { path: "/s/questions", icon: Brain, label: "Soru Bankası", color: "#14b8a6" },
  },
  "question-bank": {
    default: { path: "/questions", icon: Brain, label: "Soru Bankası", color: "#8b5cf6" },
    teacher: { path: "/t/question-bank", icon: Brain, label: "Soru Bankası", color: "#8b5cf6", special: true },
    student: { path: "/s/questions", icon: Brain, label: "Soru Bankası", color: "#14b8a6" },
  },
  exams: {
    default: { path: "/exams", icon: FileQuestion, label: "Sınavlar", color: "#a855f7" },
    teacher: { path: "/t/exams", icon: FileQuestion, label: "Sınavlar", color: "#a855f7" },
    student: { path: "/s/exams", icon: FileQuestion, label: "Sınavlarım", color: "#a855f7" },
    parent: { path: "/p/exams", icon: FileQuestion, label: "Sınav Sonuçları", color: "#a855f7" },
  },
  "grade-entry": {
    teacher: { path: "/t/grade-entry", icon: FileText, label: "Not Girişi", color: "#ff8a00" },
  },
  "mock-exams": {
    teacher: { path: "/t/mock-exams", icon: ClipboardCheck, label: "Deneme Sınavları", color: "#f97316" },
    student: { path: "/s/mock-exams", icon: ClipboardCheck, label: "Deneme Sınavları", color: "#f97316" },
  },
  assignments: {
    teacher: { path: "/t/assignments", icon: FileText, label: "Ödevler", color: "#f59e0b" },
    student: { path: "/s/assignments", icon: FileText, label: "Ödevler", color: "#f59e0b" },
  },
  "live-lessons": {
    teacher: { path: "/t/live-lessons", icon: Video, label: "Canlı Dersler", color: "#ef4444", pulse: true },
    student: { path: "/s/live", icon: Video, label: "Canlı Dersler", color: "#ef4444", pulse: true },
  },
  reports: {
    default: { path: "/reports", icon: BarChart3, label: "Raporlar", color: "#22c55e" },
    teacher: { path: "/t/reports", icon: BarChart3, label: "Raporlar", color: "#22c55e" },
    student: { path: "/s/exam-results", icon: BarChart3, label: "Sınav Sonuçlarım", color: "#2563eb" },
    parent: { path: "/p/weekly-report", icon: FileText, label: "Haftalık Rapor", color: "#f59e0b" },
  },
  operations: { default: { path: "/admin/operations", icon: Activity, label: "Operasyon", color: "#14b8a6" } },
  tasks: { default: { path: "/admin/task-center", icon: CheckSquare, label: "Görev Merkezi", color: "#f59e0b" } },
  approvals: { default: { path: "/admin/finance-approvals", icon: CheckSquare, label: "Onaylar", color: "#a855f7" } },
  records: { default: { path: "/admin/records", icon: FileText, label: "İdari Kayıtlar", color: "#f97316" } },
  documents: { default: { path: "/admin/documents", icon: FileText, label: "Belge Merkezi", color: "#ec4899" } },
  notifications: {
    default: { path: "/admin/announcements", icon: Bell, label: "Duyurular", color: "#f59e0b" },
    teacher: { path: "/t/announcements", icon: Bell, label: "Duyurular", color: "#f59e0b" },
    student: { path: "/s/announcements", icon: Bell, label: "Duyurular", color: "#f59e0b" },
    parent: { path: "/p/announcements", icon: Bell, label: "Duyurular", color: "#f59e0b" },
  },
  meetings: {
    default: { path: "/admin/meetings", icon: Calendar, label: "Görüşme Akışı", color: "#ec4899" },
    teacher: { path: "/t/meeting-approvals", icon: Calendar, label: "Görüşme Onayları", color: "#ec4899" },
    parent: { path: "/p/meetings", icon: Calendar, label: "Görüşmeler", color: "#ec4899" },
  },
  registrations: { default: { path: "/admin/student-registration", icon: Users, label: "Kayıt İşlemleri", color: "#06b6d4" } },
  "branch-comparison": { default: { path: "/admin/branch-comparison", icon: BarChart3, label: "Şube Karşılaştırma", color: "#f97316" } },
  "global-search": { default: { path: "/admin/global-search", icon: HelpCircle, label: "Kurum İçi Arama", color: "#0ea5e9" } },
  chat: {
    default: { path: "/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
    teacher: { path: "/t/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
    student: { path: "/s/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
    parent: { path: "/p/chat", icon: MessageSquare, label: "Mesajlar", color: "#0ea5e9" },
  },
  finance: { default: { path: "/finance/dashboard", icon: Wallet, label: "Finans Paneli", color: "#16a34a" } },
  "student-accounts": { default: { path: "/finance/student-accounts", icon: Users, label: "Öğrenci Hesapları", color: "#8b5cf6" } },
  collections: { default: { path: "/finance/collections", icon: CreditCard, label: "Tahsilatlar", color: "#10b981" } },
  installments: { default: { path: "/finance/installments", icon: Receipt, label: "Taksitler", color: "#f59e0b" } },
  "late-payments": { default: { path: "/finance/late-payments", icon: AlertCircle, label: "Gecikenler", color: "#ef4444" } },
  billing: { default: { path: "/finance/invoices-receipts", icon: FileText, label: "Fatura & Makbuz", color: "#06b6d4" } },
  "discounts-scholarships": { default: { path: "/finance/discounts-scholarships", icon: Gift, label: "İndirim & Burs", color: "#ec4899" } },
  "finance-export": { default: { path: "/finance/export", icon: Download, label: "Dışa Aktar", color: "#84cc16" } },
  "finance-audit-log": { default: { path: "/finance/audit-log", icon: Activity, label: "Audit Log", color: "#6366f1" } },
  "collection-calendar": { default: { path: "/finance/collection-calendar", icon: Calendar, label: "Tahsilat Takvimi", color: "#14b8a6" } },
  reconciliation: { default: { path: "/finance/reconciliation", icon: Shield, label: "Mutabakat", color: "#22c55e" } },
  "bulk-actions": { default: { path: "/finance/bulk-actions", icon: Layers, label: "Toplu İşlemler", color: "#f97316" } },
  "finance-detail-hub": { default: { path: "/finance/detail-hub", icon: Layers, label: "Finans Detay Merkezi", color: "#64748b" } },
  salary: { default: { path: "/finance/salary", icon: Wallet, label: "Maaş Yönetimi", color: "#10b981" } },
  "cash-report": { default: { path: "/finance/cash-report", icon: Receipt, label: "Kasa Raporu", color: "#a855f7" } },
  "overdue-rules": { default: { path: "/finance/overdue-rules", icon: Bell, label: "Gecikme Kuralları", color: "#f43f5e" } },
  ledger: { default: { path: "/finance/ledger", icon: BookOpen, label: "Hesap Defteri", color: "#6366f1" } },
  platform: { default: { path: "/sa/dashboard", icon: LayoutDashboard, label: "Platform Yönetimi", color: "#3b82f6" } },
  tenants: { default: { path: "/sa/tenants", icon: Building2, label: "Kurum Yönetimi", color: "#8b5cf6" } },
  plans: { default: { path: "/sa/plans", icon: Package, label: "Paketler", color: "#10b981" } },
  limits: { default: { path: "/sa/limits", icon: Server, label: "Limitler", color: "#ef4444" } },
  "ai-management": { default: { path: "/sa/ai", icon: Bot, label: "AI Yönetimi", color: "#D9790B", special: true } },
  customization: { default: { path: "/sa/customization", icon: Palette, label: "Kurum Özelleştirme", color: "#ec4899" } },
  support: { default: { path: "/sa/support", icon: Ticket, label: "Destek", color: "#a855f7" } },
  profile: {
    default: { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" },
    admin: { path: "/admin/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    teacher: { path: "/t/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    student: { path: "/s/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
    parent: { path: "/p/profile", icon: User, label: "Profilim", color: "#8b5cf6" },
  },
  system: { default: { path: "/settings", icon: Settings, label: "Ayarlar", color: "#64748b" }, superadmin: { path: "/sa/system", icon: Settings, label: "Sistem", color: "#06b6d4" } },
};

function getRegistryItem(moduleKey, primaryRole) {
  const entry = MODULE_MENU_REGISTRY[moduleKey];
  if (!entry) return null;
  return entry[primaryRole] || entry.default || null;
}

function inferModuleKey(item) {
  const path = item?.path || "";
  if (!path) return "";

  const exactPathMap = {
    "/dashboard": "dashboard",
    "/t/dashboard": "dashboard",
    "/s/dashboard": "dashboard",
    "/p/dashboard": "dashboard",
    "/finance/dashboard": "finance",
    "/admin/kpi": "kpi",
    "/admin/academics": "academics",
    "/admin/courses": "courses",
    "/students": "students",
    "/parents": "parents",
    "/teachers": "teachers",
    "/classes": "classes",
    "/schedule": "schedule",
    "/admin/schedule": "schedule",
    "/t/schedule": "schedule",
    "/s/schedule": "schedule",
    "/attendance": "attendance",
    "/t/attendance": "attendance",
    "/s/attendance": "attendance",
    "/s/attendance-qr": "attendance",
    "/p/attendance": "attendance",
    "/content": "content",
    "/t/content": "content",
    "/s/content": "content",
    "/questions": "questions",
    "/t/questions": "questions",
    "/s/questions": "questions",
    "/t/question-bank": "question-bank",
    "/t/question-bank/import": "question-bank",
    "/exams": "exams",
    "/t/exams": "exams",
    "/t/grade-entry": "grade-entry",
    "/t/mock-exams": "mock-exams",
    "/t/mock-exams/create": "mock-exams",
    "/s/exams": "exams",
    "/s/mock-exams": "mock-exams",
    "/p/exams": "exams",
    "/t/assignments": "assignments",
    "/s/assignments": "assignments",
    "/t/submissions": "assignments",
    "/s/study-plan": "study-plan",
    "/t/live-lessons": "live-lessons",
    "/t/live-room": "live-lessons",
    "/s/live": "live-lessons",
    "/reports": "reports",
    "/admin/exam-papers": "reports",
    "/t/reports": "reports",
    "/t/duties": "duties",
    "/admin/duty-create": "duties",
    "/admin/duties": "duties",
    "/admin/timetable": "duties",
    "/s/exam-results": "reports",
    "/s/wrong-answers": "reports",
    "/p/weekly-report": "reports",
    "/admin/operations": "operations",
    "/admin/task-center": "tasks",
    "/admin/finance-approvals": "approvals",
    "/admin/personnel-approvals": "approvals",
    "/admin/password-reset-requests": "password-reset",
    "/admin/role-management": "role-management",
    "/admin/records": "records",
    "/admin/administrative-units": "administrative-units",
    "/admin/documents": "documents",
    "/admin/announcements": "notifications",
    "/admin/notifications": "notifications",
    "/t/announcements": "notifications",
    "/s/announcements": "notifications",
    "/p/announcements": "notifications",
    "/admin/meetings": "meetings",
    "/t/meeting-approvals": "meetings",
    "/p/meetings": "meetings",
    "/admin/student-registration": "registrations",
    "/admin/staff-registration": "registrations",
    "/admin/accounting-registration": "registrations",
    "/admin/branch-registration": "registrations",
    "/admin/branch-comparison": "branch-comparison",
    "/admin/global-search": "global-search",
    "/admin/service-tracking": "service",
    "/cafeteria/menu": "cafeteria",
    "/s/cafeteria": "cafeteria",
    "/p/cafeteria": "cafeteria",
    "/s/ai": "ai",
    "/p/payments": "payments",
    "/p/receipts": "receipts",
    "/p/feedback": "feedback",
    "/p/excuse-request": "excuse",
    "/chat": "chat",
    "/t/chat": "chat",
    "/s/chat": "chat",
    "/p/chat": "chat",
    "/finance": "finance",
    "/admin/finance": "finance",
    "/finance/student-accounts": "student-accounts",
    "/finance/collections": "collections",
    "/finance/installments": "installments",
    "/finance/late-payments": "late-payments",
    "/finance/invoices-receipts": "billing",
    "/finance/discounts-scholarships": "discounts-scholarships",
    "/finance/export": "finance-export",
    "/finance/audit-log": "finance-audit-log",
    "/finance/collection-calendar": "collection-calendar",
    "/finance/reconciliation": "reconciliation",
    "/finance/bulk-actions": "bulk-actions",
    "/finance/detail-hub": "finance-detail-hub",
    "/finance/salary": "salary",
    "/finance/cash-report": "cash-report",
    "/finance/overdue-rules": "overdue-rules",
    "/finance/ledger": "ledger",
    "/sa/dashboard": "platform",
    "/sa/tenants": "tenants",
    "/sa/plans": "plans",
    "/sa/billing": "billing",
    "/sa/limits": "limits",
    "/sa/ai": "ai-management",
    "/sa/customization": "customization",
    "/sa/support": "support",
    "/admin/destek": "support",
    "/admin/profile": "profile",
    "/t/profile": "profile",
    "/s/profile": "profile",
    "/p/profile": "profile",
    "/settings": "system",
    "/s/settings": "system",
    "/sa/system": "system",
  };

  if (exactPathMap[path]) return exactPathMap[path];
  if (path.includes("/profile")) return "profile";
  if (path.includes("/finance/")) return "finance";
  if (path.startsWith("/sa/")) return "platform";
  return "";
}

export function getModuleAwareMenuItems(baseItems, enabledModules, primaryRole = "", hasRoleManagementPolicy = false) {
  if (!hasRoleManagementPolicy) return baseItems;

  const merged = [];
  const seenPaths = new Set();
  const visibleModuleKeys = new Set();

  for (const item of baseItems) {
    const moduleKey = inferModuleKey(item);
    const uniqueKey = item.path || item.id || item.label;
    if (!uniqueKey) continue;

    const isAlwaysVisible = moduleKey === "profile" || moduleKey === "";
    if (!isAlwaysVisible && !enabledModules.has(moduleKey)) continue;

    seenPaths.add(uniqueKey);
    if (moduleKey) visibleModuleKeys.add(moduleKey);
    merged.push(item);
  }

  enabledModules.forEach((moduleKey) => {
    if (visibleModuleKeys.has(moduleKey)) return;
    const item = getRegistryItem(moduleKey, primaryRole);
    const uniqueKey = item?.path || item?.id || item?.label;
    if (!item || !uniqueKey || seenPaths.has(uniqueKey)) return;
    seenPaths.add(uniqueKey);
    visibleModuleKeys.add(moduleKey);
    merged.push({ ...item, sourceRole: "role-management" });
  });

  return merged;
}

export function buildGroupedMenuItems(items, primaryRole) {
  const definitions = ROLE_MENU_GROUPS[primaryRole] || ROLE_MENU_GROUPS.admin;
  const groups = definitions.map((group) => ({ ...group, items: [] }));
  const fallback = { id: "other", title: "Diğer", modules: [], items: [] };

  for (const item of items) {
    const moduleKey = inferModuleKey(item);
    const targetGroup = groups.find((group) => group.modules.includes(moduleKey)) || fallback;
    targetGroup.items.push({ ...item, moduleKey });
  }

  return [...groups, fallback].filter((group) => group.items.length > 0);
}

function getActiveGroupIds(groups, pathname) {
  return groups
    .filter((group) => group.items.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)))
    .map((group) => group.id);
}

// Student stats component for sidebar — fetches real XP data from API
function StudentStats({ collapsed }) {
  const [stats, setStats] = useState({
    xp: 0,
    streak: 0,
    level: 1,
    xpToNext: 100,
  });

  useEffect(() => {
    let cancelled = false;
    import("../../lib/api/modules").then(({ fetchStudyPlan }) => {
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
    return () => {
      cancelled = true;
    };
  }, []);

  const progressPercent = stats.xpToNext < 100 ? 100 - stats.xpToNext : 0;

  return (
    <AnimatePresence>
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mx-3 mb-4 p-3 rounded-xl bg-foreground/5 backdrop-blur-sm border border-foreground/10"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
              >
                <Flame className="h-5 w-5 text-orange-400" />
              </motion.div>
              <span className="text-sm font-medium text-foreground/90">
                {stats.streak} Gün Serisi
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">
                {stats.xp.toLocaleString("tr-TR")} XP
              </span>
            </div>
          </div>
          <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, progressPercent)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
          <p className="text-xs text-foreground/60 mt-2">
            Seviye {stats.level} • {stats.xpToNext} XP kaldı
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModernSidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, user } = useApp();
  const location = useLocation();
  const {
    tenantLogo,
    tenantName: rawTenantName,
    primaryColor,
    accentColor,
    resolvedTheme,
  } = useTheme();
  const isLightMode = resolvedTheme === "light";

  // Primary role + admin tarafından atanan extraRoles + isPlatformAdmin
  // birlikte değerlendirilir. Böylece bir öğrenciye "Teacher" rolü eklenince
  // sidebar'a otomatik öğretmen menü item'ları katılır.
  const userRoles = getUserRoles(user);
  const primaryRole = userRoles[0] || "student";
  const userRole = primaryRole; // mevcut başlık/ROLE_TITLES mantığı için geriye dönük
  const baseMenuItems = userRoles.length > 0
    ? mergeMenuItemsForRoles(menuConfigs, userRoles)
    : (menuConfigs.student || []);
  const enabledModules = new Set(
    (Array.isArray(user?.modules) ? user.modules : [])
      .map((moduleKey) => String(moduleKey).toLowerCase())
      .filter(Boolean),
  );
  const hasRoleManagementPolicy = Boolean(user?.hasRoleManagementPolicy);
  const moduleAwareItems = getModuleAwareMenuItems(baseMenuItems, enabledModules, primaryRole, hasRoleManagementPolicy);

  // Kurum bazlı özellik anahtarları: platform yöneticisinin kapattığı
  // modüller menüden gizlenir (platform admin tüm menüyü görür).
  const [disabledFeatures, setDisabledFeatures] = useState(null);
  useEffect(() => {
    let active = true;
    if (user?.isPlatformAdmin) {
      setDisabledFeatures(new Set());
    } else {
      getDisabledFeatureKeys().then((keys) => {
        if (active) setDisabledFeatures(keys);
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  const menuItems = disabledFeatures && disabledFeatures.size > 0
    ? moduleAwareItems.filter((item) => !isPathDisabled(item.path, disabledFeatures))
    : moduleAwareItems;
  const groupedMenuItems = buildGroupedMenuItems(menuItems, primaryRole);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const isStudent = userRoles.includes("student");

  useEffect(() => {
    const activeIds = getActiveGroupIds(groupedMenuItems, location.pathname);
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.size === 0 && groupedMenuItems[0]) {
        next.add(groupedMenuItems[0].id);
      }
      activeIds.forEach((id) => next.add(id));
      return next;
    });
  }, [location.pathname, primaryRole, groupedMenuItems.length]);

  const toggleGroup = (groupId) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const ROLE_TITLES = {
    admin: "Yönetim Paneli",
    administrative: "İdari Panel",
    finance: "Muhasebe Paneli",
    superadmin: "Platform Yönetimi",
    teacher: "Öğretmen Paneli",
    student: "Öğrenci Paneli",
    parent: "Veli Paneli",
  };

  // Normalize string for comparison (lowercase, remove Turkish chars)
  const normalizeStr = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

  const BLOCKED_KEYWORDS = [
    "ogrenci isleri",
    "idari isler",
    "muhasebe",
    "rehberlik",
    "yonetim",
    "kurum yoneticisi",
    "idari personel",
    "ogretmen",
    "ogrenci",
    "veli",
    "platform admin",
    "courseintellect",
    "courseintellect desktop",
  ];
  const normalizedRaw = normalizeStr(rawTenantName);
  const isBadName = BLOCKED_KEYWORDS.some((kw) => normalizedRaw === kw);
  const normalizedUserTenant = normalizeStr(user?.tenant);
  const isUserTenantBad = BLOCKED_KEYWORDS.some(
    (kw) => normalizedUserTenant === kw,
  );
  const tenantName =
    rawTenantName && !isBadName
      ? rawTenantName
      : user?.tenant && !isUserTenantBad
        ? user.tenant
        : ROLE_TITLES[userRole] || "SchoolAsist";

  // Sidebar variants for animation
  const sidebarVariants = {
    expanded: {
      width: 280,
      x: 0,
      transition: { duration: 0.3, ease: "easeInOut" },
    },
    collapsed: {
      width: 280,
      x: -280,
      transition: { duration: 0.3, ease: "easeInOut" },
    },
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
            style={{
              background: `linear-gradient(to right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))`,
            }}
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
        data-ci-sidebar
        data-sidebar-theme={isLightMode ? "light" : "dark"}
        variants={sidebarVariants}
        initial={false}
        animate={sidebarCollapsed ? "collapsed" : "expanded"}
        className={cn(
          "h-screen text-white flex flex-col border-r border-foreground/10 z-40 overflow-hidden flex-shrink-0",
          "fixed lg:relative",
        )}
        style={{
          width: 280,
          background: isLightMode
            ? `radial-gradient(circle at 16% 0%, hsl(var(--brand-accent) / 0.16), transparent 28%), linear-gradient(to bottom, hsl(var(--card) / 0.96), hsl(var(--background) / 0.94))`
            : `linear-gradient(to bottom, var(--sidebar-from, #00354F), var(--sidebar-via, #002a40), var(--sidebar-to, #001f30))`,
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <GlowingOrb
            color={accentColor}
            size={200}
            className="-top-20 -right-20"
          />
          <GlowingOrb
            color={primaryColor}
            size={150}
            className="bottom-20 -left-20"
          />
          <FloatingParticles
            count={15}
            colors={[accentColor, primaryColor, "#22c55e"]}
          />
        </div>

        {/* Logo Section with Close Button */}
        <div className="relative h-16 flex items-center justify-between px-4 border-b border-foreground/10">
          <motion.div
            className="flex items-center gap-3 overflow-hidden"
            initial={false}
          >
            {tenantLogo ? (
              <motion.img
                src={tenantLogo}
                alt={tenantName || "Logo"}
                className="h-10 w-10 rounded-xl object-contain flex-shrink-0"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <motion.div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{
                  background: `linear-gradient(to bottom right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))`,
                }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <GraduationCap className="h-6 w-6 text-white" />
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              className="overflow-hidden"
            >
              <span
                className={cn(
                  "font-heading font-bold text-lg whitespace-nowrap bg-gradient-to-r bg-clip-text text-transparent",
                  isLightMode ? "from-slate-950 to-slate-700" : "from-white to-foreground/80",
                )}
              >
                {tenantName}
              </span>
            </motion.div>
          </motion.div>

          {/* Close Button */}
          <motion.button
            onClick={() => setSidebarCollapsed(true)}
            className="p-2 rounded-lg hover:bg-foreground/10 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            data-testid="sidebar-close-button"
          >
            <X className="h-5 w-5 text-foreground/70" />
          </motion.button>
        </div>

        {/* Student XP Stats */}
        {isStudent && <StudentStats collapsed={false} />}

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-foreground/10">
          <TooltipProvider delayDuration={0}>
            <div className="space-y-2">
              {groupedMenuItems.map((group, groupIndex) => {
                const isOpen = openGroups.has(group.id);
                const hasActive = group.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
                return (
                  <motion.section
                    key={group.id}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIndex * 0.03 }}
                    className={cn(
                      "rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-1",
                      hasActive && "border-foreground/20 bg-foreground/[0.045]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.18em] text-foreground/50 transition hover:bg-foreground/10 hover:text-foreground/80",
                        hasActive && "text-foreground/90",
                      )}
                    >
                      <span className="truncate">{group.title}</span>
                      <span className="ml-2 flex items-center gap-2">
                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] tracking-normal text-foreground/60">{group.items.length}</span>
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          className="mt-1 space-y-1 overflow-hidden"
                        >
                          {group.items.map((item, itemIndex) => {
                            const isActive =
                              location.pathname === item.path ||
                              location.pathname.startsWith(item.path + "/");
                            const Icon = item.icon;

                            return (
                              <motion.li
                                key={item.path}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: itemIndex * 0.015 }}
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
                                      data-testid={`nav-${item.path.replace(/\//g, "-").slice(1)}`}
                                      className={cn(
                                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden",
                                        isActive
                                          ? "text-white shadow-lg"
                                          : "hover:bg-foreground/10 text-foreground/70 hover:text-white",
                                      )}
                                      style={
                                        isActive
                                          ? {
                                              background: `linear-gradient(to right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))`,
                                            }
                                          : undefined
                                      }
                                    >
                                      {!isActive && (
                                        <motion.div
                                          className="absolute inset-0 bg-gradient-to-r from-foreground/0 via-foreground/5 to-foreground/0"
                                          initial={{ x: "-100%" }}
                                          whileHover={{ x: "100%" }}
                                          transition={{ duration: 0.5 }}
                                        />
                                      )}

                                      <motion.div
                                        className="relative z-10"
                                        whileHover={{
                                          scale: 1.2,
                                          rotate: isActive ? 0 : 10,
                                        }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <div
                                          className={cn(
                                            "p-2 rounded-lg transition-all duration-300",
                                            isActive
                                              ? "bg-foreground/20"
                                              : "bg-transparent group-hover:bg-foreground/10",
                                          )}
                                          style={{
                                            boxShadow: isActive
                                              ? `0 0 15px ${item.color}40`
                                              : "none",
                                          }}
                                        >
                                          <Icon
                                            className="h-5 w-5 flex-shrink-0"
                                            style={{
                                              color: isActive ? "#fff" : item.color,
                                            }}
                                          />
                                        </div>

                                        {item.pulse && (
                                          <motion.div
                                            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                                            animate={{
                                              scale: [1, 1.2, 1],
                                              opacity: [1, 0.7, 1],
                                            }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                          />
                                        )}

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

                                      <motion.span
                                        className={cn(
                                          "relative z-10 text-sm font-medium whitespace-nowrap",
                                          item.special &&
                                            !isActive &&
                                            "bg-gradient-to-r from-white to-foreground/60 bg-clip-text text-transparent",
                                        )}
                                      >
                                        {item.label}
                                      </motion.span>

                                      {isActive && (
                                        <motion.div
                                          layoutId="activeIndicator"
                                          className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"
                                          transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 30,
                                          }}
                                        />
                                      )}
                                    </NavLink>
                                  </TooltipTrigger>
                                </Tooltip>
                              </motion.li>
                            );
                          })}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </motion.section>
                );
              })}
            </div>
          </TooltipProvider>
        </nav>

        {/* User info section */}
        <div className="relative border-t border-foreground/10 p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-2 rounded-xl bg-foreground/5 backdrop-blur-sm"
          >
            <motion.div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{
                background: `linear-gradient(to bottom right, var(--accent-from, #D9790B), var(--accent-to, #f59e0b))`,
              }}
              whileHover={{ scale: 1.1 }}
            >
              {user?.name?.[0] || "Ö"}
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium truncate", isLightMode ? "text-foreground" : "text-white")}>
                {user?.name || "Öğrenci"}
              </p>
              <p className="text-xs text-foreground/60 truncate">
                {user?.email || "ogrenci@okul.com"}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Project Logo at the bottom */}
        <div className="relative border-t border-foreground/10 p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <img
              src={logoImage}
              alt="SchoolAsist Logo"
              className="h-12 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            />
          </motion.div>
          <motion.p
            className="text-[10px] text-foreground/40 text-center mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            © 2026 SchoolAsist
          </motion.p>
        </div>
      </motion.aside>
    </>
  );
}
