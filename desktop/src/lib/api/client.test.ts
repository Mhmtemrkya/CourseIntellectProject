import { describeApiError } from './client';

describe('describeApiError', () => {
  it('keeps a business-rule explanation and adds a next step', () => {
    expect(describeApiError(
      { message: 'Ehliyet sınıfı, teorik sınıfın ehliyet sınıfıyla uyuşmuyor.' },
      400,
      'POST',
    )).toBe(
      'Ehliyet sınıfı, teorik sınıfın ehliyet sınıfıyla uyuşmuyor. '
      + 'Yapmanız gereken: Formdaki bilgileri ve zorunlu alanları kontrol edip tekrar deneyin.',
    );
  });

  it('hides technical server status text and preserves the support trace', () => {
    const message = describeApiError(
      { message: 'Request failed (500)', traceId: 'trace-123' },
      500,
      'DELETE',
    );

    expect(message).toContain('Silme işlemi sırasında beklenmeyen bir sorun oluştu.');
    expect(message).toContain('Takip kodu: trace-123.');
    expect(message).not.toContain('500');
    expect(message).not.toContain('Request failed');
  });

  it('explains permission errors with an actionable instruction', () => {
    expect(describeApiError(null, 403, 'PUT')).toBe(
      'Güncelleme sırasında işlem tamamlanamadı. '
      + 'Yapmanız gereken: Bu işlem için kurum yöneticinizden gerekli yetkiyi isteyin.',
    );
  });
});
