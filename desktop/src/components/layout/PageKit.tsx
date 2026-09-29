import type { MouseEventHandler, ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Button } from '../ui/button';
import { LoadingDots } from '../animations/AnimatedIcon';
import { KPI_TONES, KpiCard } from '../ui/kpi-card';
import { cn } from '@/lib/utils';
import type { IconComponent } from '@/types/ui';

// Liste/özet ekranlarının ortak iskeleti: animasyonlu sayfa kabı, başlık,
// yükleniyor ve boş durum bileşenleri. KPI kartı okul ana paneliyle ortaktır.
const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export interface PageProps {
  children?: ReactNode;
  testId?: string;
  className?: string;
}

export function Page({ children, testId, className }: PageProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn('space-y-5', className)}
      data-testid={testId}
    >
      {children}
    </motion.div>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconComponent;
  actions?: ReactNode;
  onRefresh?: MouseEventHandler<HTMLButtonElement>;
  refreshing?: boolean;
}

export function PageHeader({ title, description, icon: Icon, actions, onRefresh, refreshing }: PageHeaderProps) {
  return (
    <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_12px_28px_hsl(var(--brand-accent)/0.24)]', KPI_TONES.brand)}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {actions}
        {onRefresh ? (
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshIcon spinning={refreshing} /> Yenile
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={cn('mr-2 h-4 w-4', spinning && 'animate-spin')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export const StatCard = KpiCard;

export function PageLoading() {
  return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
}

// Boş alan bırakmak "sistem bozuk" hissi verir; nedenini söyleyip alanı dolduruyoruz.
export interface PageNoticeProps {
  icon?: IconComponent;
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
}

export function PageNotice({ icon: Icon, title, message, action }: PageNoticeProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.02] p-8 text-center">
      {Icon ? <Icon className="h-8 w-8 text-muted-foreground" /> : null}
      <div>
        {title ? <p className="font-bold">{title}</p> : null}
        {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}
