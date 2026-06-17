import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, Loader2, Video, X, Clock3, ShieldCheck,
} from 'lucide-react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';

function parseStart(dateLabel, startTime) {
  const raw = String(dateLabel || '').trim();
  if (!raw) return null;
  let base = new Date(raw);
  if (Number.isNaN(base.getTime())) {
    const parts = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (!parts) return null;
    const [, day, month, year] = parts;
    base = new Date(`${year.length === 2 ? `20${year}` : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
  }
  const time = String(startTime || '').trim();
  const timeMatch = time.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    base.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return { date: base, hasTime: !!timeMatch };
}

// Sınav öncesi kapı: kamera + canlı yayın zorunluysa öğrenci ikisini de
// tamamlamadan sınava giremez. Geç giriş limiti de burada uygulanır.
export default function ExamEntryGate({ exam, onCancel, onEnter }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [joinedLive, setJoinedLive] = useState(false);
  const [entering, setEntering] = useState(false);

  const requireCamera = !!exam?.requireCamera;
  const liveLinkUrl = (exam?.liveLinkUrl || '').trim();
  const lateLimit = Number(exam?.lateEntryLimitMinutes || 0);

  const timeGate = useMemo(() => {
    const parsed = parseStart(exam?.dateLabel || exam?.date, exam?.startTime);
    if (!parsed || !parsed.hasTime) return { blocked: false, message: '' };
    const now = Date.now();
    const startMs = parsed.date.getTime();
    if (now < startMs) {
      return { blocked: true, message: `Sınav ${parsed.date.toLocaleString('tr-TR')} tarihinde başlayacak. Henüz giriş yapılamaz.` };
    }
    const deadline = startMs + Math.max(0, lateLimit) * 60000;
    if (now > deadline) {
      return { blocked: true, message: `Geç giriş süresi (${lateLimit} dk) doldu. Bu sınava artık giriş yapamazsın.` };
    }
    return { blocked: false, message: '' };
  }, [exam?.date, exam?.dateLabel, exam?.startTime, lateLimit]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const openCamera = useCallback(async () => {
    setCameraError('');
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Bu cihaz/uygulama kamera erişimini desteklemiyor.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      setCameraReady(false);
      setCameraError(err?.message || 'Kameraya erişilemedi. Lütfen izin verip tekrar dene.');
    } finally {
      setCameraLoading(false);
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const openLiveLink = () => {
    if (liveLinkUrl) {
      window.open(liveLinkUrl, '_blank', 'noopener,noreferrer');
    }
    setJoinedLive(true);
  };

  const cameraOk = !requireCamera || cameraReady;
  const liveOk = !liveLinkUrl || joinedLive;
  const canEnter = cameraOk && liveOk && !timeGate.blocked && !entering;

  const handleEnter = async () => {
    if (!canEnter) return;
    setEntering(true);
    try {
      // Kamerayı bırakıp akışı çözme sayfasına devret (orada yeniden açılır).
      stopCamera();
      await onEnter({ joinedLive: liveOk && (!!liveLinkUrl || joinedLive), cameraReady: cameraOk });
    } finally {
      setEntering(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) { stopCamera(); onCancel(); } }}>
      <DialogContent className="w-[min(96vw,720px)] max-w-[720px] overflow-hidden border-white/10 bg-[#0B1728] p-0 text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">Sınav Giriş Kontrolü</h2>
              <p className="text-xs text-slate-400">{exam?.name || exam?.title}</p>
            </div>
          </div>
          <button type="button" onClick={() => { stopCamera(); onCancel(); }} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {timeGate.blocked ? (
            <div className="flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              <Clock3 className="h-5 w-5 shrink-0" /> {timeGate.message}
            </div>
          ) : null}

          {liveLinkUrl ? (
            <div className={`rounded-2xl border p-4 ${joinedLive ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Video className={`h-5 w-5 ${joinedLive ? 'text-emerald-300' : 'text-slate-300'}`} />
                  <div>
                    <p className="text-sm font-bold">1. Canlı yayına katıl</p>
                    <p className="text-xs text-slate-400">Öğretmenin canlı görüntü bağlantısına gir, ardından bu pencereye dön.</p>
                  </div>
                </div>
                {joinedLive ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : null}
              </div>
              <Button onClick={openLiveLink} className="mt-3 w-full bg-sky-600 text-white hover:bg-sky-700">
                {joinedLive ? 'Canlı yayını tekrar aç' : 'Canlı Yayına Katıl'}
              </Button>
            </div>
          ) : null}

          {requireCamera ? (
            <div className={`rounded-2xl border p-4 ${cameraReady ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Camera className={`h-5 w-5 ${cameraReady ? 'text-emerald-300' : 'text-slate-300'}`} />
                  <div>
                    <p className="text-sm font-bold">{liveLinkUrl ? '2. ' : ''}Kameranı aç</p>
                    <p className="text-xs text-slate-400">Sınav boyunca kameran açık kalmalı.</p>
                  </div>
                </div>
                {cameraReady ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : null}
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} muted playsInline className={`h-44 w-full object-cover ${cameraReady ? '' : 'hidden'}`} />
                {!cameraReady ? (
                  <div className="flex h-44 w-full flex-col items-center justify-center gap-2 text-slate-400">
                    <Camera className="h-8 w-8" />
                    <span className="text-xs">Kamera kapalı</span>
                  </div>
                ) : null}
              </div>
              {cameraError ? <p className="mt-2 text-xs text-red-300">{cameraError}</p> : null}
              {!cameraReady ? (
                <Button onClick={openCamera} disabled={cameraLoading} className="mt-3 w-full bg-orange-500 text-white hover:bg-orange-600">
                  {cameraLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  Kamerayı Aç
                </Button>
              ) : null}
            </div>
          ) : null}

          {!liveLinkUrl && !requireCamera ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Bu sınav için ek giriş şartı yok. Hazır olduğunda sınava başlayabilirsin.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <button type="button" onClick={() => { stopCamera(); onCancel(); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">
            Vazgeç
          </button>
          <Button onClick={handleEnter} disabled={!canEnter} className="bg-emerald-600 px-6 text-white hover:bg-emerald-700 disabled:opacity-50">
            {entering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sınava Gir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
