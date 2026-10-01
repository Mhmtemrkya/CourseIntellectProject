import { api } from './api/client';
import { createDesktopUser } from './auth';
import {
  clearDesktopSession,
  loadDesktopSession,
  persistDesktopSession,
} from './secureSession';
import {
  ensureFreshDesktopSession,
  parseUtcMs,
  setSessionRefreshDepsForTests,
} from './sessionRefresh';
import type { DesktopSession } from '../types/session';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const MIN = 60_000;

function session(accessLeftMs: number, refreshLeftMs = 10 * 24 * 60 * MIN): DesktopSession {
  return {
    accessToken: 'at-old',
    refreshToken: 'rt-old',
    expiresAtUtc: iso(accessLeftMs),
    refreshTokenExpiresAtUtc: iso(refreshLeftMs),
    user: createDesktopUser({ user: { id: 'u1', primaryRole: 'Admin' } }),
  };
}

function loginBody() {
  return {
    accessToken: 'at-new',
    refreshToken: 'rt-new',
    expiresAtUtc: iso(8 * 60 * MIN),
    refreshTokenExpiresAtUtc: iso(14 * 24 * 60 * MIN),
    user: { id: 'u1', username: 'kurum.admin', primaryRole: 'Admin' },
  };
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ensureFreshDesktopSession', () => {
  let fetchFn: jest.Mock<Promise<Response>, [string, RequestInit]>;

  beforeEach(() => {
    localStorage.clear();
    clearDesktopSession();
    fetchFn = jest.fn();
    setSessionRefreshDepsForTests({ now: () => NOW, fetchFn, baseUrl: () => 'https://api.test' });
  });

  afterAll(() => setSessionRefreshDepsForTests());

  it('geçerli token için sunucuya gitmez', async () => {
    persistDesktopSession(session(3 * 60 * MIN));
    const outcome = await ensureFreshDesktopSession();
    expect(outcome.status).toBe('fresh');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('eşzamanlı çağrılar tek yenileme isteğini paylaşır (rotasyon)', async () => {
    persistDesktopSession(session(MIN));
    fetchFn.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse(200, loginBody());
    });

    const outcomes = await Promise.all([
      ensureFreshDesktopSession(),
      ensureFreshDesktopSession(),
      ensureFreshDesktopSession(),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.test/api/auth/refresh',
      expect.objectContaining({ body: JSON.stringify({ refreshToken: 'rt-old' }) }),
    );
    expect(outcomes.every((o) => o.session?.accessToken === 'at-new')).toBe(true);
    expect(loadDesktopSession()?.refreshToken).toBe('rt-new');
  });

  it('sunucu 401 dönerse oturumu siler', async () => {
    persistDesktopSession(session(0));
    fetchFn.mockResolvedValue(jsonResponse(401));
    const outcome = await ensureFreshDesktopSession();
    expect(outcome.status).toBe('unauthorized');
    expect(loadDesktopSession()).toBeNull();
  });

  it.each([429, 500, 503])('sunucu %i dönerse oturumu korur', async (status) => {
    persistDesktopSession(session(0));
    fetchFn.mockResolvedValue(jsonResponse(status));
    const outcome = await ensureFreshDesktopSession();
    expect(outcome.status).toBe('unavailable');
    expect(loadDesktopSession()?.refreshToken).toBe('rt-old');
  });

  it('ağ hatasında oturumu korur', async () => {
    persistDesktopSession(session(0));
    fetchFn.mockRejectedValue(new TypeError('Failed to fetch'));
    const outcome = await ensureFreshDesktopSession();
    expect(outcome.status).toBe('unavailable');
    expect(loadDesktopSession()).not.toBeNull();
  });

  it('refresh token süresi dolmuşsa istek atmadan oturumu siler', async () => {
    persistDesktopSession(session(0, -MIN));
    const outcome = await ensureFreshDesktopSession();
    expect(outcome.status).toBe('unauthorized');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(loadDesktopSession()).toBeNull();
  });

  it('abonelik kapısı yenilemede de uygulanır', async () => {
    persistDesktopSession(session(0));
    fetchFn.mockResolvedValue(jsonResponse(200, {
      ...loginBody(),
      user: { ...loginBody().user, subscriptionRequired: true },
    }));
    const outcome = await ensureFreshDesktopSession();
    expect(outcome.status).toBe('unauthorized');
    expect(loadDesktopSession()).toBeNull();
  });

  it('saat dilimi olmayan tarihi UTC sayar', () => {
    expect(parseUtcMs('2026-10-01T12:00:00')).toBe(NOW);
    expect(parseUtcMs('2026-10-01T12:00:00Z')).toBe(NOW);
  });
});

describe('API istemcisi 401 sonrası', () => {
  let refreshFetch: jest.Mock<Promise<Response>, [string, RequestInit]>;

  beforeEach(() => {
    localStorage.clear();
    clearDesktopSession();
    refreshFetch = jest.fn();
    setSessionRefreshDepsForTests({ now: () => NOW, fetchFn: refreshFetch, baseUrl: () => 'https://api.test' });
    persistDesktopSession(session(3 * 60 * MIN));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => setSessionRefreshDepsForTests());

  it('bir kez yenileyip isteği yeni token ile tekrarlar', async () => {
    const seen: string[] = [];
    jest.spyOn(window, 'fetch').mockImplementation(async (_url, init) => {
      const auth = new Headers(init?.headers).get('Authorization') ?? '';
      seen.push(auth);
      return auth === 'Bearer at-new' ? jsonResponse(200, { ok: true }) : jsonResponse(401);
    });
    refreshFetch.mockResolvedValue(jsonResponse(200, loginBody()));

    await expect(api.get('/api/students')).resolves.toEqual({ ok: true });
    expect(seen).toEqual(['Bearer at-old', 'Bearer at-new']);
    expect(refreshFetch).toHaveBeenCalledTimes(1);
  });

  it('yenileme de reddedilirse oturumu siler', async () => {
    jest.spyOn(window, 'fetch').mockImplementation(async () => jsonResponse(401));
    refreshFetch.mockResolvedValue(jsonResponse(401));

    await expect(api.get('/api/students')).rejects.toThrow('Oturumunuz sona erdi');
    expect(loadDesktopSession()).toBeNull();
  });

  it('yenileme sunucuya ulaşamazsa oturumu korur', async () => {
    jest.spyOn(window, 'fetch').mockImplementation(async () => jsonResponse(401));
    refreshFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.get('/api/students')).rejects.toThrow('Oturum yenilenemedi');
    expect(loadDesktopSession()).not.toBeNull();
  });
});
