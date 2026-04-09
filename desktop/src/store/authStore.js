// CourseIntellect Auth Store - Zustand with Tauri persistence
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Tauri Store adapter (for desktop) or localStorage (for web)
const getTauriStorage = () => {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return {
      getItem: async (name) => {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = new Store('.auth.dat');
        return await store.get(name);
      },
      setItem: async (name, value) => {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = new Store('.auth.dat');
        await store.set(name, value);
        await store.save();
      },
      removeItem: async (name) => {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = new Store('.auth.dat');
        await store.delete(name);
        await store.save();
      },
    };
  }
  // Fallback to localStorage for web
  return createJSONStorage(() => localStorage);
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${get().baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            throw new Error('Geçersiz kimlik bilgileri');
          }

          const data = await response.json();
          set({
            user: data.user,
            token: data.token,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken, baseUrl } = get();
        if (!refreshToken) return false;

        try {
          const response = await fetch(`${baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            get().logout();
            return false;
          }

          const data = await response.json();
          set({ token: data.token, refreshToken: data.refreshToken });
          return true;
        } catch {
          get().logout();
          return false;
        }
      },

      // Settings
      baseUrl: 'https://api.courseintellect.com',
      setBaseUrl: (url) => set({ baseUrl: url }),
    }),
    {
      name: 'courseintellect-auth',
      storage: getTauriStorage(),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        baseUrl: state.baseUrl,
      }),
    }
  )
);
