// Kayıt formlarında ortak input kalıpları.
// TC kimlik: yalnızca rakam, en fazla 11 hane.
// Telefon: +90 5xx xxx xx xx biçiminde maskelenir (10 hane).

export function maskTcKimlik(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

export function maskDigits(value, maxLength) {
  const digits = String(value || '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

export function maskTrPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return '';
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ].filter(Boolean);
  return `+90 ${parts.join(' ')}`;
}

export function isValidTcKimlik(value) {
  const digits = maskTcKimlik(value);
  return digits.length === 11 && !digits.startsWith('0');
}

export function isValidTrPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
  return digits.length === 10 && digits.startsWith('5');
}
