import { api } from './client';
import type {
  OpticalExamDto,
  OpticalExamResultsDto,
  OpticalExamSummaryDto,
  OpticalImportResultDto,
  OpticalMatchOverrideDto,
  OpticalPreviewDto,
  OpticalStudentCandidateDto,
  OpticalTemplateDto,
  SaveOpticalExamRequest,
  SaveOpticalTemplateRequest,
} from '../../types/api/generated';

// ─── Optik denemeler ─────────────────────────────────────────────────────────
// Şablon (kolon düzeni) → deneme (cevap anahtarı + konular) → önizleme → içe aktarma.

export const fetchOpticalTemplates = () => api.get<OpticalTemplateDto[]>('/api/optical-exams/templates');
export const saveOpticalTemplate = (id: string | null, payload: SaveOpticalTemplateRequest) =>
  id ? api.put<OpticalTemplateDto>(`/api/optical-exams/templates/${id}`, payload) : api.post<OpticalTemplateDto>('/api/optical-exams/templates', payload);
export const deleteOpticalTemplate = (id: string) => api.delete<null>(`/api/optical-exams/templates/${id}`);

export const fetchOpticalExams = () => api.get<OpticalExamSummaryDto[]>('/api/optical-exams');
export const fetchOpticalExam = (id: string) => api.get<OpticalExamDto>(`/api/optical-exams/${id}`);
export const saveOpticalExam = (id: string | null, payload: SaveOpticalExamRequest) =>
  id ? api.put<OpticalExamDto>(`/api/optical-exams/${id}`, payload) : api.post<OpticalExamDto>('/api/optical-exams', payload);
export const deleteOpticalExam = (id: string) => api.delete<null>(`/api/optical-exams/${id}`);

export function previewOpticalFile(id: string, file: File, encoding: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('encoding', encoding);
  return api.post<OpticalPreviewDto>(`/api/optical-exams/${id}/preview`, form);
}

export function importOpticalFile(id: string, file: File, encoding: string, overrides: OpticalMatchOverrideDto[]) {
  const form = new FormData();
  form.append('file', file);
  form.append('encoding', encoding);
  form.append('overrides', JSON.stringify(overrides));
  return api.post<OpticalImportResultDto>(`/api/optical-exams/${id}/import`, form);
}

export const fetchOpticalResults = (id: string) => api.get<OpticalExamResultsDto>(`/api/optical-exams/${id}/results`);
export const searchOpticalStudents = (search: string) =>
  api.get<OpticalStudentCandidateDto[]>('/api/optical-exams/students', { params: { search } });
