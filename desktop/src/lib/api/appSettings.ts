import { api } from './client';
import type { AppSettingDto, UpsertAppSettingRequest } from '../../types/api/generated';

export async function fetchAppSettings(category?: string | null): Promise<AppSettingDto[]> {
  const response = await api.get<AppSettingDto[]>('/api/appsettings', {
    params: category ? { category } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function saveAppSettings(items: UpsertAppSettingRequest[]): Promise<AppSettingDto[]> {
  const response = await api.put<AppSettingDto[]>('/api/appsettings', items);
  return Array.isArray(response) ? response : [];
}
