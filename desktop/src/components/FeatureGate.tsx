import { cloneElement, forwardRef, isValidElement, type HTMLAttributes, type ReactNode } from 'react';
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
 *
 * asChild uyumu: `<DialogTrigger asChild>` gibi sarmalayıcılar onClick/ref'i bu
 * bileşene geçirir. Eskiden bunlar tek çocuğa iletilmediği için (DialogTrigger →
 * FeatureGate → Button) buton tıklaması diyaloğu açmıyordu. Artık gelen ekstra
 * prop/ref tek element çocuğa aktarılır; sade (prop'suz) kullanımlar değişmez.
 */
/**
 * asChild sarmalayıcılarının ilettiği olay/erişilebilirlik prop'ları da kabul
 * edilir (data-* öznitelikleri JSX'te zaten serbesttir). `role` burada ARIA
 * rolü değil, yetki kontrolünde kullanılacak kullanıcı rolüdür.
 */
export interface FeatureGateProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'role'> {
  role?: string;
  module: string;
  action?: string;
  fallback?: ReactNode;
  children?: ReactNode;
}

export const FeatureGate = forwardRef<HTMLElement, FeatureGateProps>(function FeatureGate(
  { role, module: moduleKey, action, fallback = null, children, ...rest },
  ref,
) {
  const { user } = useApp();
  const effectiveRole = role || getUserRoles(user)[0] || 'student';
  const { loaded, hasModule, can } = useEntitlements(effectiveRole);
  if (!loaded) return null;
  const allowed = user?.isPlatformAdmin || (action ? can(moduleKey, action) : hasModule(moduleKey));
  if (!allowed) return fallback;
  if (isValidElement<Record<string, unknown>>(children) && (ref || Object.keys(rest).length > 0)) {
    const ownRef = 'ref' in children ? children.ref : undefined;
    return cloneElement(children, { ...rest, ref: ref ?? ownRef });
  }
  return children;
});
