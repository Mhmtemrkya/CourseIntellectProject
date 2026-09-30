import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getUserRoles } from '../lib/permissions';
import { fetchUserPreferences, saveUserPreferences } from '../lib/api/modules';
import { findPageTour, findWelcomeTour, type Tour } from './tours';
import type { DesktopUser } from '../types/session';
import { TourOverlay } from './TourOverlay';

// Onboarding beyni:
//  - İlk girişte role özel karşılama turunu başlatır.
//  - Her sayfa İLK açılışta o sayfanın turunu otomatik gösterir.
//  - "Görüldü" bilgisi kullanıcı bazında localStorage'da tutulur ve
//    sunucudaki kullanıcı tercihlerine senkronlanır (cihaz değişse de hatırlanır).

/** Tur kimliği → görülme zamanı (epoch ms). */
type SeenMap = Record<string, number>;

export interface OnboardingContextValue {
  startPageTour: () => void;
  startWelcomeTour: () => void;
  resetOnboarding: () => void;
  hasPageTour: boolean;
}

function asSeenMap(value: unknown): SeenMap | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  // Yalnız sayısal (zaman damgası) değerler alınır; bozuk kayıt turu çökertmez.
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
}

const OnboardingContext = createContext<OnboardingContextValue>({
  startPageTour: () => {},
  startWelcomeTour: () => {},
  resetOnboarding: () => {},
  hasPageTour: false,
});

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

type SeenOwner = Pick<DesktopUser, 'username' | 'id'> | null;

function storageKey(user: SeenOwner): string {
  return `ci-onboarding:${user?.username || user?.id || 'anon'}`;
}

function readLocalSeen(user: SeenOwner): SeenMap {
  try {
    const raw = localStorage.getItem(storageKey(user));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return asSeenMap(parsed) ?? {};
  } catch {
    return {};
  }
}

function writeLocalSeen(user: SeenOwner, seen: SeenMap): void {
  try {
    localStorage.setItem(storageKey(user), JSON.stringify(seen));
  } catch {
    // localStorage dolu/kapalıysa sessiz geç — tur yine çalışır.
  }
}

export function OnboardingProvider({ children }: { children?: ReactNode }) {
  const { user, isAuthenticated } = useApp();
  const location = useLocation();
  const [seen, setSeen] = useState<SeenMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roles = useMemo(() => getUserRoles(user), [user]);

  // Kullanıcı değişince görülen turları yükle: önce local, sonra sunucu birleşimi.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSeen({});
      setHydrated(false);
      setActiveTour(null);
      return undefined;
    }
    const local = readLocalSeen(user);
    setSeen(local);
    setHydrated(true);
    let cancelled = false;
    fetchUserPreferences()
      .then((prefs) => {
        if (cancelled) return;
        const remote = asSeenMap(prefs?.onboardingSeen);
        if (remote) {
          setSeen((prev) => {
            const merged = { ...remote, ...prev };
            writeLocalSeen(user, merged);
            return merged;
          });
        }
      })
      .catch(() => {
        // Tercih servisi erişilemezse local yeterli.
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Görüldü bilgisini kalıcılaştır: local anında, sunucu gecikmeli (debounce).
  const persistSeen = useCallback((next: SeenMap) => {
    writeLocalSeen(user, next);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const prefs = await fetchUserPreferences();
        await saveUserPreferences({
          ...(prefs && typeof prefs === 'object' ? prefs : {}),
          onboardingSeen: { ...(asSeenMap(prefs?.onboardingSeen) || {}), ...next },
        });
      } catch {
        // Sunucu senkronu opsiyonel; local kayıt yeterli.
      }
    }, 1200);
  }, [user]);

  const markSeen = useCallback((tourId: string) => {
    setSeen((prev) => {
      if (prev[tourId]) return prev;
      const next = { ...prev, [tourId]: Date.now() };
      persistSeen(next);
      return next;
    });
  }, [persistSeen]);

  const startTour = useCallback((tour: Tour | null | undefined) => {
    if (!tour || !Array.isArray(tour.steps) || tour.steps.length === 0) return;
    setActiveTour(tour);
    setStepIndex(0);
  }, []);

  const closeTour = useCallback(() => {
    if (activeTour) markSeen(activeTour.id);
    setActiveTour(null);
    setStepIndex(0);
  }, [activeTour, markSeen]);

  const pageTour = useMemo(() => findPageTour(location.pathname, roles), [location.pathname, roles]);
  const welcomeTour = useMemo(() => (roles.length ? findWelcomeTour(roles) : null), [roles]);

  // Otomatik başlatma: sayfa render olduktan sonra kısa gecikmeyle.
  // Öncelik karşılama turunda; o görüldüyse sayfa turu.
  useEffect(() => {
    if (!isAuthenticated || !hydrated || activeTour) return undefined;
    const candidate = (welcomeTour && !seen[welcomeTour.id])
      ? welcomeTour
      : (pageTour && !seen[pageTour.id] ? pageTour : null);
    if (!candidate) return undefined;
    autoStartTimer.current = setTimeout(() => startTour(candidate), 900);
    return () => clearTimeout(autoStartTimer.current);
    // seen bilinçli olarak bağımlılık: tur bitince sonraki adayı değerlendirir.
  }, [isAuthenticated, hydrated, activeTour, welcomeTour, pageTour, seen, startTour, location.pathname]);

  // Rota değişince açık turu kapat (hedefler artık ekranda değil).
  useEffect(() => {
    setActiveTour((current) => {
      if (current && current.id.startsWith('page:') && !current.id.endsWith(`:${location.pathname}`)) {
        return null;
      }
      return current;
    });
  }, [location.pathname]);

  const value = useMemo<OnboardingContextValue>(() => ({
    hasPageTour: Boolean(pageTour),
    startPageTour: () => {
      if (pageTour) startTour(pageTour);
      else if (welcomeTour) startTour(welcomeTour);
    },
    startWelcomeTour: () => { if (welcomeTour) startTour(welcomeTour); },
    resetOnboarding: () => {
      setSeen({});
      writeLocalSeen(user, {});
      persistSeen({});
    },
  }), [pageTour, welcomeTour, startTour, user, persistSeen]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {activeTour ? (
        <TourOverlay
          tour={activeTour}
          stepIndex={stepIndex}
          onStepChange={setStepIndex}
          onClose={closeTour}
        />
      ) : null}
    </OnboardingContext.Provider>
  );
}
