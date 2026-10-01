import { createDesktopUser } from './auth';
import type { DesktopSession } from '../types/session';

type Store = typeof import('./secureSession');

const SAVED: DesktopSession = {
  accessToken: 'at',
  refreshToken: 'rt',
  expiresAtUtc: '2099-01-01T00:00:00Z',
  refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
  user: createDesktopUser({ user: { id: 'u1', primaryRole: 'Admin' } }),
};

/** Uygulamanın yeniden açılışı: modül durumu sıfırdan yüklenir. */
async function launch(): Promise<Store> {
  let store!: Store;
  jest.isolateModules(() => {
    store = jest.requireActual<Store>('./secureSession');
  });
  await store.initDesktopSessionStore();
  return store;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('courseintellect-desktop-session', JSON.stringify(SAVED));
});

it('"hatırla" kapalıyken uygulama yeniden açılınca oturum düşer', async () => {
  localStorage.setItem('ci-remember-session', '0');
  const store = await launch();
  expect(store.loadDesktopSession()).toBeNull();
});

it('"hatırla" kapalıyken sayfa yeniden yüklenince (kurum değişimi) oturum kalır', async () => {
  const first = await launch();
  first.setRememberSession(false, 'kurum.admin');
  // sessionStorage aynı çalıştırmada korunur; yalnız modül yeniden yüklenir.
  const reloaded = await launch();
  expect(reloaded.loadDesktopSession()?.accessToken).toBe('at');
});

it('"hatırla" açıkken oturum ve kullanıcı adı korunur', async () => {
  const first = await launch();
  first.setRememberSession(true, ' kurum.admin ');
  sessionStorage.clear(); // uygulama kapandı
  const relaunched = await launch();
  expect(relaunched.loadDesktopSession()?.accessToken).toBe('at');
  expect(relaunched.getRememberedUsername()).toBe('kurum.admin');
  expect(relaunched.getRememberSession()).toBe(true);
});

it('seçim hiç yapılmamış eski kurulumlarda oturum eskisi gibi geri yüklenir', async () => {
  const store = await launch();
  expect(store.getRememberSession()).toBeNull();
  expect(store.loadDesktopSession()?.accessToken).toBe('at');
});

it('"hatırla" kapatılınca saklanan kullanıcı adı silinir', async () => {
  const store = await launch();
  store.setRememberSession(true, 'kurum.admin');
  store.setRememberSession(false, 'kurum.admin');
  expect(store.getRememberedUsername()).toBe('');
});
