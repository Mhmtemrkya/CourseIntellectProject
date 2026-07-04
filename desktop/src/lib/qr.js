import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// QR kodlar cihazda üretilir — yoklama oturum token'ı gibi hassas veriler
// üçüncü taraf servislere (ör. api.qrserver.com) gönderilmez.
export async function qrDataUrl(data, size = 320) {
  return QRCode.toDataURL(String(data), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export function useQrDataUrl(data, size = 320) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!data) { setUrl(''); return undefined; }
    qrDataUrl(data, size)
      .then((value) => { if (!cancelled) setUrl(value); })
      .catch(() => { if (!cancelled) setUrl(''); });
    return () => { cancelled = true; };
  }, [data, size]);
  return url;
}

export async function downloadQrPng(data, fileName = 'qr.png', size = 768) {
  const href = await qrDataUrl(data, size);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
