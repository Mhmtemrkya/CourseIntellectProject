import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearDesktopSession,
  createDesktopUser,
  desktopApiBaseUrl,
  initDesktopSessionStore,
  loadDesktopSession,
  loginWithBackend,
  persistDesktopSession,
} from '../lib/auth';
import { startPkceLogin, exchangePkceCode } from '../lib/auth/pkce';
import { setActiveTenantContext } from '../lib/api/client';

// Module-level helper: aktif abonelik kontrolü. Component içinde tanımlanırsa
// her render'da yeni reference oluşur ve login/loginWithBrowser useCallback
// deps'ini kirletir.
function enforceActiveSubscription(payload) {
  const apiUser = payload?.user;
  if (apiUser && apiUser.subscriptionRequired === true && apiUser.isPlatformAdmin !== true) {
    const err = new Error(
      "Kurum aboneliğiniz aktif değil. Lütfen kurum yöneticinizle iletişime geçin ve ödemeyi tamamlayın."
    );
    err.code = "SUBSCRIPTION_REQUIRED";
    throw err;
  }
}

const AppContext = createContext({
  user: null,
  session: null,
  setUser: () => {},
  setSession: () => {},
  isAuthenticated: false,
  isAuthLoading: true,
  login: () => {},
  logout: () => {},
  setUserRole: () => {},
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  drawerOpen: false,
  drawerContent: null,
  openDrawer: () => {},
  closeDrawer: () => {},
  commandPaletteOpen: false,
  setCommandPaletteOpen: () => {},
});

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Şifreli oturum deposu (keychain anahtarı + AES-GCM) async açılır;
    // isAuthLoading kapısı init bitene kadar UI'ı bekletir.
    (async () => {
      await initDesktopSessionStore();
      if (!active) return;
      const savedSession = loadDesktopSession();
      if (savedSession?.user) {
        // Açılışta kurum bağlamını ana kuruma sıfırla. Aksi halde önceki bir
        // oturumdan localStorage'da kalan X-Tenant-Context (ör. bir okul kurumu)
        // yeniden başlatmayı da atlatıp API'leri yanlış kuruma çözüyor ve sürücü
        // kursu sahibine okul menülerini sızdırıyordu. Kullanıcı gerekirse üst
        // bardaki kurum seçiciyle tekrar geçebilir.
        setActiveTenantContext(null);
        setSession(savedSession);
        setUser(savedSession.user);
      }
      setIsAuthLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const payload = await loginWithBackend(username, password);
    enforceActiveSubscription(payload);
    // Taze giriş ana kuruma başlar; önceki oturumdan kalan kurum bağlamı
    // (X-Tenant-Context) temizlenir ki yanlış kuruma çözülmesin.
    setActiveTenantContext(null);
    const desktopUser = createDesktopUser(payload);
    const nextSession = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAtUtc: payload.expiresAtUtc,
      refreshTokenExpiresAtUtc: payload.refreshTokenExpiresAtUtc,
      user: desktopUser,
    };

    persistDesktopSession(nextSession);
    setSession(nextSession);
    setUser(desktopUser);
    return desktopUser;
  }, []);

  const loginWithBrowser = useCallback(async () => {
    const pkceResult = await startPkceLogin(desktopApiBaseUrl);
    const payload = await exchangePkceCode(desktopApiBaseUrl, pkceResult);
    enforceActiveSubscription(payload);
    setActiveTenantContext(null);
    const desktopUser = createDesktopUser(payload);
    const nextSession = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAtUtc: payload.expiresAtUtc,
      refreshTokenExpiresAtUtc: payload.refreshTokenExpiresAtUtc,
      user: desktopUser,
    };

    persistDesktopSession(nextSession);
    setSession(nextSession);
    setUser(desktopUser);
    return desktopUser;
  }, []);

  const logout = useCallback(() => {
    clearDesktopSession();
    // Aktif kurum bağlamı (X-Tenant-Context) + şube filtresi/seçimi sıfırlanır.
    // ÖNEMLİ: ci-tenant-context'i temizlemek şart; aksi halde çok-kurumlu bir
    // oturumdan (ör. bir okul kurumunu görüntüleme) kalan bağlam localStorage'da
    // kalıp sonraki girişte de API'lere gidiyor ve yanlış kuruma çözülüyordu —
    // sürücü kursu sahibi girse bile okul kurumu çözülüp okul menüleri sızıyordu.
    setActiveTenantContext(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ci-branch-selected');
    }
    setSession(null);
    setUser(null);
  }, []);

  const markPasswordChanged = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mustChangePassword: false };
      setSession((prevSession) => {
        if (!prevSession) return prevSession;
        const updated = { ...prevSession, user: next };
        persistDesktopSession(updated);
        return updated;
      });
      return next;
    });
  }, []);

  const setUserRole = useCallback((role) => {
    if (user) {
      setUser({ ...user, role });
    }
  }, [user]);

  const openDrawer = (content) => {
    setDrawerContent(content);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerContent(null), 300);
  };

  const value = useMemo(() => ({
    user,
    session,
    setUser,
    setSession,
    isAuthenticated: !!user,
    isAuthLoading,
    login,
    loginWithBrowser,
    logout,
    markPasswordChanged,
    setUserRole,
    sidebarCollapsed,
    setSidebarCollapsed,
    drawerOpen,
    drawerContent,
    openDrawer,
    closeDrawer,
    commandPaletteOpen,
    setCommandPaletteOpen,
    apiBaseUrl: desktopApiBaseUrl,
  }), [
    user,
    session,
    isAuthLoading,
    sidebarCollapsed,
    drawerOpen,
    drawerContent,
    commandPaletteOpen,
    setUserRole,
    markPasswordChanged,
    login,
    loginWithBrowser,
    logout,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
