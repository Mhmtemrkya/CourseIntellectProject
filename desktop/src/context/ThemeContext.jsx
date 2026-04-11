import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  generateBrandCSSVariables,
  applyBrandVariables,
  removeBrandVariables,
  DEFAULT_PRIMARY,
  DEFAULT_ACCENT,
} from '../lib/colorPalette';
import { loadDesktopSession } from '../lib/auth';

const ThemeContext = createContext({
  // Dark / Light mode
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  // Tenant branding
  primaryColor: DEFAULT_PRIMARY,
  accentColor: DEFAULT_ACCENT,
  tenantLogo: null,
  tenantName: '',
  isBrandingLoaded: false,
  refreshBranding: () => {},
});

export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'courseintellect-theme' }) {
  // ─── Dark / Light Mode ─────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) || defaultTheme;
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState('light');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.classList.add(effectiveTheme);
    setResolvedTheme(effectiveTheme);
  }, [theme]);

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        const newTheme = e.matches ? 'dark' : 'light';
        root.classList.add(newTheme);
        setResolvedTheme(newTheme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // ─── Tenant Branding ───────────────────────────────────────────────
  const [branding, setBranding] = useState({
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
    tenantLogo: null,
    tenantName: '',
  });
  const [isBrandingLoaded, setIsBrandingLoaded] = useState(false);

  const fetchBranding = useCallback(async () => {
    try {
      const { fetchTenantBranding } = await import('../lib/api/modules');
      const tenantId = loadDesktopSession()?.user?.tenantId || undefined;
      const config = await fetchTenantBranding(tenantId);
      if (config) {
        setBranding({
          primaryColor: config.primaryColor || DEFAULT_PRIMARY,
          accentColor: config.accentColor || DEFAULT_ACCENT,
          tenantLogo: config.logoUrl || null,
          tenantName: config.appName || config.tenantName || '',
        });
      }
    } catch {
      // API hatası — varsayılan renklerle devam et
    } finally {
      setIsBrandingLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Renk değiştiğinde CSS variable'ları uygula
  const cssVars = useMemo(
    () => generateBrandCSSVariables(branding.primaryColor, branding.accentColor),
    [branding.primaryColor, branding.accentColor]
  );

  useEffect(() => {
    applyBrandVariables(cssVars);
    return () => removeBrandVariables(cssVars);
  }, [cssVars]);

  // ─── Context Value ─────────────────────────────────────────────────
  const value = useMemo(
    () => ({
      // Dark / Light
      theme,
      setTheme: (newTheme) => {
        localStorage.setItem(storageKey, newTheme);
        setTheme(newTheme);
      },
      resolvedTheme,
      // Branding
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      tenantLogo: branding.tenantLogo,
      tenantName: branding.tenantName,
      isBrandingLoaded,
      refreshBranding: fetchBranding,
    }),
    [theme, storageKey, resolvedTheme, branding, isBrandingLoaded, fetchBranding]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
