const env = (process.env.REACT_APP_COURSE_INTELLECT_ENV || 'development').trim().toLowerCase();

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
    return explicit;
  }

  if (desktopAppEnv.isDevelopment) {
    return 'http://127.0.0.1:5206';
  }

  return '';
}
