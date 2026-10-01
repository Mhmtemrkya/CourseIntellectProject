// Access token yenileme — tek uçuş.
//
// Backend her yenilemede eski refresh token'ı iptal eder (rotasyon). Aynı anda
// iki yenileme giderse ikincisi iptal edilmiş token'la 401 alır ve kullanıcı
// sebepsiz yere çıkış yapar; bu yüzden tüm çağıranlar tek isteği paylaşır.
// Yenilenen oturum, uçuş çözülmeden önce depoya yazılır.

import { getActiveDesktopApiBaseUrl } from './appEnv';
import { authFetch, buildDesktopSession } from './auth';
import { isRecord } from './errors';
import { isLoginPayload } from './loginPayload';
import { clearDesktopSession, loadDesktopSession, persistDesktopSession } from './secureSession';
import type { DesktopSession, LoginPayload } from '../types/session';

/**
 * fresh: geçerli (gerekirse yenilenmiş) oturum var.
 * missing: kayıtlı oturum yok.
 * unauthorized: sunucu reddetti (iptal/süre/pasif/kapalı kurum); oturum silindi.
 * unavailable: ağ yok, hız sınırı ya da sunucu hatası; oturum SİLİNMEDİ.
 */
export type RefreshStatus = 'fresh' | 'missing' | 'unauthorized' | 'unavailable';

export interface RefreshOutcome {
  status: RefreshStatus;
  session: DesktopSession | null;
}

/** Access token bu kadar süre içinde dolacaksa önceden yenilenir. */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;

type RefreshListener = (session: DesktopSession) => void;
const listeners = new Set<RefreshListener>();

/** Yenilenen oturumu dinler (AppContext kullanıcı bilgisini günceller). */
export function onSessionRefreshed(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

interface RefreshDeps {
  now: () => number;
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  baseUrl: () => string;
}

const defaultDeps: RefreshDeps = {
  now: () => Date.now(),
  fetchFn: authFetch,
  baseUrl: getActiveDesktopApiBaseUrl,
};

let deps: RefreshDeps = defaultDeps;
let inFlight: Promise<RefreshOutcome> | null = null;

/** Yalnız testler için: saat/ağ/adres bağımlılıklarını değiştirir. */
export function setSessionRefreshDepsForTests(overrides?: Partial<RefreshDeps>): void {
  deps = overrides ? { ...defaultDeps, ...overrides } : defaultDeps;
  inFlight = null;
}

/** "…Z" olmayan ISO tarihleri de UTC sayılır (backend UTC döner). */
export function parseUtcMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return Date.parse(hasZone ? value : `${value}Z`);
}

export function ensureFreshDesktopSession(options: { force?: boolean } = {}): Promise<RefreshOutcome> {
  if (!inFlight) {
    inFlight = run(options.force === true).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function run(force: boolean): Promise<RefreshOutcome> {
  const session = loadDesktopSession();
  if (!session) return { status: 'missing', session: null };

  const now = deps.now();
  const accessExpiry = parseUtcMs(session.expiresAtUtc);
  if (!force && accessExpiry > now + REFRESH_SKEW_MS) {
    return { status: 'fresh', session };
  }
  if (!(parseUtcMs(session.refreshTokenExpiresAtUtc) > now)) {
    clearDesktopSession();
    return { status: 'unauthorized', session: null };
  }

  let response: Response;
  try {
    response = await deps.fetchFn(`${deps.baseUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } catch {
    return { status: 'unavailable', session };
  }

  if (response.status === 401) {
    clearDesktopSession();
    return { status: 'unauthorized', session: null };
  }
  // 429 (girişle ortak hız sınırı) ve 5xx geçicidir; oturum silinmez.
  if (!response.ok) return { status: 'unavailable', session };

  let payload: LoginPayload;
  try {
    const body: unknown = await response.json();
    const data = isRecord(body) && isLoginPayload(body.data) ? body.data : body;
    if (!isLoginPayload(data)) return { status: 'unavailable', session };
    payload = data;
  } catch {
    return { status: 'unavailable', session };
  }

  // Girişteki abonelik kapısı yenilemede de geçerli; yoksa geri yüklenen
  // oturum ödemesi yapılmamış kurumu içeri alırdı.
  if (payload.user?.subscriptionRequired === true && payload.user?.isPlatformAdmin !== true) {
    clearDesktopSession();
    return { status: 'unauthorized', session: null };
  }

  const next = buildDesktopSession(payload);
  persistDesktopSession(next);
  listeners.forEach((listener) => listener(next));
  return { status: 'fresh', session: next };
}
