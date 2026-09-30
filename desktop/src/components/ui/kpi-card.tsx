import { motion } from 'framer-motion';
import { AnimatedValue } from './premium-dashboard';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { IconComponent } from '@/types/ui';
import { cardText, cardTone } from './card-palette';

/**
 * Kurum panolarının ortak KPI kartı.
 *
 * Okul ana paneli ve liste ekranları aynı ızgarayı kullanır; tek uygulama
 * vardır — `components/layout/PageKit.jsx` bunu StatCard adıyla dışa vurur.
 *
 * İlk ton marka vurgusunu takip eder: tenant paleti değişince kartlar da değişir.
 */
export type KpiTone = 'brand' | 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan';

export const KPI_TONES: Record<KpiTone, string> = {
  brand: 'from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]',
  blue: 'from-sky-400 to-blue-600',
  emerald: 'from-emerald-400 to-teal-600',
  violet: 'from-violet-400 to-fuchsia-600',
  amber: 'from-amber-400 to-orange-600',
  rose: 'from-rose-400 to-red-600',
  cyan: 'from-cyan-400 to-sky-600',
};

export const kpiItemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export interface KpiCardProps {
  label: ReactNode;
  value: ComponentProps<typeof AnimatedValue>['value'];
  caption?: ReactNode;
  icon?: IconComponent | null;
  tone?: KpiTone;
  onClick?: () => void;
  testId?: string;
  className?: string;
  containerClassName?: string;
}

export function KpiCard({ label, value, caption, icon: Icon, tone = 'brand', onClick, testId, className, containerClassName }: KpiCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <motion.div variants={kpiItemVariants} className={containerClassName}>
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        data-testid={testId}
        data-card-tone={cardTone(label, tone)}
        title={onClick ? `${cardText(label)} — detay için tıklayın` : cardText(label)}
        className={cn(
          'ci-metric-card ci-color-metric flex h-full w-full flex-col gap-5 rounded-3xl border p-5 text-left transition-all',
          onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.35)]',
          className,
        )}
      >
        {Icon ? <Icon className="ci-metric-relief" aria-hidden="true" /> : <span className="ci-metric-orbit" aria-hidden="true" />}
        <div className="ci-metric-heading flex items-center gap-3">
          {Icon ? (
            <div className="ci-metric-icon">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
          <span className="ci-metric-label">{label}</span>
        </div>
        <div className="ci-metric-body">
          <p className="ci-metric-value"><AnimatedValue value={value} /></p>
          {caption ? <div className="ci-metric-caption">{caption}</div> : null}
        </div>
      </Wrapper>
    </motion.div>
  );
}
