import { clearDesktopSession, desktopApiBaseUrl, loadDesktopSession } from '../auth';
import {
  desktopAppEnv,
  getOrderedDesktopApiCandidates,
  setActiveDesktopApiBaseUrl,
} from '../appEnv';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface RequestConfig {
  headers?: Record<string, string>;
  /**
   * Sorgu parametreleri (düz nesne). Değeri null/undefined olanlar URL'e yazılmaz,
   * diğerleri String() ile yazılır. Arayüz tipleri de kabul edilsin diye `object`.
   */
  params?: object | undefined;
  responseType?: 'json' | 'blob';
}

export interface BlobRequestConfig extends RequestConfig {
  responseType: 'blob';
}

/** Başarısız HTTP yanıtı: mesaj kullanıcıya gösterilebilir, gövde makine-okunur ipucu taşır. */
export type ApiError = Error & { status: number; body: unknown };

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'status' in error && typeof error.status === 'number' && 'body' in error;
}

/** Hata gövdesini bilinen alanlarıyla okur (`error.body?.code` gibi). */
export function apiErrorBody(error: unknown): ApiErrorBody | null {
  return isApiError(error) ? toApiErrorBody(error.body) : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Bilinmeyen hata gövdesini yalnız doğrulanmış alanlarla ApiErrorBody'ye çevirir. */
function toApiErrorBody(raw: unknown): ApiErrorBody | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const source: Record<string, unknown> = { ...raw };
  const errors: Record<string, string | string[]> = {};
  const rawErrors = source.errors;
  if (typeof rawErrors === 'object' && rawErrors !== null && !Array.isArray(rawErrors)) {
    for (const [key, value] of Object.entries(rawErrors)) {
      if (typeof value === 'string') errors[key] = value;
      else if (Array.isArray(value)) errors[key] = value.filter((item): item is string => typeof item === 'string');
    }
  }
  const nested = source.error;
  const nestedMessage = typeof nested === 'object' && nested !== null && 'message' in nested ? optionalString(nested.message) : undefined;
  return {
    message: optionalString(source.message),
    code: optionalString(source.code),
    error: nestedMessage === undefined ? null : { message: nestedMessage },
    errors: Object.keys(errors).length > 0 ? errors : null,
    detail: optionalString(source.detail),
    title: optionalString(source.title),
    action: optionalString(source.action),
    reason: optionalString(source.reason),
    traceId: optionalString(source.traceId),
  };
}

/** Uçlarımızın ve ASP.NET ProblemDetails'in ortak hata gövdesi alanları. */
export interface ApiErrorBody {
  message?: string;
  code?: string;
  error?: { message?: string } | null;
  errors?: Record<string, string | string[]> | null;
  detail?: string;
  title?: string;
  action?: string;
  reason?: string;
  traceId?: string;
}

// Owner/admin tarafından seçilen şube filtresi (X-Branch-Filter header'ı).
// null = "Tüm Şubeler" (header gönderilmez). BranchContext bunu set eder.
let activeBranchFilter: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('ci-branch-filter')) || null;
export function setActiveBranchFilter(branchId: string | null | undefined): void {
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
let activeTenantContext: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('ci-tenant-context')) || null;
export function getActiveTenantContext(): string | null {
  return activeTenantContext;
}
export function setActiveTenantContext(tenantId: string | null | undefined): void {
  activeTenantContext = tenantId || null;
  try {
    if (typeof localStorage !== 'undefined') {
      if (tenantId) localStorage.setItem('ci-tenant-context', tenantId);
      else localStorage.removeItem('ci-tenant-context');
    }
  } catch { /* yoksa yoksay */ }
  // Kurum değişti → şube seçimi artık geçersiz, temizle.
  setActiveBranchFilter(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ci:tenant-context-changed', {
      detail: { tenantId: activeTenantContext },
    }));
  }
}

