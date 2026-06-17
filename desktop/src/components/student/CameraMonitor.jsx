import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';

// Sınav boyunca sağ altta sabit duran küçük kamera önizlemesi.
export default function CameraMonitor({ active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');

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

  if (!active) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-44 overflow-hidden rounded-2xl border border-white/15 bg-black/70 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[11px] font-bold text-orange-200">
        {error ? <CameraOff className="h-3.5 w-3.5 text-red-300" /> : <Camera className="h-3.5 w-3.5" />}
        Kamera {error ? 'kapalı' : 'açık'}
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
