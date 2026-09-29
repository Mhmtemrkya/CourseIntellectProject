export const DEFAULT_SCHEDULE_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
export const ALL_SCHEDULE_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const DEFAULT_TIME_SLOTS = [
  '08:30-09:15',
  '09:25-10:10',
  '10:20-11:05',
  '11:15-12:00',
  '13:00-13:45',
  '13:55-14:40',
  '14:50-15:35',
];

export interface ScheduleGridLesson {
  day?: string | null;
  dateKey?: string | null;
  time?: string | null;
}

export interface ScheduleGrid {
  days: string[];
  timeSlots: string[];
}

export const scheduleDayIndex = (day: string): number => {
  const idx = ALL_SCHEDULE_DAYS.indexOf(day);
  return idx === -1 ? 99 : idx;
};

export const normalizeTimeSlot = (value: unknown): string => String(value || '').trim().replace(/\s+/g, '');

export const sortDays = (days: ReadonlyArray<string | null | undefined>): string[] => [...new Set(days.filter((day): day is string => Boolean(day)))].sort((a, b) => scheduleDayIndex(a) - scheduleDayIndex(b));

export const sortTimeSlots = (slots: readonly unknown[]): string[] => [...new Set(slots.map(normalizeTimeSlot).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'tr-TR', { numeric: true }));

export function deriveScheduleGrid(
  lessons: readonly ScheduleGridLesson[],
  fallbackDays: readonly string[] = DEFAULT_SCHEDULE_DAYS,
  fallbackTimeSlots: readonly string[] = DEFAULT_TIME_SLOTS,
): ScheduleGrid {
  const lessonDays = lessons.map((item) => item.day || item.dateKey).filter(Boolean);
  const lessonTimes = lessons.map((item) => item.time).filter(Boolean);
  return {
    days: sortDays([...fallbackDays, ...lessonDays]),
    timeSlots: sortTimeSlots([...fallbackTimeSlots, ...lessonTimes]),
  };
}
