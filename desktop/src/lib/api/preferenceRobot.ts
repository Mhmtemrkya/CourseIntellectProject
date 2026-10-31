import { api } from './client';
import type {
  PreferenceChoiceDto,
  PreferenceEstimateDto,
  PreferenceImportResultDto,
  PreferenceMetaDto,
  PreferenceNetInput,
  PreferenceOptionsDto,
  PreferenceSearchRequest,
  PreferenceSearchResultDto,
  SavePreferenceChoicesRequest,
} from '../../types/api/generated';

// ─── Tercih robotu (LGS/YKS) ─────────────────────────────────────────────────
// Veri resmî ÖSYM/MEB yayımlarından; net→puan dönüşümü tahminidir.

export const fetchPreferenceMeta = (exam: string) => api.get<PreferenceMetaDto>('/api/preference-robot/meta', { params: { exam } });
export interface PreferenceOptionsQuery {
  exam: string;
  scoreType?: string;
  level?: string;
  institutionType?: string;
  city?: string;
  university?: string;
}

/** Kademeli filtre seçenekleri: il → üniversite → bölüm; yalnız gerçekten var olan eşleşmeler. */
export const fetchPreferenceOptions = (query: PreferenceOptionsQuery) => {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) if (value) params[key] = value;
  return api.get<PreferenceOptionsDto>('/api/preference-robot/options', { params });
};

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
