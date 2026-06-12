import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Zap, Hash } from 'lucide-react';
import BadgeShield from './BadgeShield';

const MAX_SHOWN = 6;

// Yeni kazanılan rozet(ler) için animasyonlu kutlama modalı.
// Birden fazla rozet açıldıysa sırayla gösterir (en fazla 6 tanesi).
export default function BadgeUnlockModal({ badges, onClose }) {
  const [index, setIndex] = useState(0);
  const shown = (badges || []).slice(0, MAX_SHOWN);
  const extraCount = (badges?.length || 0) - shown.length;

  if (!shown.length) return null;

  const badge = shown[index];
  const isLast = index >= shown.length - 1;
  const color = badge.category.color;

  const handleNext = () => {
    if (isLast) {
      onClose?.();
      return;
    }
    setIndex((prev) => prev + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-testid="badge-unlock-modal"
      >
        <motion.div
          className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8 text-center overflow-hidden"
          style={{ boxShadow: `0 0 80px ${color}55` }}
          initial={{ scale: 0.7, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {shown.length > 1 && (
            <p className="text-xs font-bold text-muted-foreground mb-2">
              Rozet {index + 1} / {shown.length}
            </p>
          )}

          <div className="relative mx-auto h-52 w-52 flex items-center justify-center">
            <motion.div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(from 0deg, ${color}00 0deg, ${color}45 18deg, ${color}00 36deg, ${color}00 60deg, ${color}45 78deg, ${color}00 96deg, ${color}00 120deg, ${color}45 138deg, ${color}00 156deg, ${color}00 180deg, ${color}45 198deg, ${color}00 216deg, ${color}00 240deg, ${color}45 258deg, ${color}00 276deg, ${color}00 300deg, ${color}45 318deg, ${color}00 336deg)`,
                borderRadius: '9999px',
                maskImage: 'radial-gradient(circle, black 30%, transparent 72%)',
                WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 72%)',
              }}
              animate={{ rotate: 360, opacity: [0.6, 1, 0.6] }}
              transition={{
                rotate: { duration: 14, repeat: Infinity, ease: 'linear' },
                opacity: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
              }}
            />
            <motion.div
              key={badge.id}
              initial={{ scale: 0, rotate: -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }}
            >
              <BadgeShield badge={badge} size={128} glow />
            </motion.div>
          </div>

          <motion.div
            key={`text-${badge.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-xs font-black tracking-[0.2em] mt-2" style={{ color }}>
              YENİ ROZET KAZANDIN!
            </p>
            <h2 className="text-2xl font-black mt-2">{badge.name}</h2>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border"
                style={{ color, borderColor: `${color}59`, backgroundColor: `${color}1F` }}
              >
                {badge.category.name}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-orange-300/40 bg-orange-500/10 text-orange-500">
                <Zap className="h-3 w-3" /> {badge.xpThreshold} XP
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-slate-300/40 bg-slate-500/10 text-muted-foreground">
                <Hash className="h-3 w-3" /> {badge.code}
              </span>
            </div>
            {isLast && extraCount > 0 && (
              <p className="text-sm font-semibold mt-4">
                ve {extraCount} rozet daha kazandın!
              </p>
            )}
          </motion.div>

          <button
            type="button"
            onClick={handleNext}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: color }}
            data-testid="badge-unlock-next"
          >
            {isLast ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            {isLast ? 'Harika!' : 'Sonraki Rozet'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
