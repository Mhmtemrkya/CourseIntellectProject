import { fetchServiceDriverSelf } from './api/modules';

// Şoför kontrolü kullanıcı başına bir kez yapılır; DashboardLayout her
// gezinmede çağırdığı için sonuç oturum boyunca önbelleğe alınır.
import type { UserLike } from '../types/session';

let cache: { key: string | null; value: boolean } = { key: null, value: false };

export async function checkIsServiceDriver(user: (UserLike & { email?: string }) | null | undefined): Promise<boolean> {
  const role = String(user?.role || '').toLowerCase();
  // Şoförler personel kaydında Administrative rolüyle açılır; diğer roller
  // (Admin dahil) kendi panellerini korur.
  if (role !== 'administrative') return false;

  const key = String(user?.username || user?.email || user?.name || '');
  if (cache.key === key) return cache.value;

  let value = false;
  try {
    const self: { isDriver?: boolean } | null | undefined = await fetchServiceDriverSelf();
    value = self?.isDriver === true;
  } catch {
    value = false;
  }
  cache = { key, value };
  return value;
}

export function resetDriverGuardCache(): void {
  cache = { key: null, value: false };
}
