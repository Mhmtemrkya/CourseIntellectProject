import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CloudUpload,
  FileText,
  HelpCircle,
  Image,
  Lightbulb,
  Play,
  Rocket,
  Send,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '../ui/button';

const iconMap = {
  content: BookOpen,
  live: Video,
  question: HelpCircle,
  exam: ClipboardCheck,
  assignment: FileText,
  start: Rocket,
};

const floatingMap = {
  content: [Play, FileText, Image],
  live: [Play, Users, FileText],
  question: [HelpCircle, FileText, CheckCircle2],
  exam: [ClipboardCheck, BarChart3, CheckCircle2],
  assignment: [FileText, Send, CloudUpload],
  start: [BookOpen, Users, BarChart3],
};

const accentClass = {
  orange: {
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-400/25',
    glow: 'shadow-orange-500/20',
    primary: 'bg-orange-500 hover:bg-orange-600',
    dot: 'bg-orange-400',
  },
  red: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-400/25',
    glow: 'shadow-rose-500/20',
    primary: 'bg-rose-500 hover:bg-rose-600',
    dot: 'bg-rose-400',
  },
  purple: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-400/25',
    glow: 'shadow-violet-500/20',
    primary: 'bg-violet-500 hover:bg-violet-600',
    dot: 'bg-violet-400',
  },
  green: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-400/25',
    glow: 'shadow-emerald-500/20',
    primary: 'bg-emerald-500 hover:bg-emerald-600',
    dot: 'bg-emerald-400',
  },
};

export function TeacherEmptyState({
  variant = 'content',
  accent = 'orange',
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tipTitle,
  tipDescription,
  large = false,
}) {
  const Icon = iconMap[variant] || BookOpen;
  const icons = floatingMap[variant] || floatingMap.content;
  const tone = accentClass[accent] || accentClass.orange;

  return (
    <div className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07101c] ${large ? 'p-10 md:p-14' : 'p-8'} text-white shadow-2xl`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(249,115,22,0.14),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
      <div className="pointer-events-none absolute inset-5 rounded-[24px] border border-dashed border-white/10" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="relative mb-7 h-56 w-full max-w-md">
          <div className="absolute left-1/2 top-1/2 h-24 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-white/15" />
          <CloudUpload className={`absolute left-1/2 top-3 h-16 w-16 -translate-x-1/2 ${tone.text} drop-shadow-[0_0_18px_rgba(249,115,22,0.55)]`} />
          <div className={`absolute left-1/2 top-24 h-20 w-36 -translate-x-1/2 rounded-b-[42px] border border-white/10 bg-slate-800/80 shadow-2xl ${tone.glow}`}>
            <div className={`absolute left-1/2 top-0 h-20 w-3 -translate-x-1/2 bg-gradient-to-b from-orange-400 to-transparent ${tone.glow}`} />
            <div className="absolute -left-8 top-0 h-12 w-24 rotate-12 rounded-lg border border-white/10 bg-slate-700/80" />
            <div className="absolute -right-8 top-0 h-12 w-24 -rotate-12 rounded-lg border border-white/10 bg-slate-700/80" />
          </div>

          {icons.map((FloatingIcon, index) => (
            <div
              key={index}
              className={`absolute grid h-14 w-14 place-items-center rounded-2xl border ${tone.border} bg-white/[0.035] ${tone.text}`}
              style={{
                left: index === 0 ? '12%' : index === 1 ? '76%' : '70%',
                top: index === 0 ? '42%' : index === 1 ? '48%' : '72%',
              }}
            >
              <FloatingIcon className="h-6 w-6" />
            </div>
          ))}
        </div>

        <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone.bg} ${tone.text}`}>
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-black tracking-tight md:text-3xl">
          {title}
          <span className={`ml-3 inline-block h-2.5 w-2.5 rounded-full ${tone.dot}`} />
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
          {description}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {primaryLabel ? (
            <Button onClick={onPrimary} className={`${tone.primary} px-7 text-white`}>
              <span className="mr-2 text-lg leading-none">+</span>
              {primaryLabel}
            </Button>
          ) : null}
          {secondaryLabel ? (
            <Button variant="outline" onClick={onSecondary} className="border-white/10 bg-white/[0.035] px-7 text-white hover:bg-white/10">
              <CloudUpload className="mr-2 h-4 w-4" />
              {secondaryLabel}
            </Button>
          ) : null}
        </div>

        {tipDescription ? (
          <div className="mt-8 flex w-full max-w-2xl items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone.bg} ${tone.text}`}>
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              {tipTitle ? <p className="font-bold text-white">{tipTitle}</p> : null}
              <p className="mt-1 text-sm leading-6 text-slate-300">{tipDescription}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
