import { api } from './client';
import type { ParentCredentialsDto } from '../../types/api/generated';

export interface CreateParentInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

export async function createParent({ fullName, phone, email }: CreateParentInput): Promise<ParentCredentialsDto | null> {
  return await api.post<ParentCredentialsDto>('/api/parents', {
    fullName,
    phone: phone || '',
    email: email || '',
  });
}
