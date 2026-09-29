import { Badge } from '../ui/badge';

function lessonDay(lesson) {
  return lesson.day || lesson.dateKey || '';
}

export default function WeeklyScheduleGrid({ days, timeSlots, lessons, emptyText = 'Boş slot' }) {
  const lessonMap = new Map();
  lessons.forEach((lesson) => {
    lessonMap.set(`${lessonDay(lesson)}-${lesson.time}`, lesson);
  });

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
      <div className="min-w-[920px]">
        <div className="grid border-b bg-muted/50" style={{ gridTemplateColumns: `150px repeat(${days.length}, minmax(150px, 1fr))` }}>
          <div className="border-r p-4 text-sm font-semibold text-muted-foreground">Saat</div>
          {days.map((day) => (
            <div key={day} className="border-r p-4 text-center font-semibold text-foreground last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        {timeSlots.map((time) => (
          <div key={time} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `150px repeat(${days.length}, minmax(150px, 1fr))` }}>
            <div className="border-r bg-muted/40 p-4 text-sm">
              <p className="font-semibold text-foreground">{String(time).split('-')[0]}</p>
              <p className="text-muted-foreground">{String(time).split('-')[1] || ''}</p>
            </div>
            {days.map((day) => {
              const lesson = lessonMap.get(`${day}-${time}`);
              return (
                <div key={`${day}-${time}`} className="border-r p-2 last:border-r-0">
                  {lesson ? (
                    <div className="min-h-[92px] rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{lesson.title || lesson.subject || 'Ders'}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{lesson.teacher || lesson.className || ''}</p>
                        </div>
                        {lesson.className ? <Badge variant="outline" className="shrink-0">{lesson.className}</Badge> : null}
                      </div>
                      {lesson.platform ? <p className="mt-3 text-xs text-muted-foreground">{lesson.platform}</p> : null}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[92px] items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground/60">
                      {emptyText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
