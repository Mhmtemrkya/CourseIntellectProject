import { fetchMyEntitlements } from './api/modules';

/**
 * Kurum paket yetkileri (entitlements) — oturum boyunca önbelleğe alınır.
 *
 * Backend, kurumun atandığı paketin rol → modül → aksiyon tanımını döner.
 * Kayıt yoksa veya API okunamazsa güvenli varsayılan "tümü açık"tır
 * (unrestricted), böylece paket tanımlanmamış kurumlar kilitlenmez.
 */
let cached = null;
let pending = null;

const UNRESTRICTED = { unrestricted: true, roles: {} };

export async function getEntitlements() {
  if (cached) return cached;
  if (!pending) {
    pending = fetchMyEntitlements()
      .then((payload) => {
        if (!payload || payload.unrestricted || !payload.roles) return UNRESTRICTED;
        return { unrestricted: false, roles: payload.roles };
      })
      .catch(() => UNRESTRICTED);
  }
  cached = await pending;
  return cached;
}

export function resetEntitlementCache() {
  cached = null;
  pending = null;
}

/** Rolün tanımı paket içinde var mı? Yoksa o rol kısıtsız kabul edilir. */
function getRoleEntry(entitlements, roleKey) {
  if (!entitlements || entitlements.unrestricted) return null;
  const roles = entitlements.roles || {};
  const entry = roles[String(roleKey || '').toLowerCase()];
  return entry && typeof entry === 'object' ? entry : null;
}

/** Bu rol bu modülü (sayfayı) kullanabilir mi? */
export function isModuleAllowed(entitlements, roleKey, moduleKey) {
  const roleEntry = getRoleEntry(entitlements, roleKey);
  if (!roleEntry) return true; // kısıtsız
  const moduleEntry = roleEntry.modules?.[moduleKey];
  return Boolean(moduleEntry?.enabled);
}

/** Bu rol bu modüldeki bu işlemi yapabilir mi? (modül kapalıysa işlem de kapalı) */
export function isActionAllowed(entitlements, roleKey, moduleKey, actionKey) {
  const roleEntry = getRoleEntry(entitlements, roleKey);
  if (!roleEntry) return true;
  const moduleEntry = roleEntry.modules?.[moduleKey];
  if (!moduleEntry?.enabled) return false;
  const value = moduleEntry.actions?.[actionKey];
  // Aksiyon açıkça false değilse açık kabul edilir (yeni eklenen aksiyonlar kırılmasın).
  return value !== false;
}
