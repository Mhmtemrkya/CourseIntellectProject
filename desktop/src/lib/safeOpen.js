// Kullanıcı/API verisinden gelen linkler yalnız http(s) şemasıyla açılır —
// javascript:, file:, özel şema gibi vektörler burada kesilir.
export function isHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function openHttpUrl(value) {
  if (!isHttpUrl(value)) return false;
  window.open(value, '_blank', 'noopener,noreferrer');
  return true;
}
