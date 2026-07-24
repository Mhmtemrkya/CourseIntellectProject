const env = (process.env.REACT_APP_COURSE_INTELLECT_ENV || 'development').trim().toLowerCase();
const PRODUCTION_API_URL = 'https://api.courseintellect.com';
const SCHOOLASIST_API_FALLBACK_URL = 'https://maydanozasist.schoolasist.com';

export const desktopAppEnv = {
  current: env,
  isDevelopment: env === 'development',
  isStaging: env === 'staging',
  isProduction: env === 'production',
  allowDemoCredentials: env !== 'production',
};

export function getDesktopApiBaseUrl() {
  const explicit = process.env.REACT_APP_COURSE_INTELLECT_API_URL?.trim();

  if (explicit) {
    return normalizeApiBaseUrl(explicit);
  }

  return PRODUCTION_API_URL;
}

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getDesktopApiCandidates() {
  return [
    getDesktopApiBaseUrl(),
    PRODUCTION_API_URL,
    SCHOOLASIST_API_FALLBACK_URL,
  ]
    .map(normalizeApiBaseUrl)
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

let activeDesktopApiBaseUrl = getDesktopApiBaseUrl();

export function getActiveDesktopApiBaseUrl() {
  return activeDesktopApiBaseUrl;
}

export function setActiveDesktopApiBaseUrl(value) {
  const normalized = normalizeApiBaseUrl(value);
  if (normalized && getDesktopApiCandidates().includes(normalized)) {
    activeDesktopApiBaseUrl = normalized;
  }
  return activeDesktopApiBaseUrl;
}

export function getOrderedDesktopApiCandidates() {
  const active = getActiveDesktopApiBaseUrl();
  return [active, ...getDesktopApiCandidates()]
    .filter((value, index, values) => value && values.indexOf(value) === index);
}
