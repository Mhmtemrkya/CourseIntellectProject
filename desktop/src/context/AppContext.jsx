import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearDesktopSession,
  createDesktopUser,
  desktopApiBaseUrl,
  loadDesktopSession,
  loginWithBackend,
  persistDesktopSession,
} from '../lib/auth';
import { startPkceLogin, exchangePkceCode } from '../lib/auth/pkce';

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
    const savedSession = loadDesktopSession();
    if (savedSession?.user) {
      setSession(savedSession);
      setUser(savedSession.user);
    }
    setIsAuthLoading(false);
  }, []);

  const enforceActiveSubscription = (payload) => {
    const apiUser = payload?.user;
    if (apiUser && apiUser.subscriptionRequired === true && apiUser.isPlatformAdmin !== true) {
      const err = new Error(
        "Kurum aboneliğiniz aktif değil. Lütfen kurum yöneticinizle iletişime geçin ve ödemeyi tamamlayın."
      );
      err.code = "SUBSCRIPTION_REQUIRED";
      throw err;
    }
  };

  const login = async ({ username, password }) => {
    const payload = await loginWithBackend(username, password);
    enforceActiveSubscription(payload);
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
  };

  const loginWithBrowser = async () => {
    const pkceResult = await startPkceLogin(desktopApiBaseUrl);
    const payload = await exchangePkceCode(desktopApiBaseUrl, pkceResult);
    enforceActiveSubscription(payload);
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
  };

  const logout = () => {
    clearDesktopSession();
    setSession(null);
    setUser(null);
  };

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
