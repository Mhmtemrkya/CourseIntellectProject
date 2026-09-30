import { api } from './client';
import type { LegalConsentDecisionRequest, LegalConsentResponse } from '../../types/api/generated';

/** Oturumdaki kullanıcının geçerli metin sürümündeki son kararı; yoksa null (204). */
export async function fetchMyLegalConsent(): Promise<LegalConsentResponse | null> {
  return api.get<LegalConsentResponse>('/api/legal-consent/me');
}

/** Kararı sunucuya kaydeder (eklemeli; kimlik, IP ve zaman sunucuda alınır). */
export async function recordLegalConsent(payload: LegalConsentDecisionRequest): Promise<LegalConsentResponse | null> {
  return api.post<LegalConsentResponse>('/api/legal-consent', payload);
}
