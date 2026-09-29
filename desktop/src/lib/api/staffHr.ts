import { api } from './client';
import type {
  AssignAssetRequest,
  CreateLeaveRequest,
  LeaveBalanceDto,
  LeaveDecisionRequest,
  StaffAssetDto,
  StaffLeaveDto,
} from '../../types/api/generated';

export interface LeaveQuery {
  status?: string | null;
  staffName?: string | null;
}

export async function fetchLeaves(params?: LeaveQuery): Promise<StaffLeaveDto[]> {
  const response = await api.get<StaffLeaveDto[]>('/api/staff-hr/leaves', { params });
  return Array.isArray(response) ? response : [];
}

export async function createLeave(payload: CreateLeaveRequest): Promise<StaffLeaveDto | null> {
  const response = await api.post<StaffLeaveDto>('/api/staff-hr/leaves', payload);
  return response;
}

export async function decideLeave(id: string, payload: LeaveDecisionRequest): Promise<StaffLeaveDto | null> {
  const response = await api.post<StaffLeaveDto>(`/api/staff-hr/leaves/${id}/decide`, payload);
  return response;
}

export async function fetchLeaveBalance(staffName: string): Promise<LeaveBalanceDto | null> {
  const response = await api.get<LeaveBalanceDto>('/api/staff-hr/leave-balance', { params: { staffName } });
  return response;
}

export async function fetchStaffAssets(params?: { staffName?: string | null }): Promise<StaffAssetDto[]> {
  const response = await api.get<StaffAssetDto[]>('/api/staff-hr/assets', { params });
  return Array.isArray(response) ? response : [];
}

export async function assignStaffAsset(payload: AssignAssetRequest): Promise<StaffAssetDto | null> {
  const response = await api.post<StaffAssetDto>('/api/staff-hr/assets', payload);
  return response;
}

export async function returnStaffAsset(id: string): Promise<StaffAssetDto | null> {
  const response = await api.post<StaffAssetDto>(`/api/staff-hr/assets/${id}/return`);
  return response;
}
