import { motion } from 'framer-motion';

// Course Intellect premium kart dili: koyu lacivert zemin, ince beyaz çizgiler,
// ders bazlı vurgu rengi ve turuncu marka parıltısı.
const SUBJECT_THEMES = [
  { match: ['mat'], hue: '#4DA3FF', mark: '∑', tagline: 'FORMÜL • PROBLEM • MANTIK' },
  { match: ['fiz'], hue: '#7B61FF', mark: 'F', tagline: 'HAREKET • ENERJİ • KUVVET' },
  { match: ['kim'], hue: '#FF9D2E', mark: 'H₂O', tagline: 'TEPKİME • MADDE • BAĞ' },
  { match: ['biy'], hue: '#30D158', mark: 'DNA', tagline: 'CANLI • HÜCRE • SİSTEM' },
  { match: ['türk', 'turk', 'edeb'], hue: '#FF5E7A', mark: 'Aa', tagline: 'DİL • ANLAM • PARAGRAF' },
  { match: ['ing', 'eng'], hue: '#22D3EE', mark: 'EN', tagline: 'VOCAB • GRAMMAR • READING' },
  { match: ['sosyal', 'tarih', 'coğ', 'cog'], hue: '#FBBF24', mark: 'TR', tagline: 'ZAMAN • MEKAN • TOPLUM' },
  { match: ['fen'], hue: '#34D399', mark: 'Fe', tagline: 'DENEY • GÖZLEM • KEŞİF' },
];

const DEFAULT_THEME = { hue: '#FF9D2E', mark: '✦', tagline: 'PRATİK • TEKRAR • BAŞARI' };

export function getResourceTheme(subject = '') {
  const normalized = String(subject).toLowerCase();
  return SUBJECT_THEMES.find((theme) => theme.match.some((token) => normalized.includes(token))) || DEFAULT_THEME;
}

export function CardIconAction({ icon: Icon, title, onClick, disabled = false, tone = 'default' }) {
  const tones = {
    default: 'text-slate-300 hover:border-orange-400/40 hover:bg-orange-400/10 hover:text-orange-200',
    danger: 'text-slate-400 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300',
    success: 'text-slate-300 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.04] transition disabled:opacity-40 ${tones[tone] || tones.default}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function PremiumResourceCard({
  subject,
  eyebrow,
  title,
  subtitle,
  badge,
  badgeTone = 'accent',
  chips = [],
  stats = [],
  description,
  actions = null,
  footer = null,
  statusNote = null,
  onClick,
}) {
  const theme = getResourceTheme(subject);
  const clickable = typeof onClick === 'function';
  const Wrapper = clickable ? 'button' : 'div';

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="h-full">
      <Wrapper
        type={clickable ? 'button' : undefined}
        onClick={onClick}
        className={`group relative flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] p-5 text-left text-foreground shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition duration-300 hover:-translate-y-0.5 hover:border-foreground/20 ${clickable ? 'cursor-pointer' : ''}`}
        style={{ '--hue': theme.hue }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80 transition group-hover:opacity-100"
          style={{ background: `radial-gradient(circle at 85% -10%, ${theme.hue}26, transparent 45%), radial-gradient(circle at 0% 110%, rgba(255,157,46,0.08), transparent 40%)` }}
        />
        <div className="pointer-events-none absolute -right-2 -top-7 select-none text-[88px] font-black leading-none tracking-tighter" style={{ color: `${theme.hue}14` }}>
          {theme.mark}
        </div>

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-base font-black"
              style={{ borderColor: `${theme.hue}40`, backgroundColor: `${theme.hue}1f`, color: theme.hue }}
            >
              {theme.mark}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: theme.hue }}>
                {eyebrow || subject || 'Genel'}
              </p>
              <p className="truncate text-[10px] font-bold tracking-[0.18em] text-slate-500">{theme.tagline}</p>
            </div>
          </div>
          {badge ? (
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${badgeTone === 'muted'
                ? 'border-foreground/10 bg-foreground/[0.06] text-slate-300'
                : ''}`}
              style={badgeTone === 'muted' ? undefined : { borderColor: `${theme.hue}38`, backgroundColor: `${theme.hue}1a`, color: theme.hue }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div className="relative mt-4 min-w-0">
          <h3 className="line-clamp-2 text-xl font-black leading-tight tracking-tight text-white">{title}</h3>
          {subtitle ? <p className="mt-1.5 truncate text-sm text-slate-400">{subtitle}</p> : null}
        </div>

        {description ? (
          <p className="relative mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}

        {chips.length > 0 ? (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {chips.filter(Boolean).map((chip) => (
              <span key={chip} className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {stats.length > 0 ? (
          <div className={`relative mt-4 grid gap-2 ${stats.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.04] p-3 text-center">
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="relative mt-auto">
          {footer}
          {(actions || statusNote) ? (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-foreground/[0.08] pt-4">
              <div className="min-w-0 text-xs font-bold text-slate-500">{statusNote}</div>
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            </div>
          ) : null}
        </div>
      </Wrapper>
    </motion.div>
  );
}
