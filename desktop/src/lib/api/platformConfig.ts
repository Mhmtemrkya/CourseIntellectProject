import { api } from './client';
import type { PlatformConfigurationDto, UpsertPlatformConfigurationRequest } from '../../types/api/generated';

export async function fetchPlatformConfigurations(configurationType?: string | null): Promise<PlatformConfigurationDto[] | null> {
  const response = await api.get<PlatformConfigurationDto[]>('/api/platformconfigurations', {
    params: configurationType ? { configurationType } : undefined,
  });
  return response;
}

export async function upsertPlatformConfiguration(payload: UpsertPlatformConfigurationRequest): Promise<PlatformConfigurationDto | null> {
  const response = await api.put<PlatformConfigurationDto>('/api/platformconfigurations', payload);
  return response;
}
