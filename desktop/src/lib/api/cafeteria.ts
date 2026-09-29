import { api } from './client';
import type { CafeteriaWeekRequest, CafeteriaWeekSnapshot } from '../../types/api/generated';

// --- Cafeteria / Weekly Menu ---

/** weekStart: "yyyy-MM-dd"; verilmezse sunucu içinde bulunulan haftanın pazartesisini alır. */
export async function fetchCafeteriaWeek(weekStart?: string | null): Promise<CafeteriaWeekSnapshot | null> {
  return api.get<CafeteriaWeekSnapshot>('/api/cafeteria/week', {
    params: weekStart ? { weekStart } : undefined,
  });
}

export async function saveCafeteriaWeek(payload: CafeteriaWeekRequest): Promise<CafeteriaWeekSnapshot | null> {
  return api.post<CafeteriaWeekSnapshot>('/api/cafeteria/weeks', payload);
}
