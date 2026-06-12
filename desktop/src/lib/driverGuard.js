import { fetchServiceDriverSelf } from './api/modules';

// Şoför kontrolü kullanıcı başına bir kez yapılır; DashboardLayout her
// gezinmede çağırdığı için sonuç oturum boyunca önbelleğe alınır.
let cache = { key: null, value: false };

export async function checkIsServiceDriver(user) {
  const role = String(user?.role || '').toLowerCase();
  // Şoförler personel kaydında Administrative rolüyle açılır; diğer roller
  // (Admin dahil) kendi panellerini korur.
  if (role !== 'administrative') return false;

  const key = String(user?.username || user?.email || user?.name || '');
  if (cache.key === key) return cache.value;

  let value = false;
  try {
    const self = await fetchServiceDriverSelf();
    value = self?.isDriver === true;
  } catch {
    value = false;
  }
  cache = { key, value };
  return value;
}

export function resetDriverGuardCache() {
  cache = { key: null, value: false };
}
