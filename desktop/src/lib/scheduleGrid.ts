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

export const scheduleDayIndex = (day) => {
  const idx = ALL_SCHEDULE_DAYS.indexOf(day);
  return idx === -1 ? 99 : idx;
};

export const normalizeTimeSlot = (value) => String(value || '').trim().replace(/\s+/g, '');

export const sortDays = (days) => [...new Set(days.filter(Boolean))].sort((a, b) => scheduleDayIndex(a) - scheduleDayIndex(b));

export const sortTimeSlots = (slots) => [...new Set(slots.map(normalizeTimeSlot).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'tr-TR', { numeric: true }));

export function deriveScheduleGrid(lessons, fallbackDays = DEFAULT_SCHEDULE_DAYS, fallbackTimeSlots = DEFAULT_TIME_SLOTS) {
  const lessonDays = lessons.map((item) => item.day || item.dateKey).filter(Boolean);
  const lessonTimes = lessons.map((item) => item.time).filter(Boolean);
  return {
    days: sortDays([...fallbackDays, ...lessonDays]),
    timeSlots: sortTimeSlots([...fallbackTimeSlots, ...lessonTimes]),
  };
}
