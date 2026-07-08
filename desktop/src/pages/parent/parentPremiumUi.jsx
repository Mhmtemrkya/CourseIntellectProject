import { useId } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';

export const pageMotion = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

export const itemMotion = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export const panelClass =
  'rounded-[14px] border border-foreground/[0.08] bg-[linear-gradient(180deg,rgba(7,31,57,0.86),rgba(5,22,42,0.78))] shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur-2xl';

export const toneMap = {
  blue: 'from-blue-500/30 to-blue-600/10 text-blue-300 shadow-blue-500/20',
  green: 'from-emerald-500/30 to-emerald-600/10 text-emerald-300 shadow-emerald-500/20',
  orange: 'from-orange-500/30 to-orange-600/10 text-orange-300 shadow-orange-500/20',
  purple: 'from-purple-500/30 to-purple-600/10 text-purple-300 shadow-purple-500/20',
  cyan: 'from-cyan-500/30 to-cyan-600/10 text-cyan-300 shadow-cyan-500/20',
  red: 'from-red-500/30 to-red-600/10 text-red-300 shadow-red-500/20',
};

export function decodeText(value = '') {
  return String(value)
    .replaceAll('&#xFC;', 'ü')
    .replaceAll('&#xDC;', 'Ü')
    .replaceAll('&#xE7;', 'ç')
    .replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı')
    .replaceAll('&#x130;', 'İ')
    .replaceAll('&#xF6;', 'ö')
    .replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş')
    .replaceAll('&#x15E;', 'Ş')
    .replaceAll('&#x11F;', 'ğ')
    .replaceAll('&#x11E;', 'Ğ');
}

export function normalizeText(value = '') {
  return decodeText(value)
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();
}

export function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function buildSmoothPath(points) {
  if (points.length < 2) return '';
  const path = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return path.join(' ');
}

export function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: currency === 'TRY' ? 'currency' : 'decimal',
    currency: currency === 'TRY' ? 'TRY' : undefined,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

