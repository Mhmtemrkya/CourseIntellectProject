import { useEntitlements } from '../hooks/useEntitlements';

/**
 * Sayfa içi işlem (buton, sekme, form) paket yetkisine bağlıysa bununla sarılır.
 *
 *   <FeatureGate role="teacher" module="exams" action="create">
 *     <Button>Sınav Oluştur</Button>
 *   </FeatureGate>
 *
 * `action` verilmezse yalnızca modülün açık olması yeterlidir.
 * Yetki yoksa hiçbir şey render edilmez (fallback verilirse o gösterilir).
 */
export function FeatureGate({ role, module: moduleKey, action, fallback = null, children }) {
  const { loaded, hasModule, can } = useEntitlements(role);
  if (!loaded) return null;
  const allowed = action ? can(moduleKey, action) : hasModule(moduleKey);
  return allowed ? children : fallback;
}
