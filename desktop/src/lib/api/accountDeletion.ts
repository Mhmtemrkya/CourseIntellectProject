import { api } from './client';

// Hesap & kurum silme uçları. Reauth (parola) sunucuda doğrulanır.

export interface AccountDeletionStatus {
  id: string | null;
  status: string;
  requestedAtUtc: string | null;
  finalizeAtUtc: string | null;
  remainingDays: number | null;
  canCancel: boolean;
  retainedRecordsExplanation: string[];
}

export interface AccountDeletionQueueItem {
  id: string;
  userId: string;
  userDisplayName: string;
  requesterRole: string;
  status: string;
  requestedAtUtc: string;
  finalizeAtUtc: string;
  remainingDays: number;
  requiresPlatform: boolean;
}

export interface InstitutionDeletionImpact {
  userCount: number;
  studentCount: number;
  fileCount: number;
  financeRecordCount: number;
  educationRecordCount: number;
}

export interface InstitutionDeletionStatus {
  id: string | null;
  status: string;
  requestedAtUtc: string | null;
  finalizeAtUtc: string | null;
  rejectReason: string | null;
  impact: InstitutionDeletionImpact | null;
}

export interface InstitutionDeletionQueueItem {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
  requestedAtUtc: string;
  finalizeAtUtc: string | null;
  impact: InstitutionDeletionImpact;
}

// ---- Kişisel hesap silme ----

export function requestAccountDeletion(password: string, successorAdminUserId?: string) {
  return api.post<AccountDeletionStatus>('/api/account-deletion/request', {
    password,
    confirm: true,
    successorAdminUserId: successorAdminUserId ?? null,
  });
}

export async function getMyAccountDeletion(): Promise<AccountDeletionStatus | null> {
  return await api.get<AccountDeletionStatus>('/api/account-deletion/mine');
}

export function cancelMyAccountDeletion() {
  return api.post<AccountDeletionStatus>('/api/account-deletion/mine/cancel', {});
}

export interface SuccessorCandidate {
  id: string;
  fullName: string;
  role: string;
}

export async function getSuccessorCandidates(): Promise<SuccessorCandidate[]> {
  const res = await api.get<SuccessorCandidate[]>('/api/account-deletion/successor-candidates');
  return Array.isArray(res) ? res : [];
}

export async function getTenantDeletionQueue(): Promise<AccountDeletionQueueItem[]> {
  const res = await api.get<AccountDeletionQueueItem[]>('/api/account-deletion');
  return Array.isArray(res) ? res : [];
}

// ---- Kurum silme ----

export function requestInstitutionDeletion(password: string) {
  return api.post<InstitutionDeletionStatus>('/api/institution-deletion/request', { password, confirm: true });
}

export async function getMyInstitutionDeletion(): Promise<InstitutionDeletionStatus | null> {
  return await api.get<InstitutionDeletionStatus>('/api/institution-deletion/mine');
}

// ---- Platform (superadmin) ----

export async function getPlatformAccountDeletions(): Promise<AccountDeletionQueueItem[]> {
  const res = await api.get<AccountDeletionQueueItem[]>('/api/platformops/account-deletions');
  return Array.isArray(res) ? res : [];
}

export async function getPlatformInstitutionDeletions(): Promise<InstitutionDeletionQueueItem[]> {
  const res = await api.get<InstitutionDeletionQueueItem[]>('/api/platformops/institution-deletions');
  return Array.isArray(res) ? res : [];
}

export function decideInstitutionDeletion(id: string, approve: boolean, rejectReason?: string) {
  return api.post<InstitutionDeletionStatus>(`/api/platformops/institution-deletions/${id}/decide`, {
    approve,
    rejectReason: rejectReason ?? null,
  });
}
