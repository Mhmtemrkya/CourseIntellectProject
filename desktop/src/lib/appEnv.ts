const env = (process.env.REACT_APP_COURSE_INTELLECT_ENV || 'development').trim().toLowerCase();
const PRODUCTION_API_URL = 'https://maydanozasist.schoolasist.com';

export const desktopAppEnv = {
  current: env,
  isDevelopment: env === 'development',
  isStaging: env === 'staging',
  isProduction: env === 'production',
  allowDemoCredentials: env !== 'production',
};

export function getDesktopApiBaseUrl(): string {
  const explicit = process.env.REACT_APP_COURSE_INTELLECT_API_URL?.trim();

  if (explicit) {
    return normalizeApiBaseUrl(explicit);
  }

  return PRODUCTION_API_URL;
}

function normalizeApiBaseUrl(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getDesktopApiCandidates(): string[] {
  return [
    getDesktopApiBaseUrl(),
    PRODUCTION_API_URL,
  ]
    .map(normalizeApiBaseUrl)
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

let activeDesktopApiBaseUrl = getDesktopApiBaseUrl();

export function getActiveDesktopApiBaseUrl(): string {
  return activeDesktopApiBaseUrl;
}

export function setActiveDesktopApiBaseUrl(value: string | null | undefined): string {
  const normalized = normalizeApiBaseUrl(value);
  if (normalized && getDesktopApiCandidates().includes(normalized)) {
    activeDesktopApiBaseUrl = normalized;
  }
  return activeDesktopApiBaseUrl;
}

export function getOrderedDesktopApiCandidates(): string[] {
  const active = getActiveDesktopApiBaseUrl();
  return [active, ...getDesktopApiCandidates()]
    .filter((value, index, values) => value && values.indexOf(value) === index);
}
