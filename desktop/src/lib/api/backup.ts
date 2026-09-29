import { api } from './client';

/** GET /api/tenant-backup/summary. */
export interface TenantBackupSummary {
  institutionName: string;
  institutionType: string;
  tableCount: number;
  students: number;
  staff: number;
  documents: number;
  payments: number;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

// ── Kurum yedeği ──────────────────────────────────────────────────────────────
export const fetchTenantBackupSummary = () => api.get<TenantBackupSummary>('/api/tenant-backup/summary');

// Arşiv sunucuda tutulmaz, doğrudan akıtılır. Not: fetch tabanlı istemci ilerleme
// olayı üretmez; `_onProgress` geriye uyum için imzada durur, hiç çağrılmaz
// (önceki `onDownloadProgress`/`timeout` seçenekleri de istemcide yok sayılıyordu).
export const downloadTenantBackup = (includeFiles = true, _onProgress?: (event: unknown) => void) =>
  api.get('/api/tenant-backup/download', {
    params: { includeFiles },
    responseType: 'blob',
  });
