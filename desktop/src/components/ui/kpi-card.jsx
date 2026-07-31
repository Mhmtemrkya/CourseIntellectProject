import { motion } from 'framer-motion';
import { AnimatedValue } from './premium-dashboard';
import { cn } from '@/lib/utils';

/**
 * Kurum panolarının ortak KPI kartı.
 *
 * Önce yalnız sürücü kursu panelinde vardı; okul ana paneli de aynı ızgarayı
 * kullandığı için buraya taşındı. İki kurum türü yan yana aynı ürün gibi
 * görünsün diye tek uygulama vardır — `driving/_shared.jsx` bunu yeniden
 * dışa vurur (DrivingStatCard/TONES adları korunur).
 *
 * İlk ton marka vurgusunu takip eder: tenant paleti değişince kartlar da değişir.
 */
export const KPI_TONES = {
  brand: 'from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]',
  blue: 'from-sky-400 to-blue-600',
  emerald: 'from-emerald-400 to-teal-600',
  violet: 'from-violet-400 to-fuchsia-600',
  amber: 'from-amber-400 to-orange-600',
  rose: 'from-rose-400 to-red-600',
  cyan: 'from-cyan-400 to-sky-600',
};

export const kpiItemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export function KpiCard({ label, value, caption, icon: Icon, tone = 'brand', onClick, testId }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <motion.div variants={kpiItemVariants}>
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        data-testid={testId}
        title={onClick ? `${label} — detay için tıklayın` : label}
        className={cn(
          'ci-metric-card flex h-full w-full flex-col gap-3 rounded-2xl border border-foreground/10 p-4 text-left transition-all',
          onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.35)]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon ? (
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white', KPI_TONES[tone] || KPI_TONES.brand)}>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-3xl font-black tracking-tight"><AnimatedValue value={value} /></p>
          {caption ? <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{caption}</p> : null}
        </div>
      </Wrapper>
    </motion.div>
  );
}
