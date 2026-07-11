import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lightbulb, X } from 'lucide-react';

// Spotlight tabanlı sayfa turu motoru.
// - Hedefi olan adımlar: hedef element vurgulanır (dev box-shadow karartması),
//   açıklama kartı hedefin yakınına yerleşir.
// - Hedefsiz adımlar: ekran ortasında kart olarak gösterilir.
// - Hedef bulunamazsa adım otomatik ortalanmış karta düşer (tur asla kırılmaz).

const OVERLAY_Z = 100000;
const SPOT_PADDING = 8;
const CARD_WIDTH = 380;
const CARD_MARGIN = 14;

function measureTarget(selector) {
  if (!selector) return null;
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { el, rect };
  } catch {
    return null;
  }
}

export function TourOverlay({ tour, stepIndex, onStepChange, onClose }) {
  const step = tour?.steps?.[stepIndex];
  const [spot, setSpot] = useState(null);
  const rafRef = useRef(null);

  const refresh = useCallback(() => {
    if (!step?.target) {
      setSpot(null);
      return;
    }
    const found = measureTarget(step.target);
    setSpot(found ? found.rect : null);
  }, [step]);

  // Adım değişince hedefi görünür alana kaydır, sonra ölç.
  useLayoutEffect(() => {
    if (!step) return undefined;
    let cancelled = false;
    const found = step.target ? measureTarget(step.target) : null;
    if (found?.el) {
      found.el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }
    // Kaydırma animasyonu bitene kadar konum tazelenir.
    const started = Date.now();
    const tick = () => {
      if (cancelled) return;
      refresh();
      if (Date.now() - started < 600) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [step, refresh]);

  // Pencere boyutu/scroll değişimlerinde vurguyu güncel tut.
  useEffect(() => {
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [refresh]);

  // Klavye: Esc kapatır, ok tuşları gezdirir.
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose(false);
      if (event.key === 'ArrowRight' && stepIndex < tour.steps.length - 1) onStepChange(stepIndex + 1);
      if (event.key === 'ArrowLeft' && stepIndex > 0) onStepChange(stepIndex - 1);
      if (event.key === 'Enter' && stepIndex === tour.steps.length - 1) onClose(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tour, stepIndex, onStepChange, onClose]);

  if (!tour || !step) return null;

  const isLast = stepIndex === tour.steps.length - 1;
  const hasSpot = Boolean(spot);

  // Kart konumu: hedefin altı, sığmazsa üstü; yatayda ekrana sıkıştır.
  let cardStyle;
  if (hasSpot) {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - (spot.bottom + SPOT_PADDING);
    const placeBelow = spaceBelow > 240 || spot.top < 240;
    const left = Math.min(
      Math.max(CARD_MARGIN, spot.left + spot.width / 2 - CARD_WIDTH / 2),
      viewportW - CARD_WIDTH - CARD_MARGIN,
    );
    cardStyle = placeBelow
      ? { position: 'fixed', top: Math.min(spot.bottom + SPOT_PADDING + CARD_MARGIN, viewportH - 100), left, width: CARD_WIDTH }
      : { position: 'fixed', bottom: viewportH - spot.top + SPOT_PADDING + CARD_MARGIN, left, width: CARD_WIDTH };
  } else {
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(CARD_WIDTH + 60, window.innerWidth - 32),
    };
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z }} data-testid="tour-overlay">
      {/* Karartma: spotlight varsa hedef delik bırakılır, yoksa düz karartma. */}
      {hasSpot ? (
        <motion.div
          initial={false}
          animate={{
            top: spot.top - SPOT_PADDING,
            left: spot.left - SPOT_PADDING,
            width: spot.width + SPOT_PADDING * 2,
            height: spot.height + SPOT_PADDING * 2,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed',
            borderRadius: 14,
            boxShadow: '0 0 0 100000px rgba(2, 6, 23, 0.72)',
            border: '2px solid hsl(var(--brand-accent, 217 91% 60%))',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.72)' }} />
      )}

      {/* Karartılmış alana tıklanınca tur kapanmaz; yanlışlıkla kaçırmayı önler. */}
      <div style={{ position: 'fixed', inset: 0 }} onClick={(e) => e.stopPropagation()} />

      <AnimatePresence mode="wait">
        <motion.div
          key={`${tour.id}-${stepIndex}`}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          style={{ ...cardStyle, zIndex: OVERLAY_Z + 1 }}
          className="rounded-2xl border border-white/10 bg-card text-card-foreground shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          <div className="flex items-start justify-between gap-3 p-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-brand-primary/15 p-1.5 text-brand-primary">
                <Lightbulb className="h-4 w-4" />
              </span>
              <h3 className="font-semibold leading-tight">{step.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Turu kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto px-4 pb-2 text-sm text-muted-foreground whitespace-pre-line">
            {step.body}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
            <div className="flex items-center gap-1.5">
              {tour.steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onStepChange(i)}
                  aria-label={`Adım ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-5 bg-brand-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{stepIndex + 1}/{tour.steps.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClose(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Turu atla
              </button>
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => onStepChange(stepIndex - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Geri
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => (isLast ? onClose(true) : onStepChange(stepIndex + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary/90"
                data-testid="tour-next"
              >
                {isLast ? 'Bitir' : 'İleri'} {isLast ? null : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
