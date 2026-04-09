import { createContext, useContext, useState } from 'react';
import { currentUser } from '../lib/mockData';

const AppContext = createContext({
  user: null,
  setUser: () => {},
  isAuthenticated: false,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const login = (credentials) => {
    // Mock login - in real app, this would call API
    if (credentials.email && credentials.password) {
      setUser(currentUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const setUserRole = (role) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  const openDrawer = (content) => {
    setDrawerContent(content);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerContent(null), 300);
  };

  const value = {
    user,
    setUser,
    isAuthenticated: !!user,
    login,
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
  };

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
