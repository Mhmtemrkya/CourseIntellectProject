import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { Button } from './button';
import { useToast } from '../../hooks/use-toast';
import { uploadFile } from '../../lib/api/modules';

/**
 * Tek fotoğraf alanı: kullanıcı ister web kamerasından çeker ister var olan bir
 * dosyayı yükler. Seçilen görüntü doğrudan gösterilir (dosya bağlantısı değil).
 *
 * value        — mevcut fotoğrafın URL'i ('' / null yoksa)
 * onChange(url)— yeni URL veya '' (kaldırıldığında)
 * folder       — yükleme klasörü
 * size         — önizleme kenar uzunluğu px (kare)
 */
export default function PhotoCapture({ value, onChange, folder = 'student-photos', size = 128 }) {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  // Bileşen kapanınca kamerayı serbest bırak (kamera ışığı açık kalmasın).
  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (active && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [active]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      toast({ title: 'Kamera açılamadı', description: 'Uygulamaya kamera izni verildiğinden emin olun.', variant: 'destructive' });
    }
  };

  const upload = async (blobOrFile, name) => {
    setBusy(true);
    try {
      const file = blobOrFile instanceof File ? blobOrFile : new File([blobOrFile], name, { type: 'image/jpeg' });
      const data = new FormData(); data.set('file', file);
      const result = await uploadFile(data, folder);
      onChange(result.fileUrl);
    } catch (error) {
      toast({ title: 'Fotoğraf yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) { toast({ title: 'Görüntü alınamadı.', variant: 'destructive' }); return; }
    await upload(blob, `webcam-${Date.now()}.jpg`);
    stop();
    toast({ title: 'Fotoğraf çekildi' });
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // aynı dosya yeniden seçilebilsin
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Yalnızca görsel dosyası seçilebilir.', variant: 'destructive' }); return; }
    await upload(file);
  };

  const box = { width: size, height: size };

  // Kamera açıkken canlı önizleme.
  if (active) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full max-w-xs rounded-xl border bg-black" playsInline muted />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={capture} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Yükleniyor…</> : <><Camera className="mr-2 h-4 w-4" />Çek</>}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={stop}>İptal</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {value
        ? <img src={value} alt="Öğrenci fotoğrafı" style={box} className="shrink-0 rounded-xl border object-cover" />
        : (
          <div style={box} className="flex shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
            <Camera className="h-6 w-6" />
          </div>
        )}
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={busy}>
          <Camera className="mr-2 h-4 w-4" />Web kameradan çek
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Dosyadan yükle
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={busy}>
            <X className="mr-2 h-4 w-4" />Kaldır
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
    </div>
  );
}
