// Belge önizleme yardımcıları.
//
// Tauri'nin HTTP eklentisi (@tauri-apps/plugin-http) indirilen yanıtın Content-Type
// başlığını her zaman blob.type'a taşımıyor; tür boş kalınca <iframe>/<img> belgenin
// PDF mi görsel mi olduğunu anlayamıyor ve ekran BOŞ görünüyor (backend `nosniff`
// gönderdiği için WebView içerikten tahmin de edemiyor). Çözüm: dosya adının
// uzantısından doğru MIME'i belirleyip blob'u açık türle yeniden sarmak.

const EXT_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

/** Dosya adı + mevcut blob türünden en güvenilir MIME'i döndürür. */
export function resolveDocumentMime(fileName, blobType) {
  if (blobType && blobType !== 'application/octet-stream') return blobType;
  const ext = (fileName || '').toLowerCase().split('.').pop();
  return EXT_MIME[ext] || blobType || '';
}

/** image | pdf | other — modal hangi görüntüleyiciyi kullanacağını buna göre seçer. */
export function documentKind(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

/**
 * Ham blob'u doğru MIME ile yeniden sarıp bir object URL üretir.
 * Bytes'ı arrayBuffer ile yeniden okuruz — Tauri blob'unun türsüz gelmesi durumunda
 * yeni Blob'a açık tür yazmak WebView'in belgeyi tanıması için şarttır.
 */
export async function createTypedDocumentUrl(rawBlob, fileName) {
  const mime = resolveDocumentMime(fileName, rawBlob?.type || '');
  const typed = mime ? new Blob([await rawBlob.arrayBuffer()], { type: mime }) : rawBlob;
  return { url: URL.createObjectURL(typed), mime, kind: documentKind(mime) };
}
