import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchSystemStatus } from '../../lib/api/modules';
import MaintenancePage from '../../pages/MaintenancePage';

const POLL_MS = 30_000; // 30 saniyede bir status çek
const RETRY_BACKOFF_MS = 5_000;

/**
 * Tüm uygulamayı sarar. Bakım modu açıkken:
 * - Platform admin (Developer + tenantId yok) normal erişimine devam eder.
 * - Diğer roller (kurum yöneticisi, idari, öğretmen, veli, öğrenci) MaintenancePage görür.
 * - Mevcut oturumlar engellenmez (logout zorunlu değil) ama UI kilitli kalır.
 */
export function MaintenanceGate({ children }) {
  const { user, logout } = useApp();
  const [status, setStatus] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSystemStatus();
      setStatus(next);
    } catch {
      // Backend ulaşılamıyorsa sessiz geç — cache'lenen status korunur
    } finally {
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRetry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // İlk fetch tamamlanmadıysa bekle (boş ekran yerine children render et — auth zaten loading veriyor)
  if (!hasFetched) {
    return children;
  }

  const maintenanceActive = Boolean(status?.maintenanceMode);
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);

  // Login olmamış kullanıcılar serbest (login form'una ulaşabilsinler).
  // Backend zaten login sırasında non-admin kullanıcıları reddedecek.
  // Bakım açık + login olmuş kullanıcı + platform admin değil → maintenance ekranı.
  if (maintenanceActive && user && !isPlatformAdmin) {
    return (
      <MaintenancePage
        message={status?.maintenanceMessage}
        since={status?.maintenanceSinceUtc}
        onRetry={handleRetry}
        onLogout={user ? logout : null}
      />
    );
  }

  return children;
}
