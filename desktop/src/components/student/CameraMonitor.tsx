import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Radio } from 'lucide-react';
import { examCameraRealtime } from '../../lib/realtime/examCameraRealtime';

const FRAME_INTERVAL_MS = 4000; // kameradan ~4 sn'de bir kare gönder
const FRAME_WIDTH = 320;        // küçük kare = küçük yük

// Sınav boyunca sağ altta sabit duran küçük kamera önizlemesi. publish + examId
// verilirse görüntüyü periyodik olarak öğretmenin canlı izleme ekranına yayınlar.
export default function CameraMonitor({ active, examId, studentUsername, studentName, publish = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Kamera desteklenmiyor');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setError('');
      } catch (err) {
        setError(err?.message || 'Kamera açılamadı');
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [active]);

  // Periyodik kare yayını (öğretmenin canlı izleme ızgarasına).
  useEffect(() => {
    if (!active || !publish || !examId || error) return undefined;

    const sendFrame = () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return;
      const canvas = canvasRef.current || (canvasRef.current = document.createElement('canvas'));
      const ratio = video.videoHeight / video.videoWidth;
      canvas.width = FRAME_WIDTH;
      canvas.height = Math.round(FRAME_WIDTH * ratio) || 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      } catch {
        return; // güvenlik kısıtı vb.
      }
      if (dataUrl && dataUrl.length > 64) {
        examCameraRealtime.publishFrame(examId, studentUsername, studentName, dataUrl);
        setStreaming(true);
      }
    };

    // İlk kareyi kamera ısınınca gönder, sonra periyodik devam et.
    const warmup = window.setTimeout(sendFrame, 1200);
    const interval = window.setInterval(sendFrame, FRAME_INTERVAL_MS);
    return () => {
      window.clearTimeout(warmup);
      window.clearInterval(interval);
      setStreaming(false);
    };
  }, [active, publish, examId, studentUsername, studentName, error]);

  if (!active) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-44 overflow-hidden rounded-2xl border border-foreground/15 bg-black/70 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-1.5 text-[11px] font-bold text-orange-200">
        {error ? <CameraOff className="h-3.5 w-3.5 text-red-300" /> : <Camera className="h-3.5 w-3.5" />}
        Kamera {error ? 'kapalı' : 'açık'}
        {publish && streaming && !error ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
            <Radio className="h-3 w-3 animate-pulse" /> Canlı
          </span>
        ) : null}
      </div>
      {error ? (
        <div className="flex h-28 w-full items-center justify-center px-3 text-center text-[11px] text-red-300">
          {error}
        </div>
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video ref={videoRef} muted playsInline className="h-28 w-full object-cover" />
      )}
    </div>
  );
}
