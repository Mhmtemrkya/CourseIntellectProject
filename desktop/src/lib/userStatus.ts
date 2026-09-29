function foldStatus(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

export function normalizeUserStatus(value = '') {
  const status = foldStatus(value);
  if (['passive', 'pasif', 'inactive', 'inaktif', 'disabled', 'deactivated', 'false'].includes(status)) {
    return 'passive';
  }
  if (['active', 'aktif', 'enabled', 'true'].includes(status)) {
    return 'active';
  }
  return status || 'active';
}

export function isUserPassive(value = '') {
  return normalizeUserStatus(value) === 'passive';
}

export function userStatusLabel(value = '') {
  return isUserPassive(value) ? 'Pasif' : 'Aktif';
}
