/** Kod taşıyan hata — `err.code` ile ayırt edilen API/oturum hataları. */
export type CodedError = Error & { code: string };

export function createCodedError(message: string, code: string): CodedError {
  return Object.assign(new Error(message), { code });
}

/** `unknown` bir hatadan güvenle mesaj okur. */
export function errorMessage(error: unknown, fallback = ''): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  return fallback;
}

/** `unknown` bir değerin düz nesne olup olmadığını daraltır. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
