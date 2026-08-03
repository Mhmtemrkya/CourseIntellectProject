import 'package:flutter/material.dart';

/// Durum rozeti tek kaynağı (masaüstündeki `status-badge.jsx` karşılığı).
///
/// Önce her ekran kendi rengini seçiyordu; aynı durum bir ekranda yeşil,
/// diğerinde turuncuydu. Durum metni normalize edilip ortak sözlükten eşlenir.
enum StatusTone { success, danger, warning, info, brand, neutral }

class StatusStyle {
  const StatusStyle(this.label, this.tone);
  final String label;
  final StatusTone tone;
}

const Map<String, StatusStyle> _statusMap = {
  // Hesap / kayıt
  'active': StatusStyle('Aktif', StatusTone.success),
  'aktif': StatusStyle('Aktif', StatusTone.success),
  'passive': StatusStyle('Pasif', StatusTone.neutral),
  'pasif': StatusStyle('Pasif', StatusTone.neutral),
  'inactive': StatusStyle('Pasif', StatusTone.neutral),
  'suspended': StatusStyle('Askıda', StatusTone.warning),
  'askida': StatusStyle('Askıda', StatusTone.warning),
  'deleted': StatusStyle('Silindi', StatusTone.danger),

  // Ödeme
  'paid': StatusStyle('Ödendi', StatusTone.success),
  'odendi': StatusStyle('Ödendi', StatusTone.success),
  'partial': StatusStyle('Kısmi', StatusTone.warning),
  'kismi': StatusStyle('Kısmi', StatusTone.warning),
  'kismiodeme': StatusStyle('Kısmi Ödeme', StatusTone.warning),
  'overdue': StatusStyle('Gecikti', StatusTone.danger),
  'gecikti': StatusStyle('Gecikti', StatusTone.danger),
  'geciken': StatusStyle('Gecikti', StatusTone.danger),
  'unpaid': StatusStyle('Ödenmedi', StatusTone.danger),
  'odenmedi': StatusStyle('Ödenmedi', StatusTone.danger),
  'pending': StatusStyle('Bekliyor', StatusTone.warning),
  'bekliyor': StatusStyle('Bekliyor', StatusTone.warning),
  'beklemede': StatusStyle('Bekliyor', StatusTone.warning),
  'bekleyen': StatusStyle('Bekliyor', StatusTone.warning),
  'zamaninda': StatusStyle('Zamanında', StatusTone.success),
  'sonrakiay': StatusStyle('Sonraki Ay', StatusTone.info),
  'guncel': StatusStyle('Güncel', StatusTone.warning),
  'upcoming': StatusStyle('Yaklaşan', StatusTone.info),
  'yaklasan': StatusStyle('Yaklaşan', StatusTone.info),
  'refunded': StatusStyle('İade', StatusTone.info),
  'iade': StatusStyle('İade', StatusTone.info),
  'refund': StatusStyle('İade', StatusTone.info),

  // Onay akışı
  'approved': StatusStyle('Onaylandı', StatusTone.success),
  'onaylandi': StatusStyle('Onaylandı', StatusTone.success),
  'rejected': StatusStyle('Reddedildi', StatusTone.danger),
  'reddedildi': StatusStyle('Reddedildi', StatusTone.danger),
  'cancelled': StatusStyle('İptal', StatusTone.neutral),
  'canceled': StatusStyle('İptal', StatusTone.neutral),
  'iptal': StatusStyle('İptal', StatusTone.neutral),
  'iptaledildi': StatusStyle('İptal', StatusTone.neutral),

  // Süreç
  'draft': StatusStyle('Taslak', StatusTone.neutral),
  'taslak': StatusStyle('Taslak', StatusTone.neutral),
  'planned': StatusStyle('Planlandı', StatusTone.info),
  'planlandi': StatusStyle('Planlandı', StatusTone.info),
  'scheduled': StatusStyle('Planlandı', StatusTone.info),
  'inprogress': StatusStyle('Devam Ediyor', StatusTone.brand),
  'devamediyor': StatusStyle('Devam Ediyor', StatusTone.brand),
  'ongoing': StatusStyle('Devam Ediyor', StatusTone.brand),
  'completed': StatusStyle('Tamamlandı', StatusTone.success),
  'tamamlandi': StatusStyle('Tamamlandı', StatusTone.success),
  'done': StatusStyle('Tamamlandı', StatusTone.success),
  'failed': StatusStyle('Başarısız', StatusTone.danger),
  'basarisiz': StatusStyle('Başarısız', StatusTone.danger),

  // Devamsızlık
  'present': StatusStyle('Geldi', StatusTone.success),
  'geldi': StatusStyle('Geldi', StatusTone.success),
  'absent': StatusStyle('Gelmedi', StatusTone.danger),
  'gelmedi': StatusStyle('Gelmedi', StatusTone.danger),
  'excused': StatusStyle('İzinli', StatusTone.info),
  'izinli': StatusStyle('İzinli', StatusTone.info),
  'late': StatusStyle('Geç Geldi', StatusTone.warning),
  'gecgeldi': StatusStyle('Geç Geldi', StatusTone.warning),
};

/// "Kısmi Ödeme", "PartialPayment", "kismi_odeme" → "kismiodeme"
String normalizeStatusKey(Object? value) {
  final lower = (value?.toString() ?? '').trim().toLowerCase();
  const replacements = {
    'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g',
    'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c',
  };
  var normalized = lower;
  replacements.forEach((from, to) => normalized = normalized.replaceAll(from, to));
  return normalized.replaceAll(RegExp(r'[^a-z0-9]'), '');
}

/// Sözlükteki karşılık; bilinmeyen durumda metnin kendisi + nötr ton.
StatusStyle resolveStatus(Object? value) {
  final hit = _statusMap[normalizeStatusKey(value)];
  if (hit != null) return hit;
  final text = (value?.toString() ?? '').trim();
  return StatusStyle(text.isEmpty ? '—' : text, StatusTone.neutral);
}

Color statusToneColor(StatusTone tone, BuildContext context) {
  switch (tone) {
    case StatusTone.success:
      return const Color(0xFF10B981);
    case StatusTone.danger:
      return const Color(0xFFEF4444);
    case StatusTone.warning:
      return const Color(0xFFF59E0B);
    case StatusTone.info:
      return const Color(0xFF0EA5E9);
    case StatusTone.brand:
      return Theme.of(context).colorScheme.primary;
    case StatusTone.neutral:
      return const Color(0xFF64748B);
  }
}

/// Ortak durum rozeti. `status` sözlükten çözülür; `label`/`tone` ile
/// özel durum yazılabilir.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    this.status,
    this.label,
    this.tone,
    this.icon,
    this.dense = false,
  });

  final Object? status;
  final String? label;
  final StatusTone? tone;
  final IconData? icon;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final resolved = resolveStatus(status);
    final color = statusToneColor(tone ?? resolved.tone, context);
    final text = label ?? resolved.label;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 3 : 5,
      ),
      decoration: BoxDecoration(
        // Şeffaf zemin: açık ve koyu temada aynı okunurluk.
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: dense ? 11 : 13, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: dense ? 10 : 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
