import { isRecord } from './errors';
import type { LoginPayload } from '../types/session';

/** Giriş/PKCE yanıtının zorunlu alanları gerçekten geldi mi? (ağ sınırında tip koruması) */
export function isLoginPayload(value: unknown): value is LoginPayload {
  return isRecord(value)
    && typeof value.accessToken === 'string'
    && typeof value.refreshToken === 'string'
    && typeof value.expiresAtUtc === 'string'
    && typeof value.refreshTokenExpiresAtUtc === 'string'
    && isRecord(value.user);
}
