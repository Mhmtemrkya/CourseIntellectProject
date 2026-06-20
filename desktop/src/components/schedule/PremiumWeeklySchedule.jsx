import { cn } from '../../lib/utils';
import { normalizeTimeSlot } from '../../lib/scheduleGrid';

const CELL_TONES = [
  { dot: 'bg-sky-400', cell: 'border-sky-500/30 bg-sky-500/10' },
  { dot: 'bg-emerald-400', cell: 'border-emerald-500/30 bg-emerald-500/10' },
  { dot: 'bg-violet-400', cell: 'border-violet-500/30 bg-violet-500/10' },
  { dot: 'bg-amber-400', cell: 'border-amber-500/30 bg-amber-500/10' },
  { dot: 'bg-rose-400', cell: 'border-rose-500/30 bg-rose-500/10' },
  { dot: 'bg-blue-400', cell: 'border-blue-500/30 bg-blue-500/10' },
];

function hashIndex(value, mod) {
  let hash = 0;
  for (const ch of String(value || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % mod;
}

function toneForLesson(lesson) {
  if (lesson.isLive) {
    return { dot: 'bg-[hsl(var(--brand-accent))]', cell: 'border-[hsl(var(--brand-accent)/0.45)] bg-[hsl(var(--brand-accent)/0.12)]', live: true };
  }
  const haystack = `${lesson.className || ''} ${lesson.room || ''} ${lesson.title || ''}`.toLowerCase();
  if (/lab|laboratuvar/.test(haystack)) {
    return { dot: 'bg-cyan-400', cell: 'border-cyan-500/30 bg-cyan-500/10' };
  }
  return CELL_TONES[hashIndex(lesson.title, CELL_TONES.length)];
}

export default function PremiumWeeklySchedule({ days, timeSlots, lessons, weekDates = {}, todayName }) {
  const lessonMap = new Map();
  lessons.forEach((lesson) => {
    lessonMap.set(`${lesson.day || lesson.dateKey || ''}-${normalizeTimeSlot(lesson.time)}`, lesson);
  });
  const gridTemplate = `110px repeat(${days.length}, minmax(150px, 1fr))`;

  return (
    <div className="ci-card overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          {/* Başlık satırı */}
          <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="border-b border-r border-foreground/10 p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saat</div>
            {days.map((day) => {
              const today = todayName === day;
              return (
                <div key={day} className={cn('border-b border-r border-foreground/10 p-3 text-center last:border-r-0', today && 'bg-[hsl(var(--brand-accent)/0.1)]')}>
                  <p className={cn('text-sm font-bold', today ? 'text-[hsl(var(--brand-accent))]' : 'text-foreground')}>{day}</p>
                  {weekDates[day] ? <p className="mt-0.5 text-[11px] text-muted-foreground">{weekDates[day]}</p> : null}
                </div>
              );
            })}
          </div>

          {/* Saat satırları */}
          {timeSlots.map((time) => (
            <div key={time} className="grid" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="border-b border-r border-foreground/10 bg-foreground/[0.02] p-3 text-xs last:border-b-0">
                <p className="font-bold tabular-nums text-foreground">{String(time).split('-')[0]}</p>
                <p className="tabular-nums text-muted-foreground">{String(time).split('-')[1] || ''}</p>
              </div>
              {days.map((day) => {
                const lesson = lessonMap.get(`${day}-${normalizeTimeSlot(time)}`);
                const tone = lesson ? toneForLesson(lesson) : null;
                const today = todayName === day;
                return (
                  <div key={`${day}-${time}`} className={cn('border-b border-r border-foreground/10 p-1.5 last:border-r-0', today && 'bg-[hsl(var(--brand-accent)/0.04)]')}>
                    {lesson ? (
                      <div className={cn('flex h-full min-h-[60px] flex-col justify-center gap-1 rounded-xl border p-2.5 transition-transform hover:-translate-y-0.5', tone.cell)}>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} />
                          <p className="truncate text-[13px] font-semibold text-foreground">{lesson.title || lesson.subject || 'Ders'}</p>
                          {tone.live ? <span className="ml-auto shrink-0 rounded-full bg-[hsl(var(--brand-accent)/0.2)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[hsl(var(--brand-accent))]">Canlı</span> : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">Derslik: {lesson.className || lesson.room || '-'}</p>
                      </div>
                    ) : (
                      <div className="h-full min-h-[60px] rounded-xl" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