// Lazy singleton: Tauri HTTP plugin import'unu ilk kullanımda await eder
type FetchFn = typeof fetch;
let _tauriFetchPromise: Promise<FetchFn | null> | null = null;
async function getTauriFetch(): Promise<FetchFn | null> {
  if (typeof window === 'undefined' || !(window.__TAURI__ || window.__TAURI_INTERNALS__)) return null;
  if (!_tauriFetchPromise) {
    _tauriFetchPromise = import('@tauri-apps/plugin-http')
      .then((mod): FetchFn => mod.fetch)
      .catch(() => null);
  }
  return _tauriFetchPromise;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
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

function operationLabel(method: string): string {
  switch (String(method || '').toUpperCase()) {
    case 'GET': return 'Bilgiler alınırken';
    case 'POST': return 'Kayıt işlemi sırasında';
    case 'PUT':
    case 'PATCH': return 'Güncelleme sırasında';
    case 'DELETE': return 'Silme işlemi sırasında';
    default: return 'İşlem sırasında';
  }
}

function statusGuidance(status: number): string {
  if (status === 400 || status === 422) return 'Formdaki bilgileri ve zorunlu alanları kontrol edip tekrar deneyin.';
  if (status === 401) return 'Oturumunuz sona ermiş olabilir. Yeniden giriş yapıp tekrar deneyin.';
  if (status === 403) return 'Bu işlem için kurum yöneticinizden gerekli yetkiyi isteyin.';
  if (status === 404) return 'Listeyi yenileyip ilgili kaydı yeniden seçin.';
  if (status === 409) return 'Kayıt başka bir işlemle çakışıyor. Güncel bilgileri kontrol edip tekrar deneyin.';
  if (status === 429) return 'Kısa bir süre bekleyip tekrar deneyin.';
  if (status >= 500) return 'Kısa bir süre sonra tekrar deneyin. Sorun devam ederse destek ekibine başvurun.';
  return 'Bilgileri kontrol edip işlemi tekrar deneyin.';
}

export function describeApiError(rawBody: unknown, status: number, method = ''): string {
  const body = toApiErrorBody(rawBody);
  const operation = operationLabel(method);
  const traceId = body?.traceId ? ` Takip kodu: ${body.traceId}.` : '';

  if (status >= 500) {
    return `${operation} beklenmeyen bir sorun oluştu. ${statusGuidance(status)}${traceId}`;
  }

  let detail = body?.message || body?.error?.message || '';
  if (body?.errors && typeof body.errors === 'object') {
    const parts = Object.entries(body.errors)
      .map(([field, messages]) => `${field}: ${(Array.isArray(messages) ? messages : [messages]).join(' ')}`)
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

// Ağ sınırı: gövde tipine burada güvenilir (backend sözleşmesi); tek tip dönüşümü buradadır.
async function request(method: HttpMethod, url: string, data: unknown, config: BlobRequestConfig): Promise<Blob | null>;
async function request<T = unknown>(method: HttpMethod, url: string, data?: unknown, config?: RequestConfig): Promise<T | null>;
async function request<T = unknown>(method: HttpMethod, url: string, data: unknown, config: RequestConfig = {}): Promise<T | Blob | null> {
  const session = loadDesktopSession();
  const headers: Record<string, string> = { ...(config.headers || {}) };
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

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (data !== undefined && method !== 'GET') {
    fetchOptions.body = data instanceof FormData ? data : JSON.stringify(data);
  }

  const isAbsoluteUrl = /^https?:\/\//i.test(String(url));
  const candidates = isAbsoluteUrl
    ? [desktopApiBaseUrl]
    : getOrderedDesktopApiCandidates();
  let response: Response | null = null;
  let lastConnectionError: unknown = null;

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
    throw Object.assign(
      new Error('Sunucuya bağlantı kurulamadı. İnternet bağlantınızı kontrol edin, ardından işlemi tekrar deneyin.'),
      { cause: lastConnectionError },
    );
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
    const errorBody: unknown = await response.json().catch(() => null);
    // Gövdeyi taşı: bazı uçlar hatanın yanında makine-okunur ipucu döner
    // (ör. randevu kuralını hangi override koduyla ezebileceğin).
    const error: ApiError = Object.assign(new Error(describeApiError(errorBody, response.status, method)), {
      status: response.status,
      body: errorBody,
    });
    throw error;
  }

  if (response.status === 204) return null;

  if (config.responseType === 'blob') return response.blob();

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    // Tek güven sınırı: sunucu JSON'u, backend C# sözleşmesinden üretilen DTO
    // tipine (types/api/generated.ts) bağlanır. Çalışma zamanı şema doğrulaması
    // yoktur; ts:gate bu satırı işaretli istisna olarak sayar.
    return (await response.json()) as T; // ts-gate:trust-boundary
  }
  return null;
}

export default { request };

export const api = {
  get: getRequest,
  post: postRequest,
  put: putRequest,
  patch: patchRequest,
  delete: deleteRequest,
};

function getRequest(url: string, config: BlobRequestConfig): Promise<Blob | null>;
function getRequest<T = unknown>(url: string, config?: RequestConfig): Promise<T | null>;
function getRequest<T = unknown>(url: string, config?: RequestConfig): Promise<T | Blob | null> {
  return request<T>('GET', url, undefined, config);
}

function postRequest(url: string, data: unknown, config: BlobRequestConfig): Promise<Blob | null>;
function postRequest<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T | null>;
function postRequest<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T | Blob | null> {
  return request<T>('POST', url, data, config);
}

function putRequest<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T | null> {
  return request<T>('PUT', url, data, config);
}

function patchRequest<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T | null> {
  return request<T>('PATCH', url, data, config);
}

function deleteRequest<T = unknown>(url: string, config?: RequestConfig): Promise<T | null> {
  return request<T>('DELETE', url, undefined, config);
}
