import { api } from './client';
import type {
  CreateStaffRequest,
  StaffCredentialsDto,
  StaffSummaryDto,
  UpdateStaffAssignmentRequest,
  UpdateStaffRequest,
} from '../../types/api/generated';

export async function fetchStaff(role?: string | null): Promise<StaffSummaryDto[] | null> {
  const response = await api.get<StaffSummaryDto[]>('/api/staff', {
    params: role ? { role } : undefined,
  });
  return response;
}

export async function createStaff(payload: CreateStaffRequest, branchId?: string | null): Promise<StaffCredentialsDto | null> {
  const config = branchId ? { headers: { 'X-Branch-Filter': branchId } } : undefined;
  const response = await api.post<StaffCredentialsDto>('/api/staff', payload, config);
  return response;
}

export async function deleteStaffUser(userId: string): Promise<void> {
  await api.delete(`/api/staff/users/${userId}`);
}

export async function updateStaff(staffId: string, payload: UpdateStaffRequest): Promise<StaffSummaryDto | null> {
  const response = await api.put<StaffSummaryDto>(`/api/staff/${staffId}`, payload);
  return response;
}

// Var olan kullanıcının rol/şube/özel rol atamasını günceller (ev grant'ı yenilenir).
export async function updateStaffAssignment(userId: string, payload: UpdateStaffAssignmentRequest): Promise<{ message: string } | null> {
  return api.put<{ message: string }>(`/api/staff/users/${userId}/assignment`, payload);
}
