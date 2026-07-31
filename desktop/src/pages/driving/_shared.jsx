import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { KPI_TONES, KpiCard } from '../../components/ui/kpi-card';
import { cn } from '@/lib/utils';

export const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
export const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

// Ton kümesi ve KPI kartı okul ana paneliyle ORTAKTIR (components/ui/kpi-card).
// İki kurum türü yan yana aynı ürün gibi görünsün diye tek uygulama vardır;
// buradaki adlar (TONES / DrivingStatCard) geriye dönük uyumluluk içindir.
export const TONES = KPI_TONES;

export function DrivingPage({ children, testId, className }) {
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

export function DrivingPageHeader({ title, description, icon: Icon, actions, onRefresh, refreshing }) {
  return (
    <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_12px_28px_hsl(var(--brand-accent)/0.24)]', TONES.brand)}>
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

function RefreshIcon({ spinning }) {
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

// Küçük başlık, animasyonlu büyük değer, gradyanlı ikon rozeti — okul ana
// paneliyle ortak kart.
export const DrivingStatCard = KpiCard;

export function DrivingLoading() {
  return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
}

// Yetkisi olmayan kullanıcıya boş alan bırakmak "sistem bozuk" hissi verir;
// nedenini söyleyip alanı dolduruyoruz.
export function DrivingNotice({ icon: Icon, title, message, action }) {
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
