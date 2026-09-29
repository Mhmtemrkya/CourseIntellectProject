import { useEffect, useState } from 'react';
import { getEntitlements, isActionAllowed, isModuleAllowed, type Entitlements } from '../lib/entitlements';

export interface EntitlementsHook {
  loaded: boolean;
  entitlements: Entitlements | null;
  hasModule: (moduleKey: string) => boolean;
  can: (moduleKey: string, actionKey: string) => boolean;
}

/**
 * Kurum paket yetkilerini React tarafında kullanmak için hook.
 *
 * Kullanım:
 *   const { can, hasModule, loaded } = useEntitlements('teacher');
 *   if (!can('exams', 'create')) return null; // "Sınav Oluştur" butonunu gizle
 */
export function useEntitlements(roleKey: string | null | undefined): EntitlementsHook {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useEffect(() => {
    let active = true;
    void getEntitlements().then((value) => {
      if (active) setEntitlements(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    loaded: entitlements !== null,
    entitlements,
    hasModule: (moduleKey: string) => isModuleAllowed(entitlements, roleKey, moduleKey),
    can: (moduleKey: string, actionKey: string) => isActionAllowed(entitlements, roleKey, moduleKey, actionKey),
  };
}
