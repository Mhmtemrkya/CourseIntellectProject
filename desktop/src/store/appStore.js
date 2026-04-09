// CourseIntellect App Store - Global UI State
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Sidebar State
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Drawer State
      drawerOpen: false,
      drawerContent: null,
      openDrawer: (content) => set({ drawerOpen: true, drawerContent: content }),
      closeDrawer: () => {
        set({ drawerOpen: false });
        // Clear content after animation
        setTimeout(() => set({ drawerContent: null }), 300);
      },

      // Command Palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

      // Notifications
      notifications: [],
      unreadCount: 0,
      addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      })),
      markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      })),
      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      })),
      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      // Active Tenant/Branch
      activeTenant: null,
      activeBranch: null,
      setActiveTenant: (tenant) => set({ activeTenant: tenant }),
      setActiveBranch: (branch) => set({ activeBranch: branch }),

      // Settings
      reducedMotion: false,
      setReducedMotion: (enabled) => set({ reducedMotion: enabled }),

      // Loading States
      globalLoading: false,
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
    }),
    {
      name: 'courseintellect-app',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        reducedMotion: state.reducedMotion,
        activeTenant: state.activeTenant,
        activeBranch: state.activeBranch,
      }),
    }
  )
);

// Selectors for performance
export const useSidebarCollapsed = () => useAppStore((state) => state.sidebarCollapsed);
export const useDrawer = () => useAppStore((state) => ({
  drawerOpen: state.drawerOpen,
  drawerContent: state.drawerContent,
  openDrawer: state.openDrawer,
  closeDrawer: state.closeDrawer,
}));
export const useCommandPalette = () => useAppStore((state) => ({
  commandPaletteOpen: state.commandPaletteOpen,
  setCommandPaletteOpen: state.setCommandPaletteOpen,
  toggleCommandPalette: state.toggleCommandPalette,
}));
export const useNotifications = () => useAppStore((state) => ({
  notifications: state.notifications,
  unreadCount: state.unreadCount,
  addNotification: state.addNotification,
  markAllAsRead: state.markAllAsRead,
  markAsRead: state.markAsRead,
}));
