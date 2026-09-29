import { fetchMyEntitlements } from './api/modules';

/**
 * Kurum paket yetkileri (entitlements) — oturum boyunca önbelleğe alınır.
 *
 * Backend, kurumun atandığı paketin rol → modül → aksiyon tanımını döner.
 * Kayıt yoksa veya API okunamazsa güvenli varsayılan "tümü açık"tır
 * (unrestricted), böylece paket tanımlanmamış kurumlar kilitlenmez.
 */
export interface ModuleEntitlement {
  enabled?: boolean;
  actions?: Record<string, boolean>;
}

export interface RoleEntitlement {
  modules?: Record<string, ModuleEntitlement>;
}

export interface Entitlements {
  unrestricted: boolean;
  roles: Record<string, RoleEntitlement>;
}

let cached: Entitlements | null = null;
let pending: Promise<Entitlements> | null = null;

const UNRESTRICTED: Entitlements = { unrestricted: true, roles: {} };

export async function getEntitlements(): Promise<Entitlements> {
  if (cached) return cached;
  if (!pending) {
    pending = fetchMyEntitlements()
      .then((payload): Entitlements => {
        if (!payload || payload.unrestricted || !payload.roles) return UNRESTRICTED;
        return { unrestricted: false, roles: payload.roles };
      })
      .catch(() => UNRESTRICTED);
  }
  cached = await pending;
  return cached;
}

export function resetEntitlementCache(): void {
  cached = null;
  pending = null;
}

/** Rolün tanımı paket içinde var mı? Yoksa o rol kısıtsız kabul edilir. */
function getRoleEntry(
  entitlements: Entitlements | null | undefined,
  roleKey: string | null | undefined,
): RoleEntitlement | null {
  if (!entitlements || entitlements.unrestricted) return null;
  const roles = entitlements.roles || {};
  const entry = roles[String(roleKey || '').toLowerCase()];
  return entry && typeof entry === 'object' ? entry : null;
}

/** Bu rol bu modülü (sayfayı) kullanabilir mi? */
export function isModuleAllowed(
  entitlements: Entitlements | null | undefined,
  roleKey: string | null | undefined,
  moduleKey: string,
): boolean {
  const roleEntry = getRoleEntry(entitlements, roleKey);
  if (!roleEntry) return true; // kısıtsız
  const moduleEntry = roleEntry.modules?.[moduleKey];
  // Paket kaydı bu modül eklenmeden önce oluşturulmuş olabilir. Backend de
  // eksik (rol, modül) çiftini "bu paket tarafından sahiplenilmiyor" kabul edip
  // engellemez. Frontend aynı geriye uyumlu davranışı göstermelidir; açıkça
  // kayıtlı ve disabled olan modüller yine kapalı kalır.
  if (!moduleEntry) return true;
  return Boolean(moduleEntry?.enabled);
}

/** Bu rol bu modüldeki bu işlemi yapabilir mi? (modül kapalıysa işlem de kapalı) */
export function isActionAllowed(
  entitlements: Entitlements | null | undefined,
  roleKey: string | null | undefined,
  moduleKey: string,
  actionKey: string,
): boolean {
  const roleEntry = getRoleEntry(entitlements, roleKey);
  if (!roleEntry) return true;
  const moduleEntry = roleEntry.modules?.[moduleKey];
  if (!moduleEntry?.enabled) return false;
  const value = moduleEntry.actions?.[actionKey];
  // Aksiyon açıkça false değilse açık kabul edilir (yeni eklenen aksiyonlar kırılmasın).
  return value !== false;
}
