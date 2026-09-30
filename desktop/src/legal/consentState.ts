import { legalConsentVersion } from './legalContent';

// KVKK/yasal onay kararının yerel kaydı (LegalConsentGate yazar). Tanıtım turu
// gibi ekran üstü katmanlar onay verilmeden açılmamak için buradan okur.
export const LEGAL_CONSENT_STATUS_KEY = 'courseintellect.legalConsent.status';
export const LEGAL_CONSENT_VERSION_KEY = 'courseintellect.legalConsent.version';
export const LEGAL_CONSENT_DECIDED_AT_KEY = 'courseintellect.legalConsent.decidedAt';

/** Karar değişince yayınlanan pencere olayı. */
export const LEGAL_CONSENT_CHANGED_EVENT = 'ci-legal-consent-changed';

export type LegalConsentStatus = 'accepted' | 'declined' | 'pending';

export function readLegalConsentStatus(): LegalConsentStatus {
  if (typeof window === 'undefined') return 'accepted';
  try {
    const status = window.localStorage.getItem(LEGAL_CONSENT_STATUS_KEY);
    const version = window.localStorage.getItem(LEGAL_CONSENT_VERSION_KEY);
    if (version !== legalConsentVersion) return 'pending';
    return status === 'accepted' || status === 'declined' ? status : 'pending';
  } catch {
    return 'pending';
  }
}

export function notifyLegalConsentChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LEGAL_CONSENT_CHANGED_EVENT));
}
