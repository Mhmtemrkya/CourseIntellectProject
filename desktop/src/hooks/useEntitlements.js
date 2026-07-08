import { useEffect, useState } from 'react';
import { getEntitlements, isActionAllowed, isModuleAllowed } from '../lib/entitlements';

/**
 * Kurum paket yetkilerini React tarafında kullanmak için hook.
 *
 * Kullanım:
 *   const { can, hasModule, loaded } = useEntitlements('teacher');
 *   if (!can('exams', 'create')) return null; // "Sınav Oluştur" butonunu gizle
 */
export function useEntitlements(roleKey) {
  const [entitlements, setEntitlements] = useState(null);

  useEffect(() => {
    let active = true;
    getEntitlements().then((value) => {
      if (active) setEntitlements(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    loaded: entitlements !== null,
    entitlements,
    hasModule: (moduleKey) => isModuleAllowed(entitlements, roleKey, moduleKey),
    can: (moduleKey, actionKey) => isActionAllowed(entitlements, roleKey, moduleKey, actionKey),
  };
}
