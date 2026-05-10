// Tek-doğru-kaynak: kullanıcı erişimi normalize edici + dynamic sidebar/route helper'ları.
//
// Backend birden fazla isim altında rol/yetki bilgisi dönebilir:
//  - user.role          → desktop-mapped key ("student", "teacher", "admin", ...)
//  - user.backendRole   → API'nin döndüğü PrimaryRole adı
//  - user.extraRoles    → string[] (örn ["Teacher", "Parent"]) — admin tarafından atanan ek roller
//  - user.permissions   → (opsiyonel, gelecekteki feature) string[]
//  - user.features      → (opsiyonel) feature flag listesi
//  - user.modules       → (opsiyonel) modül anahtarları
//
// Bu modül tüm bu varyasyonları **lower-case** bir Set'e indirger ve
// menü/route component'lerinin tek pencereden bakmasını sağlar.

const TURKISH_MAP = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c' };

function normalizeRoleKey(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[ğüşıöç]/g, (ch) => TURKISH_MAP[ch] || ch)
    .trim();
}

// Backend rol adlarını desktop menü key'lerine eşler.
// Aynı backend rolü için birden fazla alias kabul edilir.
const ROLE_ALIASES = {
  admin: 'admin',
  yonetici: 'admin',
  developer: 'superadmin',
  superadmin: 'superadmin',
  platformadmin: 'superadmin',
  teacher: 'teacher',
  ogretmen: 'teacher',
  student: 'student',
  ogrenci: 'student',
  parent: 'parent',
  veli: 'parent',
  accounting: 'finance',
  accountant: 'finance',
  muhasebe: 'finance',
  muhasebeci: 'finance',
  finance: 'finance',
  administrative: 'administrative',
  idari: 'administrative',
  idaripersonel: 'administrative',
};

export function aliasRole(value) {
  const normalized = normalizeRoleKey(value).replace(/[\s_-]/g, '');
  return ROLE_ALIASES[normalized] || normalized;
}

/**
 * Kullanıcının sahip olduğu tüm rol anahtarlarını döner — primary + extraRoles birleştirilir,
 * desktop menü key'lerine alias edilir, dedupe edilir.
 */
export function getUserRoles(user) {
  if (!user) return [];
  const collected = new Set();
  // Desktop'a önceden mapped primary key
  if (user.role) collected.add(aliasRole(user.role));
  // Backend orijinal primary
  if (user.backendRole) collected.add(aliasRole(user.backendRole));
  // Admin tarafından atanan ek roller
  const extras = Array.isArray(user.extraRoles) ? user.extraRoles : [];
  for (const extra of extras) collected.add(aliasRole(extra));
  // Platform admin bayrağı superadmin'e map edilir
  if (user.isPlatformAdmin) collected.add('superadmin');
  return Array.from(collected).filter(Boolean);
}

export function getUserPermissions(user) {
  if (!user) return [];
  const list = Array.isArray(user.permissions) ? user.permissions : [];
  return list.map((p) => String(p).toLowerCase());
}

export function getUserFeatures(user) {
  if (!user) return [];
  const collected = new Set();
  const features = Array.isArray(user.features) ? user.features : [];
  features.forEach((f) => collected.add(String(f).toLowerCase()));
  const modules = Array.isArray(user.modules) ? user.modules : [];
  modules.forEach((m) => collected.add(String(m).toLowerCase()));
  return Array.from(collected);
}

/**
 * Bir nav item / route konfigine göre kullanıcı erişebilir mi?
 *
 * item shape (her alan opsiyonel):
 *   { allowedRoles?: string[], requiredPermissions?: string[], requiredFeatures?: string[] }
 *
 * Erişim kuralı (any-of, OR):
 *   - eğer allowedRoles tanımlı ve kullanıcı bunlardan birine sahipse → ✅
 *   - eğer requiredPermissions tanımlı ve kullanıcı bunlardan birine sahipse → ✅
 *   - eğer requiredFeatures tanımlı ve kullanıcı bunlardan birine sahipse → ✅
 *   - hiçbir kısıt tanımlı değilse → ✅ (public item)
 */
export function canAccessNavItem(user, item) {
  if (!item) return false;
  const rolesNeeded = (item.allowedRoles || []).map(aliasRole).filter(Boolean);
  const permsNeeded = (item.requiredPermissions || []).map((p) => String(p).toLowerCase());
  const featsNeeded = (item.requiredFeatures || []).map((f) => String(f).toLowerCase());

  if (rolesNeeded.length === 0 && permsNeeded.length === 0 && featsNeeded.length === 0) {
    return true;
  }

  const userRoles = new Set(getUserRoles(user));
  if (rolesNeeded.some((role) => userRoles.has(role))) return true;

  const userPerms = new Set(getUserPermissions(user));
  if (permsNeeded.some((p) => userPerms.has(p))) return true;

  const userFeats = new Set(getUserFeatures(user));
  if (featsNeeded.some((f) => userFeats.has(f))) return true;

  return false;
}

/**
 * `menuConfigs` shape'i: { roleKey: NavItem[] }
 * Kullanıcının sahip olduğu tüm rol anahtarlarındaki item'ları birleştirir,
 * `path` bazında dedupe eder (aynı path birden çok rolde varsa ilk kazanır).
 *
 * Bu yaklaşım mevcut menuConfigs yapısını korur: ek rol verildiğinde
 * o rolün tüm menü item'ları sidebar'a otomatik eklenir.
 */
export function mergeMenuItemsForRoles(menuConfigs, roles) {
  if (!menuConfigs) return [];
  const seenPaths = new Set();
  const merged = [];
  for (const role of roles || []) {
    const items = Array.isArray(menuConfigs[role]) ? menuConfigs[role] : [];
    for (const item of items) {
      const key = item.path || item.id || item.label;
      if (!key || seenPaths.has(key)) continue;
      seenPaths.add(key);
      merged.push({ ...item, sourceRole: item.sourceRole || role });
    }
  }
  return merged;
}

/**
 * Geleceğe dönük: registry shape'inde tek bir item listesi varsa,
 * her item'ın allowedRoles/requiredPermissions/requiredFeatures alanlarına
 * göre filtreler.
 */
export function getVisibleNavItems(user, registry) {
  if (!Array.isArray(registry)) return [];
  return registry.filter((item) => canAccessNavItem(user, item));
}
