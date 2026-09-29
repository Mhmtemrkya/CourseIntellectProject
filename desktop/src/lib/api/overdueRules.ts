import { api } from './client';

/**
 * Gecikme hatırlatma kuralı. Sunucu bu listeyi olduğu gibi saklar (şekli ekran
 * belirler); `id` yeni kuralda Date.now() sayısıdır, eski kayıtlarda metin olabilir.
 */
export interface OverdueRule {
  id: number | string;
  name: string;
  daysAfterDue: number;
  channel: string;
  template: string;
  enabled: boolean;
}

// ============ Overdue Rules ============
// Finansta otomatik hatırlatma kuralları tenant bazlı backend'de tutulur.
export async function fetchOverdueRules(): Promise<OverdueRule[]> {
  const response = await api.get<{ rules?: OverdueRule[] }>('/api/overdue-rules');
  return Array.isArray(response?.rules) ? response.rules : [];
}

export async function saveOverdueRules(rules: OverdueRule[] | null | undefined): Promise<OverdueRule[]> {
  const response = await api.put<{ rules?: OverdueRule[] }>('/api/overdue-rules', { rules: Array.isArray(rules) ? rules : [] });
  return Array.isArray(response?.rules) ? response.rules : [];
}
