import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// QR kodlar cihazda üretilir — yoklama oturum token'ı gibi hassas veriler
// üçüncü taraf servislere (ör. api.qrserver.com) gönderilmez.
export async function qrDataUrl(data: unknown, size = 320): Promise<string> {
  return QRCode.toDataURL(String(data), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export function useQrDataUrl(data: unknown, size = 320): string {
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

export async function downloadQrPng(data: unknown, fileName = 'qr.png', size = 768): Promise<void> {
  const href = await qrDataUrl(data, size);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
