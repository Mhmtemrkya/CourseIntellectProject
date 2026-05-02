import { motion } from 'framer-motion';
import { Wrench, Clock, ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function MaintenancePage({ message, since, onRetry, onLogout }) {
  const sinceDate = since ? new Date(since) : null;
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#021622] via-[#0a2535] to-[#021622] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-xl w-full"
      >
        <div className="rounded-3xl border border-[#D9790B]/25 bg-[#021622]/90 p-10 backdrop-blur-md shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.32em] text-[#FBB971]/85">
            <span aria-hidden className="inline-block h-px w-8 bg-[#D9790B]" />
            <span>Sistem · Bakım</span>
          </div>

          <div className="mt-6 grid h-16 w-16 place-items-center rounded-2xl bg-[#D9790B]/15 ring-1 ring-[#D9790B]/35">
            <Wrench className="h-7 w-7 text-[#FBB971]" />
          </div>

          <h1 className="mt-6 font-display text-3xl font-semibold text-white md:text-4xl tracking-[-0.02em]">
            Sistem şu anda bakımda
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            {message || 'CourseIntellect platformu kısa bir süreliğine bakımda. Servis kısa sürede yeniden açılacak.'}
          </p>

          {sinceDate && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60">
              <Clock className="h-3.5 w-3.5" />
              Başlangıç: {sinceDate.toLocaleString('tr-TR')}
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button
              onClick={onRetry}
              className="h-11 bg-[#D9790B] font-semibold text-[#00354F] hover:bg-[#F08C1E]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Yeniden dene
            </Button>
            {onLogout && (
              <Button
                variant="outline"
                onClick={onLogout}
                className="h-11 border-white/15 bg-transparent text-white/85 hover:border-white/30 hover:bg-white/[0.04]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış yap
              </Button>
            )}
          </div>

          <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-white/60">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              Verileriniz güvende. Bakım yalnızca girişleri kapatır; veri kaybı yaşanmaz.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
