import { clearDesktopSession, desktopApiBaseUrl, loadDesktopSession } from '../auth';
import {
  desktopAppEnv,
  getOrderedDesktopApiCandidates,
  setActiveDesktopApiBaseUrl,
} from '../appEnv';

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

/**
 * Hata gövdesinden okunabilir bir mesaj çıkarır. Uçlarımız `{ message }` döner,
 * ama ASP.NET'in kendi model doğrulaması ValidationProblemDetails üretir
 * (`{ title, errors: { Alan: ["..."] } }`) — orada `message` olmadığı için
 * kullanıcı "Request failed (400)" görüyordu. Alan adlarıyla birlikte
 * özetliyoruz ki hatanın nerede olduğu belli olsun.
 */
const TECHNICAL_ERROR_PATTERN = /request failed|internal server error|http error|status code|sunucu hatası\s*\(\d+\)|işlem başarısız\s*\(\d+\)/i;

function operationLabel(method) {
  switch (String(method || '').toUpperCase()) {
    case 'GET': return 'Bilgiler alınırken';
    case 'POST': return 'Kayıt işlemi sırasında';
    case 'PUT':
    case 'PATCH': return 'Güncelleme sırasında';
    case 'DELETE': return 'Silme işlemi sırasında';
    default: return 'İşlem sırasında';
  }
}

function statusGuidance(status) {
  if (status === 400 || status === 422) return 'Formdaki bilgileri ve zorunlu alanları kontrol edip tekrar deneyin.';
  if (status === 401) return 'Oturumunuz sona ermiş olabilir. Yeniden giriş yapıp tekrar deneyin.';
  if (status === 403) return 'Bu işlem için kurum yöneticinizden gerekli yetkiyi isteyin.';
  if (status === 404) return 'Listeyi yenileyip ilgili kaydı yeniden seçin.';
  if (status === 409) return 'Kayıt başka bir işlemle çakışıyor. Güncel bilgileri kontrol edip tekrar deneyin.';
  if (status === 429) return 'Kısa bir süre bekleyip tekrar deneyin.';
  if (status >= 500) return 'Kısa bir süre sonra tekrar deneyin. Sorun devam ederse destek ekibine başvurun.';
  return 'Bilgileri kontrol edip işlemi tekrar deneyin.';
}

export function describeApiError(body, status, method = '') {
  const operation = operationLabel(method);
  const traceId = body?.traceId ? ` Takip kodu: ${body.traceId}.` : '';

  if (status >= 500) {
    return `${operation} beklenmeyen bir sorun oluştu. ${statusGuidance(status)}${traceId}`;
  }

  let detail = body?.message || body?.error?.message || '';
  if (body?.errors && typeof body.errors === 'object') {
    const parts = Object.entries(body.errors)
      .map(([field, messages]) => `${field}: ${[].concat(messages).join(' ')}`)
      .filter(Boolean);
    if (parts.length) detail = parts.join(' • ');
  }
  detail ||= body?.detail || body?.title || '';
  if (!detail || TECHNICAL_ERROR_PATTERN.test(detail)) {
    detail = `${operation} işlem tamamlanamadı.`;
  }

  const action = body?.action || statusGuidance(status);
  const reason = body?.reason ? ` Nedeni: ${body.reason}` : '';
  return `${detail}${reason} Yapmanız gereken: ${action}${traceId}`;
}

async function request(method, url, data, config = {}) {
  const session = loadDesktopSession();
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

  const isAbsoluteUrl = /^https?:\/\//i.test(String(url));
  const candidates = isAbsoluteUrl
    ? [desktopApiBaseUrl]
    : getOrderedDesktopApiCandidates();
  let response = null;
  let lastConnectionError = null;

  for (const baseUrl of candidates) {
    const fullUrl = new URL(url, baseUrl);
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          fullUrl.searchParams.set(key, String(value));
        }
      });
    }

    try {
      response = await apiFetch(
        isAbsoluteUrl ? String(url) : fullUrl.toString(),
        fetchOptions
      );
      if (!isAbsoluteUrl) setActiveDesktopApiBaseUrl(baseUrl);
      break;
    } catch (error) {
      lastConnectionError = error;
    }
  }

  if (!response) {
    const error = new Error('Sunucuya bağlantı kurulamadı. İnternet bağlantınızı kontrol edin, ardından işlemi tekrar deneyin.');
    error.cause = lastConnectionError;
    throw error;
  }

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
    throw new Error('Oturumunuz sona erdi. Lütfen yeniden giriş yapıp işlemi tekrar deneyin.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const error = new Error(describeApiError(errorBody, response.status, method));
    // Gövdeyi taşı: bazı uçlar hatanın yanında makine-okunur ipucu döner
    // (ör. randevu kuralını hangi override koduyla ezebileceğin).
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  if (response.status === 204) return null;

  if (config.responseType === 'blob') return response.blob();

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
