import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getDrivingPermissions, isDrivingPathAllowed } from '../../lib/drivingPermissions';

// Sürücü kursunda tek bir sabit rol ekranına yönlenmek güvenli değildir:
// kurum sahibi, sekreter, muhasebe, filo sorumlusu ve eğitmen farklı sayfalara
// erişebilir. Backend'in verdiği ince taneli izinlerden ilk uygun başlangıç
// sayfasını seçeriz; böylece kullanıcı izinli olmadığı bir ekrana düşmez.
const HOME_CANDIDATES = [
  '/driving/dashboard',
  '/driving/education',
  '/driving/hub',
  '/driving/collection',
  '/driving/operations',
  '/driving/fleet-compliance',
  '/driving/students',
  '/driving/graduation',
  '/driving/reports',
];

export default function DrivingHomeRedirect() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let active = true;
    getDrivingPermissions().then((permissions) => {
      if (!active) return;
      const next = HOME_CANDIDATES.find((path) =>
        isDrivingPathAllowed(path, permissions),
      );
      setTarget(next || '/settings');
    });
    return () => {
      active = false;
    };
  }, []);

  if (!target) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
        Sürücü kursu paneli hazırlanıyor...
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
