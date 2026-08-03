import { cn } from '@/lib/utils';

/**
 * Durum rozeti tek kaynağı.
 *
 * Önceden her ekran kendi rengini seçiyordu (`bg-red-100 text-red-700` gibi
 * yalnız açık temaya göre ayarlanmış sınıflar); aynı durum bir ekranda yeşil,
 * diğerinde griydi. Artık durum metni normalize edilip ortak sözlükten
 * eşlenir — ton hem açık hem koyu temada okunur.
 */

/** Tonlar: anlam → sınıf. Şeffaf zemin kullanır, iki temada da okunur. */
export const STATUS_TONES = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  brand: 'bg-[hsl(var(--brand-accent)/0.15)] text-[hsl(var(--brand-accent))]',
  neutral: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
};

/**
 * Durum sözlüğü: normalize edilmiş anahtar → { label, tone }.
 * Anahtarlar hem Türkçe metinleri hem backend enum adlarını kapsar.
 */
const STATUS_MAP = {
  // Hesap / kayıt durumu
  active: { label: 'Aktif', tone: 'success' },
  aktif: { label: 'Aktif', tone: 'success' },
  passive: { label: 'Pasif', tone: 'neutral' },
  pasif: { label: 'Pasif', tone: 'neutral' },
  inactive: { label: 'Pasif', tone: 'neutral' },
  suspended: { label: 'Askıda', tone: 'warning' },
  askida: { label: 'Askıda', tone: 'warning' },
  deleted: { label: 'Silindi', tone: 'danger' },

  // Ödeme / tahsilat
  paid: { label: 'Ödendi', tone: 'success' },
  odendi: { label: 'Ödendi', tone: 'success' },
  partial: { label: 'Kısmi', tone: 'warning' },
  kismi: { label: 'Kısmi', tone: 'warning' },
  kismiodeme: { label: 'Kısmi Ödeme', tone: 'warning' },
  overdue: { label: 'Gecikti', tone: 'danger' },
  gecikti: { label: 'Gecikti', tone: 'danger' },
  geciken: { label: 'Gecikti', tone: 'danger' },
  unpaid: { label: 'Ödenmedi', tone: 'danger' },
  odenmedi: { label: 'Ödenmedi', tone: 'danger' },
  pending: { label: 'Bekliyor', tone: 'warning' },
  bekliyor: { label: 'Bekliyor', tone: 'warning' },
  beklemede: { label: 'Bekliyor', tone: 'warning' },
  bekleyen: { label: 'Bekliyor', tone: 'warning' },
  zamaninda: { label: 'Zamanında', tone: 'success' },
  sonrakiay: { label: 'Sonraki Ay', tone: 'info' },
  guncel: { label: 'Güncel', tone: 'warning' },
  upcoming: { label: 'Yaklaşan', tone: 'info' },
  yaklasan: { label: 'Yaklaşan', tone: 'info' },
  refunded: { label: 'İade', tone: 'info' },
  iade: { label: 'İade', tone: 'info' },
  refund: { label: 'İade', tone: 'info' },

  // Onay akışı
  approved: { label: 'Onaylandı', tone: 'success' },
  onaylandi: { label: 'Onaylandı', tone: 'success' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  reddedildi: { label: 'Reddedildi', tone: 'danger' },
  cancelled: { label: 'İptal', tone: 'neutral' },
  canceled: { label: 'İptal', tone: 'neutral' },
  iptal: { label: 'İptal', tone: 'neutral' },
  iptaledildi: { label: 'İptal', tone: 'neutral' },

  // Plan / süreç
  draft: { label: 'Taslak', tone: 'neutral' },
  taslak: { label: 'Taslak', tone: 'neutral' },
  planned: { label: 'Planlandı', tone: 'info' },
  planlandi: { label: 'Planlandı', tone: 'info' },
  scheduled: { label: 'Planlandı', tone: 'info' },
  inprogress: { label: 'Devam Ediyor', tone: 'brand' },
  devamediyor: { label: 'Devam Ediyor', tone: 'brand' },
  ongoing: { label: 'Devam Ediyor', tone: 'brand' },
  completed: { label: 'Tamamlandı', tone: 'success' },
  tamamlandi: { label: 'Tamamlandı', tone: 'success' },
  done: { label: 'Tamamlandı', tone: 'success' },
  failed: { label: 'Başarısız', tone: 'danger' },
  basarisiz: { label: 'Başarısız', tone: 'danger' },

  // Devamsızlık
  present: { label: 'Geldi', tone: 'success' },
  geldi: { label: 'Geldi', tone: 'success' },
  absent: { label: 'Gelmedi', tone: 'danger' },
  gelmedi: { label: 'Gelmedi', tone: 'danger' },
  excused: { label: 'İzinli', tone: 'info' },
  izinli: { label: 'İzinli', tone: 'info' },
  late: { label: 'Geç Geldi', tone: 'warning' },
  gecgeldi: { label: 'Geç Geldi', tone: 'warning' },
};

/** "Kısmi Ödeme", "PartialPayment", "kismi_odeme" → "kismiodeme" */
export function normalizeStatusKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replace(/[^a-z0-9]/g, '');
}

/** Sözlükteki karşılık; bilinmeyen durumda metnin kendisi + nötr ton. */
export function resolveStatus(value, { fallbackTone = 'neutral' } = {}) {
  const key = normalizeStatusKey(value);
  const hit = STATUS_MAP[key];
  if (hit) return hit;
  const text = String(value ?? '').trim();
  return { label: text || '—', tone: fallbackTone };
}

/**
 * Ortak durum rozeti.
 * `status` sözlükten çözülür; `label`/`tone` verilerek özel durum yazılabilir.
 */
export function StatusBadge({ status, label, tone, className, size = 'md', children, ...rest }) {
  const resolved = resolveStatus(status);
  const finalTone = tone || resolved.tone;

  return (
    <span
      data-status={normalizeStatusKey(status)}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        STATUS_TONES[finalTone] || STATUS_TONES.neutral,
        className,
      )}
      {...rest}
    >
      {/* İkon eklemek isteyen ekran içerik geçebilir; yoksa sözlük etiketi. */}
      {children ?? label ?? resolved.label}
    </span>
  );
}

export default StatusBadge;
