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
  buildDesktopSession,
  clearDesktopSession,
  desktopApiBaseUrl,
  initDesktopSessionStore,
  loadDesktopSession,
  loginWithBackend,
  persistDesktopSession,
} from '../lib/auth';
import { startPkceLogin, exchangePkceCode } from '../lib/auth/pkce';
import { setRememberSession } from '../lib/secureSession';
import {
  REFRESH_SKEW_MS,
  ensureFreshDesktopSession,
  onSessionRefreshed,
  parseUtcMs,
} from '../lib/sessionRefresh';
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
  /** "Beni hatırla": kapalıysa oturum uygulama kapanınca düşer. */
  remember?: boolean;
}

export interface AppContextValue {
  user: DesktopUser | null;
  session: DesktopSession | null;
  setUser: Dispatch<SetStateAction<DesktopUser | null>>;
  setSession: Dispatch<SetStateAction<DesktopSession | null>>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<DesktopUser>;
  loginWithBrowser: (remember?: boolean) => Promise<DesktopUser>;
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
      // Geri yüklenen oturum panel açılmadan tazelenir; aksi halde süresi
      // dolmuş token'la ilk istek 401 alıp kullanıcıyı çıkışa atıyordu.
      const outcome = loadDesktopSession()?.user ? await ensureFreshDesktopSession() : null;
      if (!active) return;
      const savedSession = outcome?.status === 'fresh'
        || (outcome?.status === 'unavailable' && parseUtcMs(outcome.session?.expiresAtUtc) > Date.now())
        ? outcome.session
        : null;
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

  const login = useCallback(async ({ username, password, remember = false }: LoginCredentials): Promise<DesktopUser> => {
    const payload = await loginWithBackend(username, password);
    enforceActiveSubscription(payload);
    setRememberSession(remember, username);
    // Taze giriş ana kuruma başlar; önceki oturumdan kalan kurum bağlamı
    // (X-Tenant-Context) temizlenir ki yanlış kuruma çözülmesin.
    setActiveTenantContext(null);
    setActiveBranchFilter(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ci-branch-selected');
    resetTenantAccessCaches();
    const nextSession = buildDesktopSession(payload);

    persistDesktopSession(nextSession);
    setSession(nextSession);
    setUser(nextSession.user);
    return nextSession.user;
  }, []);

  const loginWithBrowser = useCallback(async (remember = false): Promise<DesktopUser> => {
    const pkceResult = await startPkceLogin(desktopApiBaseUrl);
    const payload = await exchangePkceCode(desktopApiBaseUrl, pkceResult);
    enforceActiveSubscription(payload);
    setRememberSession(remember, payload.user?.username ?? '');
    setActiveTenantContext(null);
    setActiveBranchFilter(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('ci-branch-selected');
    resetTenantAccessCaches();
    const nextSession = buildDesktopSession(payload);

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

  // Yenilenen oturum (istemci ya da zamanlayıcı) bağlama yansır.
  useEffect(() => onSessionRefreshed((next) => {
    setSession(next);
    setUser(next.user);
  }), []);

  // Token süresi dolmadan önce ve pencereye geri dönülünce tazelenir; uyku
  // modundan dönüşte zamanlayıcı gecikmiş olabilir. Sunucu reddederse çıkılır.
  const expiresAtUtc = session?.expiresAtUtc;
  useEffect(() => {
    if (!expiresAtUtc) return undefined;
    const refresh = () => {
      void ensureFreshDesktopSession().then((outcome) => {
        if (outcome.status === 'unauthorized') {
          setSession(null);
          setUser(null);
        }
      });
    };
    const delay = Math.max(0, parseUtcMs(expiresAtUtc) - REFRESH_SKEW_MS - Date.now());
    // setTimeout üst sınırı ~24,8 gün; access token zaten saatlerle ölçülür.
    const timer = window.setTimeout(refresh, Math.min(delay, 2_147_000_000));
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAtUtc]);

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
