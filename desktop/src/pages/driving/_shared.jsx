import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { AnimatedValue } from '../../components/ui/premium-dashboard';
import { cn } from '@/lib/utils';

export const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
export const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

// Okul tarafındaki gradyan tonlarının aynısı. Sürücü kursu ekranları da bu
// kümeden seçer ki iki kurum türü yan yana aynı ürün gibi görünsün. İlk ton
// marka vurgusunu takip eder (tenant paleti değişince grafikler de değişir).
export const TONES = {
  brand: 'from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]',
  blue: 'from-sky-400 to-blue-600',
  emerald: 'from-emerald-400 to-teal-600',
  violet: 'from-violet-400 to-fuchsia-600',
  amber: 'from-amber-400 to-orange-600',
  rose: 'from-rose-400 to-red-600',
  cyan: 'from-cyan-400 to-sky-600',
};

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
      <div className="flex shrink-0 flex-wrap items-center gap-2">
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

// Okul panellerindeki ci-metric-card kalıbının sürücü kursu karşılığı: küçük
// başlık, animasyonlu büyük değer, gradyanlı ikon rozeti.
export function DrivingStatCard({ label, value, caption, icon: Icon, tone = 'brand', onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <motion.div variants={itemVariants}>
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'ci-metric-card flex h-full w-full flex-col gap-3 rounded-2xl border border-foreground/10 p-4 text-left transition-all',
          onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.35)]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon ? (
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white', TONES[tone] || TONES.brand)}>
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
