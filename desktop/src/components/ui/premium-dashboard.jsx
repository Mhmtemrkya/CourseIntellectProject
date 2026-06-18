import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const toneClass = {
  brand: "from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]",
  blue: "from-sky-400 to-blue-600",
  emerald: "from-emerald-400 to-teal-600",
  violet: "from-violet-400 to-fuchsia-600",
  amber: "from-amber-400 to-orange-600",
  rose: "from-rose-400 to-red-600",
};

function coerceNumber(value) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeSparkline(value, offset = 0) {
  const base = Math.max(8, Math.min(92, coerceNumber(value) % 100 || 42));
  return [0, 1, 2, 3, 4, 5, 6].map((step) => {
    const wave = Math.sin((step + offset) * 1.15) * 13;
    const lift = step * 3.2;
    return Math.max(8, Math.min(96, base * 0.52 + wave + lift + 18));
  });
}

export function MiniLineChart({ values = [], tone = "brand", className }) {
  const safeValues = values.length ? values : makeSparkline(48);
  const width = 180;
  const height = 54;
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const points = safeValues.map((value, index) => {
    const x = (index / Math.max(safeValues.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg className={cn("h-14 w-full overflow-visible", className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`ci-line-${tone}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--brand-accent))" />
          <stop offset="100%" stopColor="hsl(var(--brand-primary-text))" />
        </linearGradient>
        <linearGradient id={`ci-area-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-accent))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--brand-accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#ci-area-${tone})`} />
      <polyline points={points} fill="none" stroke={`url(#ci-line-${tone})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      {safeValues.map((value, index) => {
        if (index !== safeValues.length - 1) return null;
        const [x, y] = points.split(" ").at(-1).split(",").map(Number);
        return <circle key={value} cx={x} cy={y} r="4" fill="hsl(var(--brand-accent))" className="drop-shadow-[0_0_10px_hsl(var(--brand-accent)/0.65)]" />;
      })}
    </svg>
  );
}

export function MiniBarChart({ values = [], tone = "brand", className }) {
  const safeValues = values.length ? values : [34, 48, 38, 65, 58, 78, 70];
  const max = Math.max(...safeValues, 1);
  return (
    <div className={cn("flex h-24 items-end gap-2", className)} aria-hidden="true">
      {safeValues.map((value, index) => (
        <div key={`${value}-${index}`} className="flex-1 rounded-t-xl bg-gradient-to-t from-[hsl(var(--brand-accent)/0.22)] to-[hsl(var(--brand-accent)/0.78)] shadow-[0_0_22px_hsl(var(--brand-accent)/0.16)]" style={{ height: `${Math.max(18, (value / max) * 100)}%` }} />
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

export function PremiumMetricCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = "brand",
  trend,
  chartValues,
  onClick,
  className,
}) {
  const sparkline = chartValues?.length ? chartValues : makeSparkline(value, title?.length || 0);
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("group block h-full w-full text-left", onClick && "cursor-pointer")}
    >
      <Card className={cn("ci-metric-card h-full overflow-hidden border-white/10", className)}>
        <CardContent className="relative flex h-full min-h-[154px] flex-col justify-between p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[hsl(var(--brand-accent)/0.18)] blur-2xl transition-opacity group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
              <div className="mt-2 text-3xl font-black tracking-[-0.04em]">{value}</div>
              {caption ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{caption}</p> : null}
            </div>
            {Icon ? (
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_18px_38px_hsl(var(--brand-accent)/0.24)]", toneClass[tone] || toneClass.brand)}>
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
            <MiniLineChart values={sparkline} tone={tone} />
            <Badge variant="outline" className="mb-1 border-[hsl(var(--brand-accent)/0.28)] bg-[hsl(var(--brand-accent)/0.10)] text-[hsl(var(--brand-accent))]">
              {trend || "Canlı"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}

export function PremiumPanel({ title, description, action, children, className, contentClassName }) {
  return (
    <Card className={cn("ci-dashboard-panel overflow-hidden", className)}>
      <CardHeader className="relative flex flex-row items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--brand-accent))] shadow-[0_0_18px_hsl(var(--brand-accent)/0.8)]" />
            <CardTitle className="text-base font-black uppercase tracking-[0.05em] text-[hsl(var(--brand-accent))]">{title}</CardTitle>
          </div>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function PremiumListRow({ icon: Icon, title, subtitle, meta, accent = false, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.08)]"
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
