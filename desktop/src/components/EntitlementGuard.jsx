import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getUserRoles } from '../lib/permissions';
import { getEntitlements, isModuleAllowed } from '../lib/entitlements';
import { inferModuleKey } from './layout/ModernSidebar';
import { getInstitutionType, isModuleAllowedForInstitution, resetInstitutionTypeCache } from '../lib/institutionType';
import { Button } from './ui/button';

// Bu modüller pakete bakılmaksızın her zaman erişilebilir (ayarlar, profil).
const ALWAYS_ALLOWED = new Set(['', 'profile', 'system']);

// URL'den modül anahtarını çözer; alt yollar için (/students/123 gibi)
// üst segmentlere geri düşerek dener.
function moduleKeyForPath(pathname) {
  const direct = inferModuleKey({ path: pathname });
  if (direct) return direct;
  const segments = pathname.split('/').filter(Boolean);
  while (segments.length > 1) {
    segments.pop();
    const key = inferModuleKey({ path: `/${segments.join('/')}` });
    if (key) return key;
  }
  return '';
}

function LockedScreen({ onBack }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Bu özellik paketinizde bulunmuyor</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Kurumunuzun aboneliği bu sayfayı kapsamıyor. Erişim için kurum yöneticinizle
        veya platform destek ekibiyle iletişime geçin.
      </p>
      <Button variant="outline" onClick={onBack}>Geri Dön</Button>
    </div>
  );
}

/**
 * Route seviyesinde paket yetki koruması.
 *
 * Sidebar gizlemenin ötesinde asıl kilit budur: kullanıcı URL yazarak, dashboard
 * kısayoluyla ya da sayfa içi linkle paketin kapsamadığı bir sayfaya giderse
 * sayfa yerine kilit ekranı görür.
 */
export function EntitlementGuard({ children }) {
  const { user } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [entitlements, setEntitlements] = useState(null);
  const [institutionType, setInstitutionType] = useState(null);

  useEffect(() => {
    let active = true;
    if (user?.isPlatformAdmin) {
      setEntitlements({ unrestricted: true, roles: {} });
      setInstitutionType('Platform');
    } else {
      resetInstitutionTypeCache();
      getEntitlements().then((value) => {
        if (active) setEntitlements(value);
      });
      getInstitutionType().then((value) => {
        if (active) setInstitutionType(value);
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  // Yetkiler yüklenene kadar içerik açılmaz — kilitli sayfanın bir anlığına
  // görünüp veri çekmesini engeller.
  if (entitlements === null || institutionType === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  const routeModuleKey = moduleKeyForPath(location.pathname);
  if (!user?.isPlatformAdmin && !isModuleAllowedForInstitution(routeModuleKey, institutionType, location.pathname)) {
    return <LockedScreen onBack={() => navigate(getUserRoles(user).includes('admin') ? '/dashboard' : -1)} />;
  }

  if (!entitlements.unrestricted) {
    const moduleKey = routeModuleKey;
    if (!ALWAYS_ALLOWED.has(moduleKey)) {
      const primaryRole = getUserRoles(user)[0] || 'student';
      if (!isModuleAllowed(entitlements, primaryRole, moduleKey)) {
        return <LockedScreen onBack={() => navigate(-1)} />;
      }
    }
  }

  return children;
}
