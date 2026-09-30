import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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
import { setActiveBranchFilter, setActiveTenantContext } from '../lib/api/client';
import { resetEntitlementCache } from '../lib/entitlements';
import { resetTenantFeatureCache } from '../lib/tenantFeatures';
import { createCodedError } from '../lib/errors';
import type { DesktopSession, DesktopUser, LoginPayload } from '../types/session';

export interface DrawerOptions {
  size?: 'wide';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AppContextValue {
  user: DesktopUser | null;
  session: DesktopSession | null;
  setUser: Dispatch<SetStateAction<DesktopUser | null>>;
  setSession: Dispatch<SetStateAction<DesktopSession | null>>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<DesktopUser>;
  loginWithBrowser: () => Promise<DesktopUser>;
  logout: () => void;
  markPasswordChanged: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  drawerOpen: boolean;
  drawerContent: ReactNode;
  drawerOptions: DrawerOptions | null;
  openDrawer: (content: ReactNode, options?: DrawerOptions | null) => void;
  closeDrawer: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  apiBaseUrl: string;
}

// Module-level helper: aktif abonelik kontrolü. Component içinde tanımlanırsa
// her render'da yeni reference oluşur ve login/loginWithBrowser useCallback
// deps'ini kirletir.
function enforceActiveSubscription(payload: LoginPayload | null | undefined): void {
  const apiUser = payload?.user;
  if (apiUser && apiUser.subscriptionRequired === true && apiUser.isPlatformAdmin !== true) {
    throw createCodedError(
      "Kurum aboneliğiniz aktif değil. Lütfen kurum yöneticinizle iletişime geçin ve ödemeyi tamamlayın.",
      "SUBSCRIPTION_REQUIRED",
    );
  }
}

function buildSession(payload: LoginPayload): DesktopSession {
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAtUtc: payload.expiresAtUtc,
    refreshTokenExpiresAtUtc: payload.refreshTokenExpiresAtUtc,
    user: createDesktopUser(payload),
  };
}

function resetTenantAccessCaches(): void {
  resetEntitlementCache();
  resetTenantFeatureCache();
}

// Sağlayıcı dışında kullanım hatadır; useApp bunu açık bir hatayla yakalar.
const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children?: ReactNode }) {
  const [user, setUser] = useState<DesktopUser | null>(null);
  const [session, setSession] = useState<DesktopSession | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<ReactNode>(null);
  const [drawerOptions, setDrawerOptions] = useState<DrawerOptions | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Şifreli oturum deposu (keychain anahtarı + AES-GCM) async açılır;
    // isAuthLoading kapısı init bitene kadar UI'ı bekletir.
    void (async () => {
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
        resetTenantAccessCaches();
        if (!active) return;
        setSession(savedSession);
        setUser(savedSession.user);
      }
      setIsAuthLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async ({ username, password }: LoginCredentials): Promise<DesktopUser> => {
    const payload = await loginWithBackend(username, password);
    enforceActiveSubscription(payload);
    // Taze giriş ana kuruma başlar; önceki oturumdan kalan kurum bağlamı
    // (X-Tenant-Context) temizlenir ki yanlış kuruma çözülmesin.
    setActiveTenantContext(null);
    setActiveBranchFilter(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ci-branch-selected');
    resetTenantAccessCaches();
    const nextSession = buildSession(payload);

    persistDesktopSession(nextSession);
    setSession(nextSession);
    setUser(nextSession.user);
    return nextSession.user;
  }, []);

  const loginWithBrowser = useCallback(async (): Promise<DesktopUser> => {
    const pkceResult = await startPkceLogin(desktopApiBaseUrl);
    const payload = await exchangePkceCode(desktopApiBaseUrl, pkceResult);
    enforceActiveSubscription(payload);
    setActiveTenantContext(null);
    setActiveBranchFilter(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ci-branch-selected');
    resetTenantAccessCaches();
    const nextSession = buildSession(payload);

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

  const openDrawer = (content: ReactNode, options: DrawerOptions | null = null): void => {
    setDrawerContent(content);
    setDrawerOptions(options);
    setDrawerOpen(true);
  };

  const closeDrawer = (): void => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerContent(null);
      setDrawerOptions(null);
    }, 300);
  };

  const value = useMemo<AppContextValue>(() => ({
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

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
