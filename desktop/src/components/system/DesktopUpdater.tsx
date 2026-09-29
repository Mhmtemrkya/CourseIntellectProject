import { useEffect, useRef, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '../ui/button';

const isDesktopApp = () => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

export function DesktopUpdater() {
  const checked = useRef(false);
  const updateRef = useRef(null);
  const [update, setUpdate] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isDesktopApp() || checked.current) return undefined;
    checked.current = true;
    const timer = window.setTimeout(async () => {
      try {
        const available = await check({ timeout: 30000 });
        if (available) {
          updateRef.current = available;
          setUpdate({
            version: available.version,
            currentVersion: available.currentVersion,
            notes: available.body || 'Performans, güvenlik ve kullanım iyileştirmeleri içerir.',
          });
        }
      } catch (checkError) {
        // Güncelleme sunucusuna geçici olarak ulaşılamaması uygulamanın açılışını engellemez.
        console.warn('Desktop update check failed', checkError);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const install = async () => {
    const pending = updateRef.current;
    if (!pending) return;
    setPhase('downloading');
    setError('');
    setProgress(0);
    let downloaded = 0;
    let total = 0;
    try {
      await pending.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength || 0;
          setPhase('downloading');
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength || 0;
          if (total > 0) setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
        } else if (event.event === 'Finished') {
          setProgress(100);
          setPhase('installing');
        }
      }, { timeout: 10 * 60 * 1000 });
      setPhase('restarting');
      await relaunch();
    } catch (installError) {
      setPhase('error');
      setError(installError?.message || 'Güncelleme kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    }
  };

  if (!update || dismissed) return null;
  const busy = ['downloading', 'installing', 'restarting'].includes(phase);
  const statusText = phase === 'installing' ? 'Güncelleme kuruluyor…'
    : phase === 'restarting' ? 'Uygulama yeniden başlatılıyor…'
      : `Güncelleme indiriliyor${progress ? ` · %${progress}` : '…'}`;

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="desktop-update-title">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-background shadow-2xl">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20"><Download className="h-6 w-6 text-blue-300" /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">SchoolAsist</p><h2 id="desktop-update-title" className="text-xl font-black">Yeni güncelleme hazır</h2></div>
            </div>
            {!busy && <button type="button" className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" onClick={() => setDismissed(true)} aria-label="Daha sonra"><X className="h-5 w-5" /></button>}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">Sürüm {update.version} indirilmeye hazır. Güncelleme otomatik kurulacak ve uygulama yeniden açılacak.</p>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-2xl border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Mevcut sürüm</span><b>{update.currentVersion}</b><span className="text-muted-foreground">Yeni sürüm</span><b className="text-blue-600">{update.version}</b></div>
          <div><p className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-emerald-600" />Sürüm notları</p><p className="max-h-28 overflow-y-auto whitespace-pre-line rounded-2xl bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">{update.notes}</p></div>
          {busy && <div className="space-y-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${phase === 'installing' || phase === 'restarting' ? 100 : Math.max(progress, 5)}%` }} /></div><p className="text-center text-xs font-semibold text-muted-foreground">{statusText}</p></div>}
          {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!busy && <Button variant="outline" onClick={() => setDismissed(true)}>Daha Sonra</Button>}
            <Button disabled={busy} onClick={install}>{busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{phase === 'error' ? 'Tekrar Dene' : busy ? 'Güncelleniyor' : 'Güncelle'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
