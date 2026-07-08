import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// İlk seri seçilen marka vurgu rengini (tenant paleti) takip eder; geri kalanı
// anlamsal sabit renkler. Böylece geliştirici/admin paletinde seçilen renk
// grafiklere de yansır.
export const CHART_COLORS = ["hsl(var(--brand-accent))", "#3B82F6", "#10B981", "#A855F7", "#F43F5E", "#06B6D4"];

function buildSmoothPath(points) {
  if (points.length < 2) return "";
  const d = [`M ${points[0][0]},${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(" ");
}

const toneClass = {
  brand: "from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]",
  blue: "from-sky-400 to-blue-600",
  emerald: "from-emerald-400 to-teal-600",
  violet: "from-violet-400 to-fuchsia-600",
  amber: "from-amber-400 to-orange-600",
  rose: "from-rose-400 to-red-600",
};

const chartTone = {
  brand: { start: "hsl(var(--brand-accent))", end: "hsl(var(--brand-accent-hover))", glow: "hsl(var(--brand-accent))" },
  blue: { start: "#38bdf8", end: "#2563eb", glow: "#3b82f6" },
  emerald: { start: "#34d399", end: "#0d9488", glow: "#10b981" },
  violet: { start: "#a78bfa", end: "#d946ef", glow: "#a855f7" },
  amber: { start: "#fbbf24", end: "#f97316", glow: "#f59e0b" },
  rose: { start: "#fb7185", end: "#e11d48", glow: "#f43f5e" },
};

function coerceNumber(value) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = React.useState(target);
  React.useEffect(() => {
    if (!Number.isFinite(target)) return undefined;
    let raf;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// Sayıyı (ön/son ek koruyarak) animasyonla yukarı sayar. "%92", "+1236", "3 / 39" gibi.
export function AnimatedValue({ value }) {
  const str = String(value ?? "");
  const match = str.match(/^([^\d-]*)(-?\d+(?:[.,]\d+)?)(.*)$/);
  const target = match ? parseFloat(match[2].replace(",", ".")) : NaN;
  const current = useCountUp(target);
  if (!match) return <>{value}</>;
  const decimals = (match[2].split(/[.,]/)[1] || "").length;
  const formatted = decimals ? current.toFixed(decimals) : Math.round(current).toString();
  return <>{match[1]}{formatted}{match[3]}</>;
}

// Veri (zaman serisi) yokken gösterilen premium boş durum: tona uyumlu, dekoratif
// bir dalga + kayan parıltı. Dalga kesikli çizilir ve köşede küçük bir etiketle
// bunun gerçek trend değil görsel amaçlı olduğu belli olur.
function EmptyChart({ className, tone = "brand", label = "Geçmiş veri yok" }) {
  const gid = React.useId();
  const palette = chartTone[tone] || chartTone.brand;
  const width = 180;
  const height = 54;
  const decoValues = [8, 12, 9, 15, 11, 17, 13, 19];
  const max = Math.max(...decoValues);
  const min = Math.min(...decoValues);
  const range = Math.max(max - min, 1);
  const points = decoValues.map((value, index) => {
    const x = (index / (decoValues.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 14) - 7;
    return [x, y];
  });
  const linePath = buildSmoothPath(points);
  const area = `${linePath} L ${width},${height} L 0,${height} Z`;

  return (
    <div className={cn("relative h-14 w-full overflow-hidden rounded-xl border border-foreground/[0.07] bg-foreground/[0.02]", className)} aria-hidden="true">
      <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`ci-empty-line-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={palette.start} stopOpacity="0.5" />
            <stop offset="100%" stopColor={palette.end} stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id={`ci-empty-area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.16" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.34, 0.68].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="hsl(var(--foreground) / 0.06)" strokeDasharray="4 6" />
        ))}
        <path d={area} fill={`url(#ci-empty-area-${gid})`} />
        <path d={linePath} fill="none" stroke={`url(#ci-empty-line-${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />
      </svg>
      <motion.div
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent"
        initial={{ x: "-130%" }}
        animate={{ x: "330%" }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.7 }}
      />
      <span className="absolute bottom-1 right-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45">{label}</span>
    </div>
  );
}

export function MiniLineChart({ values = [], tone = "brand", className }) {
  const safeValues = values.map(coerceNumber).filter((value) => Number.isFinite(value));
  const gid = React.useId();
  if (!safeValues.length) return <EmptyChart className={className} tone={tone} />;
  const palette = chartTone[tone] || chartTone.brand;

  const width = 180;
  const height = 54;
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const points = safeValues.map((value, index) => {
    const x = (index / Math.max(safeValues.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const linePath = safeValues.length > 1 ? buildSmoothPath(points) : "";
  const single = safeValues.length === 1 ? points[0] : null;
  const area = linePath ? `${linePath} L ${width},${height} L 0,${height} Z` : "";
  const last = points[points.length - 1];

  return (
    <svg className={cn("h-14 w-full overflow-visible rounded-xl", className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`ci-line-${gid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={palette.start} />
          <stop offset="100%" stopColor={palette.end} />
        </linearGradient>
        <linearGradient id={`ci-area-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.glow} stopOpacity="0.34" />
          <stop offset="65%" stopColor={palette.glow} stopOpacity="0.09" />
          <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
        </linearGradient>
        <filter id={`ci-glow-${gid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="10" fill={palette.glow} fillOpacity="0.025" />
      {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="hsl(var(--foreground) / 0.07)" strokeDasharray="4 6" />)}
      {area ? <path d={area} fill={`url(#ci-area-${gid})`} /> : null}
      {linePath ? (
        <motion.path
          d={linePath}
          fill="none"
          stroke={`url(#ci-line-${gid})`}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          filter={`url(#ci-glow-${gid})`}
          initial={{ pathLength: 0, opacity: 0.35 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      ) : null}
      {points.length > 2 ? points.slice(1, -1).map((point, index) => (
        <circle key={index} cx={point[0]} cy={point[1]} r="1.65" fill={palette.end} fillOpacity="0.65" />
      )) : null}
      {single ? <circle cx={single[0]} cy={single[1]} r="4" fill={palette.end} /> : null}
      {last ? <circle cx={last[0]} cy={last[1]} r="4.2" fill={palette.end} stroke="hsl(var(--background))" strokeWidth="2" style={{ filter: `drop-shadow(0 0 7px ${palette.glow})` }} /> : null}
    </svg>
  );
}

export function MiniBarChart({ values = [], tone = "brand", className }) {
  const safeValues = values.map(coerceNumber).filter((value) => Number.isFinite(value));
  if (!safeValues.length) return <EmptyChart className={className} tone={tone} />;

  const max = Math.max(...safeValues, 1);
  return (
    <div className={cn("flex h-24 items-end gap-2 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-2 pb-1 pt-3", className)} aria-hidden="true">
      {safeValues.map((value, index) => (
        <motion.div
          key={`${value}-${index}`}
          className="flex-1 rounded-t-xl bg-gradient-to-t from-[hsl(var(--brand-accent)/0.22)] to-[hsl(var(--brand-accent)/0.82)] shadow-[0_0_22px_hsl(var(--brand-accent)/0.18)]"
          style={{ height: `${Math.max(10, (value / max) * 100)}%` }}
          initial={{ scaleY: 0, transformOrigin: "bottom" }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.55, delay: index * 0.04, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function MiniDonut({ value = 0, label = "Oran", className }) {
  const safe = Math.max(0, Math.min(100, coerceNumber(value)));
  return (
    <div className={cn("relative grid h-32 w-32 place-items-center rounded-full", className)} style={{ background: `conic-gradient(hsl(var(--brand-accent)) ${safe * 3.6}deg, hsl(var(--muted) / 0.55) 0deg)` }}>
      <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-card/95 text-center shadow-inner">
        <div>
          <div className="text-2xl font-black tracking-tight">%{safe}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Yumuşak (cubic) alan grafiği — turuncu gradyan dolgu + animasyonlu çizgi.
export function PremiumAreaChart({ values = [], className, height = 150 }) {
  // Hook her render'da koşulsuz çağrılmalı; erken return'den önce durursa
  // veri geldiğinde "Rendered more hooks" hatası sayfayı beyaza düşürür.
  const gid = React.useId();
  const safe = values.map(coerceNumber).filter((value) => Number.isFinite(value));
  if (!safe.length) return <EmptyChart className={cn("h-[150px]", className)} label="Grafik verisi yok" />;

  const width = 320;
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = Math.max(max - min, 1);
  const stepX = width / Math.max(safe.length - 1, 1);
  const points = safe.map((value, index) => [index * stepX, height - ((value - min) / range) * (height - 28) - 14]);
  const line = buildSmoothPath(points);
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg className={cn("w-full", className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={`area-line-${gid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--brand-accent))" />
          <stop offset="100%" stopColor="hsl(var(--brand-primary-text))" />
        </linearGradient>
        <linearGradient id={`area-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-accent))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--brand-accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#area-fill-${gid})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={`url(#area-line-${gid})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
      />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="hsl(var(--brand-accent))" className="drop-shadow-[0_0_10px_hsl(var(--brand-accent)/0.7)]" />
    </svg>
  );
}

// Çok segmentli donut grafik + lejant. (Yaklaşan Ödevler dağılımı, sınıf dağılımı vb.)
export function PremiumDonutChart({ segments = [], centerValue, centerLabel, className }) {
  const data = segments.filter((segment) => coerceNumber(segment.value) > 0);
  const total = data.reduce((sum, segment) => sum + coerceNumber(segment.value), 0) || 1;
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row", className)}>
      <div className="relative grid shrink-0 place-items-center">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted) / 0.5)" strokeWidth="16" />
          {data.map((segment, index) => {
            const dash = (coerceNumber(segment.value) / total) * circ;
            const element = (
              <motion.circle
                key={segment.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={segment.color || CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-acc}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              />
            );
            acc += dash;
            return element;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-black tracking-tight">{centerValue}</div>
            {centerLabel ? <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{centerLabel}</div> : null}
          </div>
        </div>
      </div>
      <div className="w-full space-y-2">
        {data.map((segment, index) => (
          <div key={segment.label} className="flex items-center justify-between text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: segment.color || CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className="truncate font-medium">{segment.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-muted-foreground">%{Math.round((coerceNumber(segment.value) / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactRing({ value = 0, className }) {
  const safe = Math.max(0, Math.min(100, coerceNumber(value)));
  return (
    <div className={cn("relative grid h-12 w-12 place-items-center rounded-full", className)} style={{ background: `conic-gradient(hsl(var(--brand-accent)) ${safe * 3.6}deg, hsl(var(--muted) / 0.45) 0deg)` }}>
      <div className="grid h-9 w-9 place-items-center rounded-full bg-card text-[10px] font-black tabular-nums">%{safe}</div>
    </div>
  );
}

export function PremiumMetricCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = "brand",
  chart = "line",
  chartValues,
  donutValue,
  chartClassName,
  onClick,
  className,
}) {
  const sparkline = chartValues?.length ? chartValues : [];
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("group block h-full w-full text-left", onClick && "cursor-pointer")}
    >
      <Card className={cn("ci-metric-card h-full overflow-hidden border-foreground/10", className)}>
        <CardContent className="relative flex h-full min-h-[128px] flex-col justify-between p-4">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[hsl(var(--brand-accent)/0.18)] blur-2xl transition-opacity group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
              <div className="mt-1.5 text-[28px] font-black leading-none tracking-[-0.04em]"><AnimatedValue value={value} /></div>
              {caption ? <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{caption}</p> : null}
            </div>
            {Icon ? (
              <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_12px_28px_hsl(var(--brand-accent)/0.24)]", toneClass[tone] || toneClass.brand)}>
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
          </div>
          {chart === "donut" ? (
            <div className="mt-3 flex h-10 items-center justify-end"><CompactRing value={donutValue ?? value} /></div>
          ) : chart === "bars" ? (
            <MiniBarChart values={sparkline} tone={tone} className={cn("mt-3 h-10", chartClassName)} />
          ) : (
            <MiniLineChart values={sparkline} tone={tone} className={cn("mt-3 h-10", chartClassName)} />
          )}
        </CardContent>
      </Card>
    </Wrapper>
  );
}

export function PremiumPanel({ title, description, action, children, className, contentClassName }) {
  return (
    <Card className={cn("ci-dashboard-panel flex h-full flex-col overflow-hidden", className)}>
      <CardHeader className="relative flex flex-row items-start justify-between gap-4 border-b border-foreground/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="ci-dot-pulse h-2 w-2 rounded-full bg-[hsl(var(--brand-accent))] shadow-[0_0_18px_hsl(var(--brand-accent)/0.8)]" />
            <CardTitle className="text-base font-black uppercase tracking-[0.05em] text-[hsl(var(--brand-accent))]">{title}</CardTitle>
          </div>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className={cn("flex-1 p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

const statusToneClass = {
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  live: "border-[hsl(var(--brand-accent)/0.4)] bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]",
  soon: "border-sky-500/25 bg-sky-500/12 text-sky-300",
  warn: "border-amber-500/25 bg-amber-500/12 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/12 text-rose-300",
  default: "border-foreground/10 bg-foreground/[0.05] text-muted-foreground",
};

export function PremiumStatusPill({ tone = "default", children, className }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusToneClass[tone] || statusToneClass.default, className)}>
      {children}
    </span>
  );
}

// Konu/ders performans satırı: ikon + başlık + alt başlık, sağda büyük değer ve
// harf notu, altta gradyanlı ilerleme çubuğu. (Ders Performansım, Sınıf Performansı,
// Devamsızlık derslere göre vb. tekrar eden kalıp.)
export function PremiumProgressRow({ icon: Icon, title, subtitle, value, valueLabel, progress, tone = "brand", onClick, className }) {
  const pct = Math.max(0, Math.min(100, coerceNumber(progress ?? value)));
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("group flex w-full flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left transition-all hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.06)]", onClick && "cursor-pointer", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_12px_28px_hsl(var(--brand-accent)/0.22)]", toneClass[tone] || toneClass.brand)}>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-2xl font-black tracking-tight">{value}</span>
          {valueLabel ? <span className="text-sm font-bold text-[hsl(var(--brand-accent))]">{valueLabel}</span> : null}
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
        <div className={cn("ci-bar-fill h-full rounded-full bg-gradient-to-r", toneClass[tone] || toneClass.brand)} style={{ width: `${pct}%` }} />
      </div>
    </Wrapper>
  );
}

// Ders programı / zaman çizelgesi satırı: solda saat, ikon + ders + derslik,
// sağda durum etiketi. (Bugünkü Ders Programı, Yaklaşan Dersler vb.)
export function PremiumScheduleRow({ time, title, subtitle, icon: Icon, status, statusTone = "default", active = false, onClick, className }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-all hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.06)]",
        active && "border-[hsl(var(--brand-accent)/0.4)] bg-[hsl(var(--brand-accent)/0.08)]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {time ? <div className="w-[64px] shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{time}</div> : null}
      {Icon ? (
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", active ? "bg-[hsl(var(--brand-accent)/0.16)] text-[hsl(var(--brand-accent))]" : "bg-muted/70 text-muted-foreground")}>
          <Icon className="h-4 w-4" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {status ? <PremiumStatusPill tone={statusTone}>{status}</PremiumStatusPill> : null}
    </Wrapper>
  );
}

// Sınav sonucu kartı: üstte ders, büyük skor + harf notu, sparkline ve altta tarih.
// (Son Sınav Sonuçlarım, Performans kartları vb.)
export function PremiumScoreCard({ subject, score, grade, date, values, tone = "brand", onClick, className }) {
  const sparkline = values?.length ? values : [];
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper type={onClick ? "button" : undefined} onClick={onClick} className={cn("group block h-full w-full text-left", onClick && "cursor-pointer")}>
      <Card className={cn("ci-metric-card h-full overflow-hidden border-foreground/10", className)}>
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <p className="truncate text-xs font-semibold text-muted-foreground">{subject}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tracking-[-0.04em]">{score}</span>
            {grade ? <span className="text-base font-bold text-[hsl(var(--brand-accent))]">{grade}</span> : null}
          </div>
          <MiniLineChart values={sparkline} tone={tone} className="h-12" />
          {date ? <p className="text-[11px] text-muted-foreground">{date}</p> : null}
        </CardContent>
      </Card>
    </Wrapper>
  );
}

export function PremiumListRow({ icon: Icon, title, subtitle, meta, accent = false, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.08)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className={cn("grid h-10 w-10 place-items-center rounded-2xl", accent ? "bg-[hsl(var(--brand-accent)/0.16)] text-[hsl(var(--brand-accent))]" : "bg-muted/70 text-muted-foreground")}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {meta ? <div className="shrink-0 text-right text-xs font-semibold text-muted-foreground">{meta}</div> : null}
    </Wrapper>
  );
}
