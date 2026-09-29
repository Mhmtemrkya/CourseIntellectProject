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

export function maskPositiveInteger(value, maxLength = 3) {
  return maskDigits(value, maxLength);
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

export function maskEmail(value) {
  return String(value || '').replace(/\s/g, '').slice(0, 254);
}

export function maskVehicleNumber(value) {
  return String(value || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12);
}

export function maskTrPlate(value) {
  const compact = String(value || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 9);
  const province = compact.slice(0, 2).replace(/\D/g, '');
  if (province.length < 2) return province;

  const remainder = compact.slice(2);
  const letters = (remainder.match(/^[A-Z]{0,3}/)?.[0] || '').slice(0, 3);
  const numbers = remainder.slice(letters.length).replace(/\D/g, '').slice(0, 4);
  return [province, letters, numbers].filter(Boolean).join(' ');
}

export function isValidTcKimlik(value) {
  const digits = maskTcKimlik(value);
  if (digits.length !== 11 || digits.startsWith('0')) return false;
  const d = digits.split('').map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];   // 1, 3, 5, 7, 9. haneler
  const evenSum = d[1] + d[3] + d[5] + d[7];          // 2, 4, 6, 8. haneler
  const tenth = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  if (tenth !== d[9]) return false;
  const eleventh = (oddSum + evenSum + d[9]) % 10;
  return eleventh === d[10];
}

export function isValidTrPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
  return digits.length === 10 && digits.startsWith('5');
}

export function isValidEmail(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidTrPlate(value) {
  return /^\d{2} [A-Z]{1,3} \d{2,4}$/.test(maskTrPlate(value));
}
