import { api } from './client';
import type {
  PreferenceChoiceDto,
  PreferenceEstimateDto,
  PreferenceImportResultDto,
  PreferenceMetaDto,
  PreferenceNetInput,
  PreferenceSearchRequest,
  PreferenceSearchResultDto,
  SavePreferenceChoicesRequest,
} from '../../types/api/generated';

// ─── Tercih robotu (LGS/YKS) ─────────────────────────────────────────────────
// Veri resmî ÖSYM/MEB yayımlarından; net→puan dönüşümü tahminidir.

export const fetchPreferenceMeta = (exam: string) => api.get<PreferenceMetaDto>('/api/preference-robot/meta', { params: { exam } });
export const estimatePreferenceScore = (payload: PreferenceNetInput) => api.post<PreferenceEstimateDto>('/api/preference-robot/estimate', payload);
export const searchPreferencePrograms = (payload: PreferenceSearchRequest) => api.post<PreferenceSearchResultDto>('/api/preference-robot/search', payload);
export const fetchPreferenceChoices = (exam: string) => api.get<PreferenceChoiceDto[]>('/api/preference-robot/choices', { params: { exam } });
export const savePreferenceChoices = (payload: SavePreferenceChoicesRequest) => api.put<PreferenceChoiceDto[]>('/api/preference-robot/choices', payload);

/** Platform yöneticisi: MEB LGS taban puanı CSV'si (kaynak adı ve https adresi zorunlu). */
export function importLgsPreferenceData(year: number, source: string, sourceUrl: string, file: Blob) {
  const formData = new FormData();
  formData.append('year', String(year));
  formData.append('source', source);
  formData.append('sourceUrl', sourceUrl);
  formData.append('file', file);
  return api.post<PreferenceImportResultDto>('/api/platform/preference-data/lgs', formData);
}
