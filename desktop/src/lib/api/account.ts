import { api } from './client';
import type {
  ChangePasswordRequest,
  CurrentUserDto,
  PasswordResetRequestDto,
  PasswordResetReviewResponse,
  ReviewPasswordResetRequest,
} from '../../types/api/generated';

export async function changePassword({ currentPassword, newPassword }: ChangePasswordRequest): Promise<CurrentUserDto | null> {
  const payload: ChangePasswordRequest = {
    currentPassword: currentPassword || null,
    newPassword,
  };
  return await api.post<CurrentUserDto>('/api/auth/change-password', payload);
}

export async function requestPasswordReset(email: string): Promise<{ message: string } | null> {
  return await api.post<{ message: string }>('/api/auth/forgot-password', { email });
}

export async function fetchPasswordResetRequests(status: string | null = 'Pending'): Promise<PasswordResetRequestDto[]> {
  const response = await api.get<PasswordResetRequestDto[]>('/api/auth/password-reset-requests', {
    params: status && status !== 'All' ? { status } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function reviewPasswordResetRequest(
  id: string,
  { approved, note = '' }: ReviewPasswordResetRequest,
): Promise<PasswordResetReviewResponse | null> {
  return await api.post<PasswordResetReviewResponse>(`/api/auth/password-reset-requests/${id}/review`, {
    approved,
    note,
  });
}
