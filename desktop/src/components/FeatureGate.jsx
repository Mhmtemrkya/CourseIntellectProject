import { useApp } from '../context/AppContext';
import { getUserRoles } from '../lib/permissions';
import { useEntitlements } from '../hooks/useEntitlements';

/**
 * Sayfa içi işlem (buton, sekme, form) paket yetkisine bağlıysa bununla sarılır.
 *
 *   <FeatureGate module="students" action="create">
 *     <Button>Yeni Öğrenci</Button>
 *   </FeatureGate>
 *
 * `role` verilmezse oturum açan kullanıcının birincil rolü kullanılır.
 * `action` verilmezse yalnızca modülün açık olması yeterlidir.
 * Yetki yoksa hiçbir şey render edilmez (fallback verilirse o gösterilir).
 */
export function FeatureGate({ role, module: moduleKey, action, fallback = null, children }) {
  const { user } = useApp();
  const effectiveRole = role || getUserRoles(user)[0] || 'student';
  const { loaded, hasModule, can } = useEntitlements(effectiveRole);
  if (!loaded) return null;
  if (user?.isPlatformAdmin) return children;
  const allowed = action ? can(moduleKey, action) : hasModule(moduleKey);
  return allowed ? children : fallback;
}
