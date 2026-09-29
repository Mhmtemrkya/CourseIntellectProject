import { api } from './client';
import type {
  ConsentContextKind,
  ConsentContextKindDto,
  ConsentDocumentDto,
  ConsentFormDto,
  ConsentStationDto,
  ConsentStationFormDto,
  ConsentStatusDto,
  ConsentTemplateDto,
  CreateConsentFormRequest,
  OpenConsentSessionRequest,
  SaveConsentTemplateRequest,
  SignConsentFormRequest,
  UpdateConsentFormRequest,
} from '../../types/api/generated';

export interface ConsentStatusQuery {
  contextKind?: ConsentContextKind | null;
  contextKey?: string | null;
  contextRefId?: string | null;
}

// ─── Onam / izin formları ────────────────────────────────────────────────────
// Sunucu tarafı: /api/consent. Okuma uçlarında paket kapısı yoktur — paket düşse
// bile daha önce imzalanmış belgeler görüntülenip indirilebilir.

export async function fetchConsentCatalog(): Promise<{ contextKinds: ConsentContextKindDto[] } | null> {
  return api.get<{ contextKinds: ConsentContextKindDto[] }>('/api/consent/catalog');
}

export async function fetchConsentTemplates(includeInactive = true): Promise<ConsentTemplateDto[]> {
  const response = await api.get<ConsentTemplateDto[]>('/api/consent/templates', { params: { includeInactive } });
  return Array.isArray(response) ? response : [];
}

export async function createConsentTemplate(payload: SaveConsentTemplateRequest): Promise<ConsentTemplateDto | null> {
  return api.post<ConsentTemplateDto>('/api/consent/templates', payload);
}

export async function updateConsentTemplate(id: string, payload: SaveConsentTemplateRequest): Promise<ConsentTemplateDto | null> {
  return api.put<ConsentTemplateDto>(`/api/consent/templates/${id}`, payload);
}

export async function deleteConsentTemplate(id: string): Promise<boolean | null> {
  return api.delete<boolean>(`/api/consent/templates/${id}`);
}

export async function downloadConsentTemplatePreview(id: string): Promise<Blob | null> {
  return api.get(`/api/consent/templates/${id}/preview`, { responseType: 'blob' });
}

/// Hazır PDF yükler ve künyesini döner (id, dosya adı, sayfa sayısı).
/// Dosya statik /uploads altına DEĞİL veritabanına yazılır; okuması da yetkilidir.
export async function uploadConsentDocument(file: Blob): Promise<ConsentDocumentDto | null> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<ConsentDocumentDto>('/api/consent/documents', formData);
}

export async function downloadConsentDocument(documentId: string): Promise<Blob | null> {
  return api.get(`/api/consent/documents/${documentId}`, { responseType: 'blob' });
}

/// Kaydın dayandığı özgün belge — tablet imzadan önce bunu gösterir.
export async function downloadConsentFormDocument(formId: string): Promise<Blob | null> {
  return api.get(`/api/consent/forms/${formId}/document`, { responseType: 'blob' });
}

export async function fetchStudentConsentForms(studentProfileId: string): Promise<ConsentFormDto[]> {
  const response = await api.get<ConsentFormDto[]>(`/api/consent/students/${studentProfileId}`);
  return Array.isArray(response) ? response : [];
}

export async function fetchConsentStatus(studentProfileId: string, params: ConsentStatusQuery = {}): Promise<ConsentStatusDto | null> {
  return api.get<ConsentStatusDto>(`/api/consent/students/${studentProfileId}/status`, { params });
}

export async function fetchAppointmentConsentStatus(appointmentId: string): Promise<ConsentStatusDto | null> {
  return api.get<ConsentStatusDto>(`/api/consent/appointments/${appointmentId}/status`);
}

export async function fetchConsentForm(id: string): Promise<ConsentFormDto | null> {
  return api.get<ConsentFormDto>(`/api/consent/forms/${id}`);
}

export async function createConsentForm(payload: CreateConsentFormRequest): Promise<ConsentFormDto | null> {
  return api.post<ConsentFormDto>('/api/consent/forms', payload);
}

export async function updateConsentForm(id: string, payload: UpdateConsentFormRequest): Promise<ConsentFormDto | null> {
  return api.put<ConsentFormDto>(`/api/consent/forms/${id}`, payload);
}

export async function cancelConsentForm(id: string): Promise<boolean | null> {
  return api.delete<boolean>(`/api/consent/forms/${id}`);
}

export async function downloadConsentFormPdf(id: string): Promise<Blob | null> {
  return api.get(`/api/consent/forms/${id}/pdf`, { responseType: 'blob' });
}

export async function dispatchConsentFormToStation(
  id: string,
  stationName: OpenConsentSessionRequest['stationName'],
  expiresInMinutes?: OpenConsentSessionRequest['expiresInMinutes'],
): Promise<ConsentFormDto | null> {
  return api.post<ConsentFormDto>(`/api/consent/forms/${id}/session`, { stationName, expiresInMinutes });
}

export async function revokeConsentFormSession(id: string): Promise<ConsentFormDto | null> {
  return api.delete<ConsentFormDto>(`/api/consent/forms/${id}/session`);
}

export async function fetchConsentStations(): Promise<ConsentStationDto[]> {
  const response = await api.get<ConsentStationDto[]>('/api/consent/stations');
  return Array.isArray(response) ? response : [];
}

/// Tablet yoklaması: bekleyen form yoksa sunucu 204 döner ve istemci null görür.
export async function pollConsentStation(station: string | null | undefined): Promise<ConsentStationFormDto | null> {
  return api.get<ConsentStationFormDto>('/api/consent/station/pending', { params: { station } });
}

export async function signConsentForm(token: string, payload: SignConsentFormRequest): Promise<ConsentFormDto | null> {
  return api.post<ConsentFormDto>(`/api/consent/session/${token}/sign`, payload);
}
