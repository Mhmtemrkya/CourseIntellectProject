import { api } from './client';
import type { AddOpticalTopicRequest, AddOpticalTopicResultDto, OpticalTopicCatalogDto } from '../../types/api/generated';

// ─── Ders konusu listesi ─────────────────────────────────────────────────────
// Optik cevap anahtarı ve soru stüdyosu ortak kullanır: hazır katalog + kurumun eklediği konular
// + kurumda daha önce yazılmış konular (ders başına).

export function fetchTopics(level: string, subjects: readonly string[]) {
  const query = new URLSearchParams();
  if (level) query.set('level', level);
  subjects.forEach((subject) => query.append('subject', subject));
  return api.get<OpticalTopicCatalogDto>(`/api/topics?${query.toString()}`);
}
export const addTopic = (payload: AddOpticalTopicRequest) => api.post<AddOpticalTopicResultDto>('/api/topics', payload);
export const deleteTopic = (id: string) => api.delete<null>(`/api/topics/${id}`);
