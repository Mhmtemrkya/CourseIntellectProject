import { api } from './client';
import type { AdminUserListItemDto, PagedResult } from '../../types/api/generated';

// --- User Directory (Admin) ---

export async function fetchUsers(page = 1, pageSize = 200): Promise<PagedResult<AdminUserListItemDto> | null> {
  const response = await api.get<PagedResult<AdminUserListItemDto>>('/api/users', { params: { page, pageSize } });
  return response;
}
