import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearDesktopSession,
  createDesktopUser,
  desktopApiBaseUrl,
  initDesktopSessionStore,
  loadDesktopSession,
  loginWithBackend,
  persistDesktopSession,
  resolveUserInstitutionType,
} from '../lib/auth';
import { startPkceLogin, exchangePkceCode } from '../lib/auth/pkce';
import { setActiveBranchFilter, setActiveTenantContext } from '../lib/api/client';
import { fetchDrivingSchoolStatus } from '../lib/api/modules';
import { resetDrivingPermissionCache } from '../lib/drivingPermissions';
import { resetEntitlementCache } from '../lib/entitlements';
import { resetInstitutionTypeCache } from '../lib/institutionType';
import { resetTenantFeatureCache } from '../lib/tenantFeatures';

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

function resetTenantAccessCaches() {
  resetDrivingPermissionCache();
  resetEntitlementCache();
  resetInstitutionTypeCache();
  resetTenantFeatureCache();
}

async function reconcileInstitutionSession(currentSession) {
  if (!currentSession?.user || currentSession.user.isPlatformAdmin) {
    return currentSession;
  }

  const fallbackType = resolveUserInstitutionType(currentSession.user);
  try {
    const status = await fetchDrivingSchoolStatus();
    const institutionType = status?.institutionType || fallbackType;
    const drivingSchoolModuleEnabled =
      typeof status?.moduleEnabled === 'boolean'
        ? status.moduleEnabled
        : currentSession.user.drivingSchoolModuleEnabled;
    const user = {
      ...currentSession.user,
      institutionType,
      drivingSchoolModuleEnabled,
    };
    return { ...currentSession, user };
  } catch {
    // Ağ geçici olarak kapalıysa login yanıtındaki güvenilir bilgiyi koru.
    // Bayrak taşıyan eski oturumlar da burada DrivingSchool olarak iyileştirilir.
    if (fallbackType === currentSession.user.institutionType) return currentSession;
    return {
      ...currentSession,
      user: { ...currentSession.user, institutionType: fallbackType },
    };
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
  const [drawerOptions, setDrawerOptions] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Şifreli oturum deposu (keychain anahtarı + AES-GCM) async açılır;
    // isAuthLoading kapısı init bitene kadar UI'ı bekletir.
    (async () => {
      await initDesktopSessionStore();
      if (!active) return;
      let savedSession = loadDesktopSession();
      if (savedSession?.user) {
        // Açılışta kurum bağlamını ana kuruma sıfırla. Aksi halde önceki bir
        // oturumdan localStorage'da kalan X-Tenant-Context (ör. bir okul kurumu)
        // yeniden başlatmayı da atlatıp API'leri yanlış kuruma çözüyor ve sürücü
        // kursu sahibine okul menülerini sızdırıyordu. Kullanıcı gerekirse üst
        // bardaki kurum seçiciyle tekrar geçebilir.
        setActiveTenantContext(null);
        resetTenantAccessCaches();
        // Her açılışta kurum türünü sunucudan uzlaştır. Yalnızca alan boşken
        // kontrol etmek, eski/başka kuruma ait oturum değerinin kalıcı biçimde
        // sidebar'a taşınmasına neden oluyordu.
        savedSession = await reconcileInstitutionSession(savedSession);
        persistDesktopSession(savedSession);
        if (!active) return;
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
    setActiveBranchFilter(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ci-branch-selected');
    resetTenantAccessCaches();
    const desktopUser = createDesktopUser(payload);
    let nextSession = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAtUtc: payload.expiresAtUtc,
      refreshTokenExpiresAtUtc: payload.refreshTokenExpiresAtUtc,
      user: desktopUser,
    };

    persistDesktopSession(nextSession);
    nextSession = await reconcileInstitutionSession(nextSession);
    persistDesktopSession(nextSession);
    setSession(nextSession);
    setUser(nextSession.user);
    return nextSession.user;
  }, []);

  const loginWithBrowser = useCallback(async () => {
    const pkceResult = await startPkceLogin(desktopApiBaseUrl);
    const payload = await exchangePkceCode(desktopApiBaseUrl, pkceResult);
    enforceActiveSubscription(payload);
    setActiveTenantContext(null);
    setActiveBranchFilter(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ci-branch-selected');
    resetTenantAccessCaches();
    const desktopUser = createDesktopUser(payload);
    let nextSession = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAtUtc: payload.expiresAtUtc,
      refreshTokenExpiresAtUtc: payload.refreshTokenExpiresAtUtc,
      user: desktopUser,
    };

    persistDesktopSession(nextSession);
    nextSession = await reconcileInstitutionSession(nextSession);
    persistDesktopSession(nextSession);
    setSession(nextSession);
    setUser(nextSession.user);
    return nextSession.user;
  }, []);

  const logout = useCallback(() => {
    clearDesktopSession();
    // Aktif kurum bağlamı (X-Tenant-Context) + şube filtresi/seçimi sıfırlanır.
    // ÖNEMLİ: ci-tenant-context'i temizlemek şart; aksi halde çok-kurumlu bir
    // oturumdan (ör. bir okul kurumunu görüntüleme) kalan bağlam localStorage'da
    // kalıp sonraki girişte de API'lere gidiyor ve yanlış kuruma çözülüyordu —
    // sürücü kursu sahibi girse bile okul kurumu çözülüp okul menüleri sızıyordu.
    setActiveTenantContext(null);
    setActiveBranchFilter(null);
    resetTenantAccessCaches();
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

  const openDrawer = (content, options = null) => {
    setDrawerContent(content);
    setDrawerOptions(options);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerContent(null);
      setDrawerOptions(null);
    }, 300);
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
    drawerOptions,
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
    drawerOptions,
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
