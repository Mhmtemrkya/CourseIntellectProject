import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  Command,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { getDisabledFeatureKeys, isPathDisabled } from "../../lib/tenantFeatures";
import { getEntitlements, isModuleAllowed } from "../../lib/entitlements";
import { getUserRoles, isPathVisibleForRoles, mergeMenuItemsForRoles } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { FloatingParticles, GlowingOrb } from "../animations/AnimatedBackground";
import {
  ROLE_LABELS,
  buildGroupedMenuItems,
  getModuleAwareMenuItems,
  inferModuleKey,
  menuConfigs,
} from "./ModernSidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

function pathIsActive(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function SidebarLink({ item, compact, mobile, onNavigate }) {
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  const active = pathIsActive(location.pathname, item.path);
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.path}
      onClick={() => mobile && onNavigate()}
      data-testid={`nav-${item.path.replace(/\//g, "-").slice(1)}`}
      className={cn(
        "group relative flex items-center overflow-hidden rounded-[11px] border transition-all duration-200",
        compact ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2",
        active
          ? "border-[hsl(var(--brand-accent)/0.34)] text-white shadow-[0_8px_24px_hsl(var(--brand-accent)/0.12)]"
          : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.055] hover:text-foreground",
      )}
      style={
        active
          ? {
              background: light
                ? "linear-gradient(100deg, hsl(var(--brand-primary)), hsl(var(--brand-accent) / 0.88))"
                : "linear-gradient(100deg, hsl(var(--brand-primary) / 0.42), hsl(var(--brand-accent) / 0.2))",
            }
          : undefined
      }
    >
      {active && (
        <motion.span
          layoutId="premium-sidebar-active"
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[hsl(var(--brand-accent))]"
        />
      )}
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition",
          active ? "bg-foreground/15" : "group-hover:bg-foreground/[0.08]",
        )}
      >
        <Icon
          className="h-[17px] w-[17px]"
          style={{
            color: active
              ? "#fff"
              : "hsl(var(--brand-primary-text, var(--brand-accent)))",
          }}
        />
        {item.pulse && (
          <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-400 ring-2 ring-background" />
        )}
      </span>
      {!compact && (
        <>
          <span className="relative z-10 min-w-0 flex-1 truncate text-[13px] font-medium">
            {item.label}
          </span>
          {item.new && (
            <span className="relative z-10 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[9px] font-bold text-fuchsia-200">
              YENİ
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (!compact) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function PremiumSidebar() {
  const {
    logout,
    setCommandPaletteOpen,
    setSidebarCollapsed,
    sidebarCollapsed,
    user,
  } = useApp();
  const {
    accentColor,
    primaryColor,
    resolvedTheme,
    setTheme,
    tenantLogo,
    tenantName,
  } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const light = resolvedTheme === "light";
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  const [disabledFeatures, setDisabledFeatures] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [openGroups, setOpenGroups] = useState(() => new Set());

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncViewport = (event) => {
      setMobile(event.matches);
      if (event.matches) setSidebarCollapsed(true);
    };
    setMobile(media.matches);
    if (media.matches) setSidebarCollapsed(true);
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, [setSidebarCollapsed]);

  useEffect(() => {
    let active = true;
    if (user?.isPlatformAdmin) {
      setDisabledFeatures(new Set());
      setEntitlements({ unrestricted: true, roles: {} });
    } else {
      getDisabledFeatureKeys().then((keys) => {
        if (active) setDisabledFeatures(keys);
      });
      getEntitlements().then((value) => {
        if (active) setEntitlements(value);
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  const roles = useMemo(() => getUserRoles(user), [user]);
  const primaryRole = roles[0] || "student";
  const enabledModules = useMemo(
    () =>
      new Set(
        (Array.isArray(user?.modules) ? user.modules : [])
          .map((key) => String(key).toLowerCase())
          .filter(Boolean),
      ),
    [user?.modules],
  );

  const groups = useMemo(() => {
    const baseItems = roles.length
      ? mergeMenuItemsForRoles(menuConfigs, roles)
      : menuConfigs.student || [];
    const moduleItems = getModuleAwareMenuItems(
      baseItems,
      enabledModules,
      primaryRole,
      Boolean(user?.hasRoleManagementPolicy),
    );
    const roleFilteredItems = moduleItems.filter((item) =>
      isPathVisibleForRoles(item.path, roles),
    );
    const featureFilteredItems =
      disabledFeatures?.size > 0
        ? roleFilteredItems.filter(
            (item) => !isPathDisabled(item.path, disabledFeatures),
          )
        : roleFilteredItems;
    // Paket yetkisi: kurumun paketi bu rol için modülü içermiyorsa menüden gizle.
    const visibleItems =
      entitlements && !entitlements.unrestricted
        ? featureFilteredItems.filter((item) => {
            const moduleKey = inferModuleKey(item);
            if (!moduleKey || moduleKey === "profile" || moduleKey === "system") return true;
            return isModuleAllowed(entitlements, primaryRole, moduleKey);
          })
        : featureFilteredItems;
    return buildGroupedMenuItems(visibleItems, primaryRole);
  }, [
    disabledFeatures,
    entitlements,
    enabledModules,
    primaryRole,
    roles,
    user?.hasRoleManagementPolicy,
  ]);

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.items.some((item) => pathIsActive(location.pathname, item.path)),
    );
    setOpenGroups((current) => {
      const next = new Set(current);
      if (activeGroup?.id !== "main") next.add(activeGroup?.id);
      return next;
    });
  }, [groups, location.pathname]);

  const mainGroup = groups.find((group) => group.id === "main");
  const moduleGroups = groups.filter((group) => group.id !== "main");
  const allItems = groups.flatMap((group) => group.items);
  const compact = sidebarCollapsed && !mobile;
  const displayEmail =
    user?.username?.includes("@") &&
    user?.email?.toLowerCase().startsWith(`${user.username.toLowerCase()}@`)
      ? user.username
      : user?.email || user?.username || "";

  const toggleGroup = (id) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const variants = {
    expanded: {
      width: mobile ? "90vw" : 280,
      x: 0,
      transition: { duration: 0.28, ease: "easeInOut" },
    },
    collapsed: {
      width: mobile ? "90vw" : 76,
      x: mobile ? "-100%" : 0,
      transition: { duration: 0.28, ease: "easeInOut" },
    },
  };

  return (
    <TooltipProvider delayDuration={0}>
      <AnimatePresence>
        {sidebarCollapsed && mobile && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => setSidebarCollapsed(false)}
            className="fixed left-4 top-4 z-50 rounded-xl bg-[hsl(var(--brand-accent))] p-3 text-white shadow-xl"
            data-testid="sidebar-open-button"
          >
            <Menu className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!sidebarCollapsed && mobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarCollapsed(true)}
            className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <motion.aside
        data-testid="sidebar"
        data-ci-sidebar
        variants={variants}
        initial={false}
        animate={sidebarCollapsed ? "collapsed" : "expanded"}
        className={cn(
          "fixed z-40 flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-foreground/[0.08] lg:relative",
          light
            ? "text-foreground shadow-[18px_0_48px_hsl(220_35%_20%/0.08)]"
            : "text-white shadow-[18px_0_48px_rgba(0,0,0,0.28)]",
        )}
        style={{
          background: light
            ? "radial-gradient(circle at 15% 0%, hsl(var(--brand-accent) / 0.05), transparent 28%), linear-gradient(180deg, var(--sidebar-from, #ffffff) 0%, var(--sidebar-via, #f6f8fb) 52%, var(--sidebar-to, #eef2f8) 100%)"
            : "radial-gradient(circle at 15% 0%, hsl(var(--brand-accent) / 0.08), transparent 28%), radial-gradient(circle at 88% 20%, rgba(0,91,160,0.18), transparent 30%), linear-gradient(180deg, var(--sidebar-from, #07152e) 0%, var(--sidebar-via, #041026) 46%, var(--sidebar-to, #020b1f) 100%)",
        }}
      >
        <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", light ? "opacity-[0.14]" : "opacity-40")}>
          <GlowingOrb color={accentColor} size={180} className="-right-24 -top-24" />
          <GlowingOrb color={primaryColor} size={140} className="-bottom-20 -left-24" />
          <FloatingParticles count={mobile ? 4 : 8} colors={[accentColor, primaryColor]} />
        </div>

        <header
          className={cn(
            "relative flex h-[64px] flex-shrink-0 items-center border-b border-foreground/[0.08]",
            compact ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {tenantLogo ? (
              <img
                src={tenantLogo}
                alt={tenantName || "Kurum logosu"}
                className="h-10 w-10 flex-shrink-0 rounded-xl object-contain shadow-lg"
              />
            ) : (
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-lg"
                style={{
                  background:
                    "linear-gradient(145deg, hsl(var(--brand-accent)), hsl(var(--brand-primary)))",
                }}
              >
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            {!compact && (
              <div className="min-w-0">
                <p className={cn("truncate text-[16px] font-bold", light ? "text-slate-950" : "text-white")}>
                  Course<span className="text-[hsl(var(--brand-accent))]">Intellect</span>
                </p>
                <p className={cn("max-w-[154px] truncate text-[9px]", light ? "text-slate-500" : "text-foreground/38")}>
                  {tenantName || ROLE_LABELS[primaryRole]}
                </p>
              </div>
            )}
          </div>
          {!compact && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className={cn(
                "rounded-[10px] border p-1.5 transition hover:bg-foreground/10",
                light ? "border-slate-200 text-slate-500" : "border-foreground/10 text-foreground/65",
              )}
              data-testid="sidebar-close-button"
            >
              {mobile ? <X className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
            </button>
          )}
        </header>

        {compact ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className={cn(
              "relative mx-auto mt-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] border transition",
              light
                ? "border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
                : "border-foreground/10 bg-foreground/[0.05] text-foreground/65 hover:bg-foreground/10 hover:text-white",
            )}
            aria-label="Menüyü genişlet"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <>
            <div className={cn("relative mx-3 mt-3 rounded-[10px] border p-2.5 backdrop-blur-xl", light ? "border-foreground/[0.08] bg-foreground/[0.035]" : "border-foreground/[0.08] bg-foreground/[0.035]")}>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-foreground/10 text-sm font-bold text-white shadow-lg"
                  style={{
                    background:
                      "linear-gradient(145deg, hsl(var(--brand-accent)), hsl(var(--brand-primary)))",
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "K"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13px] font-semibold", light ? "text-slate-950" : "text-white")}>
                    {user?.name || "Kullanıcı"}
                  </p>
                  <p className={cn("truncate text-[10px]", light ? "text-slate-500" : "text-foreground/42")}>
                    {displayEmail}
                  </p>
                  <span className="mt-1 inline-flex rounded-full bg-[hsl(var(--brand-accent)/0.12)] px-2 py-0.5 text-[9px] font-semibold text-[hsl(var(--brand-accent))]">
                    {ROLE_LABELS[primaryRole] || primaryRole}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className={cn(
                "relative mx-3 mt-2.5 flex h-9 items-center gap-2.5 rounded-[9px] border px-3 text-left transition",
                light
                  ? "border-slate-200 bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
                  : "border-foreground/10 bg-foreground/[0.035] text-foreground/45 hover:bg-foreground/[0.07] hover:text-foreground/70",
              )}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-[13px]">Ara...</span>
              <span className="flex items-center gap-0.5 text-[10px]">
                <Command className="h-3 w-3" />K
              </span>
            </button>
          </>
        )}

        <nav className={cn("relative flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-thumb-foreground/10", compact ? "px-2" : "px-3")}>
          {compact ? (
            <div className="space-y-2">
              {allItems.map((item) => (
                <SidebarLink
                  key={item.path}
                  item={item}
                  compact
                  mobile={mobile}
                  onNavigate={() => setSidebarCollapsed(true)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {mainGroup && (
                <section>
                  <p className={cn("mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.17em]", light ? "text-slate-400" : "text-foreground/30")}>
                    Ana Panel
                  </p>
                  <div className="space-y-1">
                    {mainGroup.items.map((item) => (
                      <SidebarLink
                        key={item.path}
                        item={item}
                        mobile={mobile}
                        onNavigate={() => setSidebarCollapsed(true)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {moduleGroups.length > 0 && (
                <section>
                  <p className={cn("mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.17em]", light ? "text-slate-400" : "text-foreground/30")}>
                    Modüller
                  </p>
                  <div className="space-y-1.5">
                    {moduleGroups.map((group, index) => {
                      const open = openGroups.has(group.id);
                      const active = group.items.some((item) =>
                        pathIsActive(location.pathname, item.path),
                      );
                      const GroupIcon = group.items[0]?.icon || Layers;

                      return (
                        <motion.div
                          key={group.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.025 }}
                          className={cn(
                    "overflow-hidden rounded-[9px] border p-0.5",
                            light
                              ? "border-slate-200/90 bg-white/55"
                              : "border-foreground/[0.08] bg-foreground/[0.025]",
                            active &&
                              (light
                                ? "border-[hsl(var(--brand-primary)/0.24)] bg-white"
                                : "border-foreground/15 bg-foreground/[0.05]"),
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-left transition hover:bg-foreground/[0.06]",
                              light ? "text-slate-600" : "text-foreground/62",
                              active && (light ? "text-slate-950" : "text-white"),
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", light ? "bg-slate-100" : "bg-foreground/[0.055]")}>
                                <GroupIcon
                                  className="h-4 w-4"
                                  style={{
                                    color:
                                      "hsl(var(--brand-primary-text, var(--brand-accent)))",
                                  }}
                                />
                              </span>
                              <span className="truncate text-[13px] font-medium">
                                {group.title}
                              </span>
                            </span>
                            <span className="ml-2 flex items-center gap-2">
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[9px]", light ? "bg-slate-100 text-slate-500" : "bg-foreground/[0.08] text-foreground/45")}>
                                {group.items.length}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform",
                                  open && "rotate-180",
                                )}
                              />
                            </span>
                          </button>
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-1 space-y-1 overflow-hidden"
                              >
                                {group.items.map((item) => (
                                  <SidebarLink
                                    key={item.path}
                                    item={item}
                                    mobile={mobile}
                                    onNavigate={() => setSidebarCollapsed(true)}
                                  />
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </nav>

        <footer className={cn("relative flex-shrink-0 border-t border-foreground/[0.07]", compact ? "p-2" : "p-3")}>
          <div className={cn("flex items-center", compact ? "flex-col gap-2" : "justify-between rounded-xl border border-foreground/[0.08] bg-foreground/[0.025] p-1.5")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setTheme(light ? "dark" : "light")}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-[10px] transition hover:bg-foreground/10", light ? "text-slate-500 hover:text-slate-950" : "text-foreground/55 hover:text-white")}
                  aria-label={light ? "Koyu temaya geç" : "Açık temaya geç"}
                >
                  {light ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{light ? "Koyu tema" : "Açık tema"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setLanguage(language === "tr" ? "en" : "tr")}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-[10px] text-[11px] font-black tracking-wide transition hover:bg-foreground/10", light ? "text-slate-500 hover:text-slate-950" : "text-foreground/55 hover:text-white")}
                  aria-label={language === "tr" ? "Switch to English" : "Türkçeye geç"}
                >
                  {language === "tr" ? "EN" : "TR"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{language === "tr" ? "English" : "Türkçe"}</TooltipContent>
            </Tooltip>
            {!compact && (
              <div className="min-w-0 px-2 text-center">
                <p className={cn("max-w-[150px] truncate text-[10px]", light ? "text-slate-500" : "text-foreground/40")}>
                  {displayEmail}
                </p>
                <p className={cn("mt-1 text-[9px]", light ? "text-slate-400" : "text-foreground/25")}>
                  © 2026 SchoolAsist
                </p>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-[10px] text-foreground/55 transition hover:bg-red-500/10",
                    light ? "hover:text-red-600" : "hover:text-red-300",
                  )}
                  aria-label="Çıkış yap"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Çıkış yap</TooltipContent>
            </Tooltip>
          </div>
        </footer>
      </motion.aside>
    </TooltipProvider>
  );
}