export function formatDate(value, fallback = '-') {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return decodeText(value);
  return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function initials(name = '') {
  return decodeText(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'V';
}

export function IconTile({ icon: Icon, tone = 'purple', className = '' }) {
  return (
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br shadow-[0_0_26px] ${toneMap[tone] || toneMap.purple} ${className}`}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

export function PageHeader({ icon, title, description, userName, actions }) {
  return (
    <motion.div variants={itemMotion} className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-[17px] font-black tracking-[-0.03em] text-white">Merhaba, {userName || 'Veli'} 👋</p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
        <div className="mt-8 flex items-center gap-4">
          {icon}
          <div>
            <h1 className="!text-[29px] !font-black !tracking-[-0.04em] !text-white">{title}</h1>
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </motion.div>
  );
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <motion.section variants={itemMotion} className={`${panelClass} p-5 ${className}`}>
      {(title || action) ? (
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-[-0.02em] text-white">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </motion.section>
  );
}

export function StatCard({ icon, tone = 'purple', label, value, sub, className = '' }) {
  return (
    <motion.div variants={itemMotion} className={`${panelClass} flex min-h-[110px] items-center gap-4 p-5 ${className}`}>
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        <p className="mt-1 truncate text-[28px] font-black leading-none tracking-[-0.04em] text-white">{value}</p>
        <p className="mt-2 truncate text-xs text-slate-400">{sub}</p>
      </div>
    </motion.div>
  );
}

export function StatusPill({ children, tone = 'green' }) {
  const styles = {
    green: 'bg-emerald-500/12 text-emerald-300',
    orange: 'bg-orange-500/12 text-orange-300',
    red: 'bg-red-500/12 text-red-300',
    blue: 'bg-blue-500/12 text-blue-300',
    purple: 'bg-purple-500/12 text-purple-300',
    slate: 'bg-foreground/[0.06] text-slate-300',
  };
  return <span className={`inline-flex rounded-[8px] px-3 py-1 text-xs font-black ${styles[tone] || styles.slate}`}>{children}</span>;
}

export function EmptyPanel({ title = 'Kayıt bulunamadı', description = 'Bu bölüm için henüz canlı veri gelmedi.' }) {
  return (
    <div className="rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.03] p-8 text-center">
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function SmallButton({ children, className = '', ...props }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={`h-10 rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.035] px-4 text-slate-200 hover:border-[hsl(var(--brand-accent)/0.45)] hover:bg-[hsl(var(--brand-accent)/0.12)] hover:text-white ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export function DonutChart({ items, center, size = 168 }) {
  const total = items.reduce((sum, item) => sum + Math.max(0, safeNumber(item.value)), 0);
  let offset = 0;
  const gradient = total > 0
    ? items.map((item) => {
      const start = offset;
      const end = offset + (Math.max(0, safeNumber(item.value)) / total) * 360;
      offset = end;
      return `${item.color} ${start}deg ${end}deg`;
    }).join(', ')
    : 'rgba(255,255,255,0.08) 0deg 360deg';

  return (
    <div className="grid place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${gradient})` }}>
      <div className="grid place-items-center rounded-full bg-[hsl(var(--ci-card))]" style={{ width: size * 0.62, height: size * 0.62 }}>
        {center}
      </div>
    </div>
  );
}

export function LineChart({ values, labels = [], color = '#a855f7', className = 'h-56' }) {
  const gid = useId();
  const clean = values.map(safeNumber).filter((value) => Number.isFinite(value));
  if (!clean.length) return <EmptyPanel title="Grafik verisi yok" description="Bu grafik canlı veri geldiğinde oluşacak." />;

  const max = Math.max(100, ...clean, 1);
  const width = 520;
  const height = 220;
  const points = clean.length
    ? clean.map((value, index) => {
      const x = clean.length === 1 ? width / 2 : (index / (clean.length - 1)) * width;
      const y = height - (value / max) * (height - 26) - 12;
      return { x, y, value };
    })
    : [];
  const path = buildSmoothPath(points);
  const area = path ? `${path} L ${points.at(-1).x} ${height} L ${points[0].x} ${height} Z` : '';

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id={`parentLineStroke-${gid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.75" />
            <stop offset="55%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id={`parentLineFill-${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`parentLineGlow-${gid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - (tick / 100) * (height - 26) - 12;
          return <line key={tick} x1="0" x2={width} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="5 8" />;
        })}
        {area ? <path d={area} fill={`url(#parentLineFill-${gid})`} /> : null}
        {path ? (
          <motion.path
            d={path}
            fill="none"
            stroke={`url(#parentLineStroke-${gid})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#parentLineGlow-${gid})`}
            initial={{ pathLength: 0, opacity: 0.3 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        ) : null}
        {points.map((point, index) => (
          <g key={`${point.x}-${point.y}`}>
            <circle cx={point.x} cy={point.y} r="6" fill={color} stroke="hsl(var(--ci-card))" strokeWidth="3" />
            <text x={point.x} y={point.y - 14} textAnchor="middle" className="fill-slate-200 text-[13px] font-bold">{point.value}</text>
            {labels[index] ? <text x={point.x} y={height - 2} textAnchor="middle" className="fill-slate-500 text-[11px]">{labels[index]}</text> : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({ items, color = '#7c3aed', className = 'h-56' }) {
  const max = Math.max(...items.map((item) => safeNumber(item.value)), 1);
  return (
    <div className={`flex items-end gap-5 ${className}`}>
      {items.map((item) => {
        const height = Math.max(10, (safeNumber(item.value) / max) * 100);
        return (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="text-xs font-bold text-slate-300">{item.display || item.value}</div>
            <div className="relative h-40 w-full max-w-[42px] overflow-hidden rounded-t-[10px] bg-foreground/[0.05]">
              <div className="absolute bottom-0 left-0 right-0 rounded-t-[10px]" style={{ height: `${height}%`, background: `linear-gradient(180deg, ${color}, rgba(124,58,237,0.55))`, boxShadow: `0 0 26px ${color}55` }} />
            </div>
            <div className="text-center text-xs text-slate-400">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function RadarChart({ items, className = 'h-[330px]' }) {
  const values = items.slice(0, 6);
  const size = 320;
  const center = size / 2;
  const radius = 118;
  const toPoint = (value, index, scale = 1) => {
    const angle = (Math.PI * 2 * index) / Math.max(values.length, 1) - Math.PI / 2;
    const distance = radius * scale * (safeNumber(value) / 100);
    return [center + Math.cos(angle) * distance, center + Math.sin(angle) * distance];
  };
  const polygon = values.map((item, index) => toPoint(item.value, index).join(',')).join(' ');
  const comparison = values.map((item, index) => toPoint(item.reference ?? item.value, index).join(',')).join(' ');

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={values.map((_, index) => {
              const angle = (Math.PI * 2 * index) / Math.max(values.length, 1) - Math.PI / 2;
              return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
            }).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
          />
        ))}
        {values.map((_, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(values.length, 1) - Math.PI / 2;
          return <line key={index} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="rgba(255,255,255,0.06)" />;
        })}
        {comparison ? <polygon points={comparison} fill="none" stroke="rgba(148,163,184,0.7)" strokeDasharray="6 8" strokeWidth="2" /> : null}
        {polygon ? <polygon points={polygon} fill="rgba(124,58,237,0.34)" stroke="#a855f7" strokeWidth="3" /> : null}
        {values.map((item, index) => {
          const [x, y] = toPoint(item.value, index);
          return <circle key={item.label} cx={x} cy={y} r="5" fill="#a855f7" stroke="hsl(var(--ci-card))" strokeWidth="2" />;
        })}
      </svg>
      {values.map((item, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(values.length, 1) - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 42;
        const y = 50 + Math.sin(angle) * 42;
        return (
          <div key={item.label} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${x}%`, top: `${y}%` }}>
            <p className="text-xs text-slate-300">{item.label}</p>
            <p className={`text-lg font-black ${item.value < 60 ? 'text-red-400' : 'text-white'}`}>{item.value.toFixed(1)}</p>
          </div>
        );
      })}
    </div>
  );
}
