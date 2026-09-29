import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Radio, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { examCameraRealtime } from '../../lib/realtime/examCameraRealtime';

const STALE_MS = 15000; // 15 sn kare gelmezse "bağlantı bekleniyor" say

// Öğretmenin planlı sınav için canlı kamera izleme ızgarası. Öğrencilerin sınav
// ekranından gönderdiği periyodik kareleri (snapshot) gerçek zamanlı gösterir.
export default function ExamLiveCameraDialog({ exam, onClose }) {
  const [frames, setFrames] = useState({});
  const [now, setNow] = useState(Date.now());
  const framesRef = useRef(frames);
  framesRef.current = frames;

  useEffect(() => {
    if (!exam?.id) return undefined;
    let unsubscribe = () => {};
    let mounted = true;

    const handler = (payload) => {
      if (!mounted || String(payload?.examId) !== String(exam.id)) return;
      const key = payload.studentUsername || payload.studentName || 'anon';
      setFrames((prev) => ({
        ...prev,
        [key]: {
          name: payload.studentName || payload.studentUsername || 'Öğrenci',
          username: payload.studentUsername || '',
          frame: payload.frame,
          at: Date.now(),
        },
      }));
    };

    examCameraRealtime.joinMonitor(exam.id, handler).then((off) => {
      if (mounted) unsubscribe = off; else off?.();
    });

    const ticker = window.setInterval(() => setNow(Date.now()), 3000);
    return () => {
      mounted = false;
      window.clearInterval(ticker);
      unsubscribe();
    };
  }, [exam?.id]);

  const entries = useMemo(
    () => Object.entries(frames).sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr')),
    [frames],
  );
  const liveCount = entries.filter(([, info]) => now - info.at < STALE_MS).length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,960px)] max-w-[960px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-[hsl(var(--brand-accent))]" />
            Canlı Kamera İzleme — {exam.title}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-500">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> {liveCount} canlı
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {entries.length} öğrenci bağlandı
          </span>
          <span className="text-xs text-muted-foreground">Görüntüler ~4 sn'de bir yenilenir.</span>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/15 py-16 text-center text-sm text-muted-foreground">
            <CameraOff className="h-8 w-8" />
            <p>Henüz kamera yayını yok.</p>
            <p className="text-xs">Öğrenciler kameralı sınava girince görüntüleri burada canlı belirir.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map(([key, info]) => {
              const stale = now - info.at >= STALE_MS;
              return (
                <div key={key} className="overflow-hidden rounded-2xl border border-foreground/10 bg-black/80">
                  <div className="relative aspect-[4/3] w-full bg-black">
                    <img src={info.frame} alt={info.name} className={`h-full w-full object-cover ${stale ? 'opacity-40 grayscale' : ''}`} />
                    <span className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${stale ? 'bg-slate-700/80 text-slate-200' : 'bg-emerald-500/90 text-white'}`}>
                      {stale ? 'Bekleniyor' : <><Radio className="h-2.5 w-2.5 animate-pulse" /> Canlı</>}
                    </span>
                  </div>
                  <div className="truncate px-2.5 py-1.5 text-xs font-semibold text-white">{info.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
