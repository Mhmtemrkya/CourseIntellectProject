import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Moon,
  Sun,
  Monitor,
  Building2,
  Shield,
  Users,
  GraduationCap,
  Wallet,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import { mockNotifications } from "../../lib/mockData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

const pathLabels = {
  dashboard: "Dashboard",
  students: "Öğrenciler",
  parents: "Veliler",
  teachers: "Öğretmenler",
  classes: "Sınıflar & Gruplar",
  schedule: "Ders Programı",
  attendance: "Yoklama",
  "kiosk-qr": "Kiosk QR",
  content: "İçerikler",
  questions: "Sorular",
  exams: "Sınavlar",
  reports: "Raporlar",
  settings: "Ayarlar",
  chat: "Mesajlar",
  finance: "Muhasebe",
  "student-accounts": "Öğrenci Hesapları",
  collections: "Tahsilatlar",
  installments: "Taksitler",
  "late-payments": "Gecikenler",
  sa: "Platform",
  tenants: "Kurumlar",
  plans: "Paketler",
  billing: "Faturalama",
  system: "Sistem",
  t: "Öğretmen",
  s: "Öğrenci",
  p: "Veli",
};

const roleLabels = {
  admin: { label: "Yönetici", icon: Shield, color: "text-brand-primary" },
  finance: { label: "Muhasebe", icon: Wallet, color: "text-green-600" },
  superadmin: {
    label: "Platform Admin",
    icon: Building2,
    color: "text-purple-600",
  },
  teacher: { label: "Öğretmen", icon: GraduationCap, color: "text-blue-600" },
  student: { label: "Öğrenci", icon: Users, color: "text-orange-600" },
  parent: { label: "Veli", icon: User, color: "text-teal-600" },
};

export function Topbar() {
  const { user, logout, setCommandPaletteOpen, setUserRole } = useApp();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRoleSwitch = (role) => {
    setUserRole(role);
    const roleHomePaths = {
      admin: "/dashboard",
      finance: "/finance/dashboard",
      superadmin: "/sa/dashboard",
      teacher: "/t/dashboard",
      student: "/s/dashboard",
      parent: "/p/dashboard",
    };
    navigate(roleHomePaths[role] || "/dashboard");
  };

  const getThemeIcon = () => {
    if (theme === "dark") return <Moon className="h-4 w-4" />;
    if (theme === "light") return <Sun className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const currentRole = roleLabels[user?.role || "admin"];
  const CurrentRoleIcon = currentRole?.icon || Shield;

  return (
    <header
      data-testid="topbar"
      className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6"
    >
      {/* Left: Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Ana Sayfa</BreadcrumbLink>
          </BreadcrumbItem>
          {pathSegments.map((segment, index) => (
            <BreadcrumbItem key={segment}>
              <BreadcrumbSeparator />
              {index === pathSegments.length - 1 ? (
                <BreadcrumbPage>
                  {pathLabels[segment] || segment}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={`/${pathSegments.slice(0, index + 1).join("/")}`}
                >
                  {pathLabels[segment] || segment}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Search Button */}
        <Button
          data-testid="search-button"
          variant="outline"
          size="sm"
          className="hidden md:flex items-center gap-2 text-muted-foreground"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span>Ara...</span>
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* Role Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:flex items-center gap-2"
            >
              <CurrentRoleIcon className={`h-4 w-4 ${currentRole?.color}`} />
              <span>{currentRole?.label}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Çalışma Alanı</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(roleLabels).map(([key, val]) => {
              const Icon = val.icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleRoleSwitch(key)}
                  className={user?.role === key ? "bg-muted" : ""}
                >
                  <Icon className={`h-4 w-4 mr-2 ${val.color}`} />
                  {val.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button data-testid="theme-toggle" variant="ghost" size="icon">
              {getThemeIcon()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4 mr-2" /> Açık
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4 mr-2" /> Koyu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="h-4 w-4 mr-2" /> Sistem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu
          open={showNotifications}
          onOpenChange={setShowNotifications}
        >
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="notifications-button"
              variant="ghost"
              size="icon"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 bg-brand-accent text-white text-xs rounded-full flex items-center justify-center"
                >
                  {unreadCount}
                </motion.span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-3 border-b border-border">
              <h4 className="font-semibold">Bildirimler</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {mockNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start p-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium text-sm">
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <Badge
                        variant="default"
                        className="bg-brand-accent text-xs ml-auto"
                      >
                        Yeni
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notification.message}
                  </p>
                  <span className="text-xs text-muted-foreground mt-1">
                    {notification.time}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-brand-accent">
              Tümünü Gör
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="user-menu"
              variant="ghost"
              className="flex items-center gap-2 pl-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-brand-primary text-white">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">
                  {user?.name || "Kullanıcı"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {currentRole?.label}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" /> Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                import("../../lib/tauri").then((m) => m.closeApp())
              }
              className="text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" /> Uygulamayı Kapat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
