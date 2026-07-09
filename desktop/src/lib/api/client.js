import { clearDesktopSession, desktopApiBaseUrl, loadDesktopSession } from '../auth';
import { desktopAppEnv } from '../appEnv';

// Owner/admin tarafından seçilen şube filtresi (X-Branch-Filter header'ı).
// null = "Tüm Şubeler" (header gönderilmez). BranchContext bunu set eder.
let activeBranchFilter = (typeof localStorage !== 'undefined' && localStorage.getItem('ci-branch-filter')) || null;
export function setActiveBranchFilter(branchId) {
  activeBranchFilter = branchId || null;
  try {
    if (typeof localStorage !== 'undefined') {
      if (branchId) localStorage.setItem('ci-branch-filter', branchId);
      else localStorage.removeItem('ci-branch-filter');
    }
  } catch { /* yoksa yoksay */ }
}

// Sahip/MEB tarafından seçilen aktif kurum bağlamı (X-Tenant-Context header'ı).
// null = ev kurumu (header gönderilmez). Şubenin bir üst seviyesi; kurum değişince
// şube filtresi SIFIRLANIR (A'nın şubesi B'de geçersiz). Yetkisiz değer backend'de 403.
let activeTenantContext = (typeof localStorage !== 'undefined' && localStorage.getItem('ci-tenant-context')) || null;
export function getActiveTenantContext() {
  return activeTenantContext;
}
export function setActiveTenantContext(tenantId) {
  activeTenantContext = tenantId || null;
  try {
    if (typeof localStorage !== 'undefined') {
      if (tenantId) localStorage.setItem('ci-tenant-context', tenantId);
      else localStorage.removeItem('ci-tenant-context');
    }
  } catch { /* yoksa yoksay */ }
  // Kurum değişti → şube seçimi artık geçersiz, temizle.
  setActiveBranchFilter(null);
}

// Lazy singleton: Tauri HTTP plugin import'unu ilk kullanımda await eder
let _tauriFetchPromise = null;
async function getTauriFetch() {
  if (typeof window === 'undefined' || !(window.__TAURI__ || window.__TAURI_INTERNALS__)) return null;
  if (!_tauriFetchPromise) {
    _tauriFetchPromise = import('@tauri-apps/plugin-http')
      .then((mod) => mod.fetch)
      .catch(() => null);
  }
  return _tauriFetchPromise;
}

async function apiFetch(url, options = {}) {
  const hasFormDataBody = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const tauriFetch = hasFormDataBody ? null : await getTauriFetch();
  const fetchFn = tauriFetch || window.fetch;
  return fetchFn(url, options);
}

async function request(method, url, data, config = {}) {
  const session = loadDesktopSession();
  const fullUrl = new URL(url, desktopApiBaseUrl);

  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        fullUrl.searchParams.set(key, String(value));
      }
    });
  }

  const headers = { ...(config.headers || {}) };
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }
  // Kurum bağlamı: sahip/MEB drill-down yaptığında gönderilir; backend grant'a göre
  // doğrular (yetkisizse 403). Şubeden önce, çünkü şube bu kurumun içinde çözülür.
  if (activeTenantContext && !headers['X-Tenant-Context']) {
    headers['X-Tenant-Context'] = activeTenantContext;
  }
  // Şube filtresi: yalnızca owner/admin seçtiğinde gönderilir; backend yetkiye
  // göre dikkate alır (scoped kullanıcılarda yok sayılır).
  if (activeBranchFilter && !headers['X-Branch-Filter']) {
    headers['X-Branch-Filter'] = activeBranchFilter;
  }

  const isFormData = data instanceof FormData;
  if (isFormData) {
    delete headers['Content-Type'];
  }
  if (!isFormData && data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions = {
    method,
    headers,
  };

  if (data !== undefined && method !== 'GET') {
    fetchOptions.body = isFormData ? data : JSON.stringify(data);
  }

  const response = await apiFetch(fullUrl.toString(), fetchOptions);

  if (response.status === 401) {
    clearDesktopSession();
    if (typeof window !== 'undefined') {
      const isDesktopLike = window.location.protocol === 'file:' || window.__TAURI__;
      const loginPath = isDesktopLike ? '#/login' : '/login';
      const currentPath = isDesktopLike
        ? `${window.location.hash || ''}`
        : window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '#/login') {
        window.location.assign(loginPath);
      }
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

export default { request };

export const api = {
  get: (url, config) => request('GET', url, undefined, config),
  post: (url, data, config) => request('POST', url, data, config),
  put: (url, data, config) => request('PUT', url, data, config),
  patch: (url, data, config) => request('PATCH', url, data, config),
  delete: (url, config) => request('DELETE', url, undefined, config),
};
