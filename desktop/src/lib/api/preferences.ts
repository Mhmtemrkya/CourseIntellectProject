import { api } from './client';

/**
 * Kullanıcı tercihleri serbest biçimli bir JSON nesnesidir (sunucu olduğu gibi
 * saklar). Anahtarları okuyan ekran kendi beklediği şekle daraltır.
 */
export type UserPreferences = Record<string, unknown>;

// ============ User Preferences ============
// Kullanıcıya özel ayarlar (bildirim tercihleri vb.) backend'de
// PlatformConfigurations tablosunda saklanır. localStorage yerine bu kullanılır.
export async function fetchUserPreferences(): Promise<UserPreferences> {
  const response = await api.get<{ preferences?: UserPreferences }>('/api/user-preferences');
  return response?.preferences ?? {};
}

export async function saveUserPreferences(preferences: UserPreferences | null | undefined): Promise<UserPreferences> {
  const response = await api.put<{ preferences?: UserPreferences }>('/api/user-preferences', preferences ?? {});
  return response?.preferences ?? {};
}
