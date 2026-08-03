import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useApp } from '../../context/AppContext';
import { getUserRoles, isPathVisibleForRoles } from '../../lib/permissions';
import { getDisabledFeatureKeys, isPathDisabled } from '../../lib/tenantFeatures';
import { findHubByPath } from '../../lib/navigation/hubs';

/**
 * Hub sekme şeridi. Menüde tek satıra katlanan konu hub'ının kardeş ekranları
 * sayfanın üstünde sekme olarak listelenir.
 *
 * Rotalara DOKUNMAZ: şerit adrese bakarak kendini çizer, sekmeler gerçek
 * bağlantılardır. Böylece eski adresler, yer imleri ve testler aynen çalışır;
 * sayfaların kendi başlıkları korunur (şerit başlıksızdır, iki başlık üst üste
 * gelmez).
 */
export function SectionHubTabs() {
  const location = useLocation();
  const { user } = useApp();
  const [disabledFeatures, setDisabledFeatures] = useState(null);

  useEffect(() => {
    let alive = true;
    getDisabledFeatureKeys()
      .then((keys) => alive && setDisabledFeatures(keys))
      .catch(() => alive && setDisabledFeatures(null));
    return () => {
      alive = false;
    };
  }, []);

  const roles = useMemo(() => getUserRoles(user), [user]);
  const hub = findHubByPath(location.pathname);

  // Menüdeki filtrelerin aynısı: role kapalı ya da kurumda kapatılmış ekran
  // sekme şeridinde de görünmez.
  const tabs = (hub?.tabs || []).filter(
    (tab) =>
      isPathVisibleForRoles(tab.path, roles) && !isPathDisabled(tab.path, disabledFeatures),
  );

  if (!hub || tabs.length < 2) return null;

  return (
    <nav
      aria-label={`${hub.label} bölümleri`}
      className="-mx-1 mb-4 overflow-x-auto px-1 pb-1"
      data-testid={`hub-tabs-${hub.id}`}
    >
      <div className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border/65 bg-muted/55 p-1 text-muted-foreground backdrop-blur-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              end
              data-testid={`hub-tab-${tab.path.replace(/\//g, '-').slice(1)}`}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent)/0.4)]',
                  isActive
                    ? 'bg-[hsl(var(--brand-accent)/0.13)] text-[hsl(var(--brand-accent))] shadow-[inset_0_0_0_1px_hsl(var(--brand-accent)/0.25)]'
                    : 'hover:text-foreground',
                )
              }
            >
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default SectionHubTabs;
