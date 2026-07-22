import 'package:flutter/material.dart';

import 'admin_ui.dart';
import 'responsive_layout.dart';

/// Sürücü kursu ekranlarının ortak görsel dili. Okul tarafındaki [AdminScaffold]
/// / [AdminPanel] kalıbının aynısını kullanır ki iki kurum türü yan yana tek
/// ürün gibi görünsün; buradaki parçalar yalnızca sürücü kursuna özgü olanlar
/// (KPI kartı, durum rozeti, kayıt grafiği, boş durum).
class DrivingScaffold extends StatelessWidget {
  final PreferredSizeWidget? appBar;
  final Widget child;
  final Widget? floatingActionButton;

  const DrivingScaffold({
    super.key,
    this.appBar,
    required this.child,
    this.floatingActionButton,
  });

  @override
  Widget build(BuildContext context) => AdminScaffold(
    appBar: appBar,
    floatingActionButton: floatingActionButton,
    child: child,
  );
}

/// Sayfa başındaki gradyanlı kimlik kartı. Okul tarafındaki [AdminHeroCard] ile
/// aynı geometri; rengi tema vurgusundan alır, sabit turuncu değil.
class DrivingHero extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String description;
  final IconData icon;
  final List<Widget> metrics;

  const DrivingHero({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.icon = Icons.directions_car_filled_rounded,
    this.metrics = const [],
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF08111F),
            Color.lerp(const Color(0xFF08111F), accent, 0.32) ??
                const Color(0xFF08111F),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.24),
            blurRadius: 34,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: accent.withValues(alpha: 0.28)),
                ),
                child: Text(
                  eyebrow,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              Icon(icon, color: Colors.white.withValues(alpha: 0.9), size: 30),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            title,
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
              height: 1.45,
            ),
          ),
          if (metrics.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(children: metrics),
          ],
        ],
      ),
    );
  }
}

/// Hero içindeki küçük metrik kutusu (okul tarafındaki AdminHeroMetric ile aynı).
class DrivingHeroMetric extends StatelessWidget {
  final String label;
  final String value;

  const DrivingHeroMetric({
    super.key,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) =>
      AdminHeroMetric(label: label, value: value);
}

/// Kart yüzeyi — tüm sürücü kursu panelleri bunu kullanır.
class DrivingPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const DrivingPanel({
    super.key,
    required this.child,
    this.padding,
    this.margin,
  });

  @override
  Widget build(BuildContext context) =>
      AdminPanel(padding: padding, margin: margin, child: child);
}

class DrivingSectionTitle extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const DrivingSectionTitle({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) => AdminSectionTitle(
    title: title,
    actionLabel: actionLabel,
    onAction: onAction,
  );
}

/// KPI kartı: ikon rozeti + büyük değer + etiket. Panel yüzeyiyle aynı kenarlık
/// ve gölgeyi taşır, böylece ızgara içinde okul kartlarıyla aynı görünür.
class DrivingKpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const DrivingKpiCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: DrivingPanel(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    color.withValues(alpha: 0.85),
                    Color.lerp(color, Colors.black, 0.25) ?? color,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.28),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Icon(icon, color: Colors.white, size: 19),
            ),
            const Spacer(),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum DrivingTone { neutral, success, info, warning, danger, accent }

/// Durum rozeti — desktop'taki PremiumStatusPill'in mobil karşılığı.
class DrivingStatusPill extends StatelessWidget {
  final String label;
  final DrivingTone tone;
  final IconData? icon;

  const DrivingStatusPill({
    super.key,
    required this.label,
    this.tone = DrivingTone.neutral,
    this.icon,
  });

  static Color colorOf(BuildContext context, DrivingTone tone) {
    switch (tone) {
      case DrivingTone.success:
        return const Color(0xFF10B981);
      case DrivingTone.info:
        return const Color(0xFF3B82F6);
      case DrivingTone.warning:
        return const Color(0xFFF59E0B);
      case DrivingTone.danger:
        return const Color(0xFFEF4444);
      case DrivingTone.accent:
        return Theme.of(context).colorScheme.primary;
      case DrivingTone.neutral:
        return Theme.of(context).colorScheme.outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = colorOf(context, tone);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// Liste satırı: ikon + başlık/alt başlık + sağda durum ya da değer.
class DrivingListRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? iconColor;

  const DrivingListRow({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = iconColor ?? theme.colorScheme.primary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(
            alpha: 0.35,
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 10), trailing!],
          ],
        ),
      ),
    );
  }
}

/// Boş durum — "veri yok" ekranlarında sistem bozuk hissi vermemek için.
class DrivingEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  const DrivingEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 20),
      child: Column(
        children: [
          Icon(
            icon,
            size: 44,
            color: theme.colorScheme.primary.withValues(alpha: 0.55),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    );
  }
}

/// Hata durumu — yetki hatası da buraya düşer, tekrar dene butonuyla.
class DrivingErrorState extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;

  const DrivingErrorState({
    super.key,
    required this.error,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.lock_outline_rounded,
            size: 46,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(height: 12),
          Text('$error', textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Tekrar Dene'),
          ),
        ],
      ),
    ),
  );
}

/// Basit dikey çubuk grafik (aylık kayıtlar vb.). Renk temadan gelir.
class DrivingBarChart extends StatelessWidget {
  final List<Map<String, dynamic>> series;
  final double height;

  const DrivingBarChart({super.key, required this.series, this.height = 170});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;

    if (series.isEmpty) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text('Grafik verisi yok', style: theme.textTheme.bodySmall),
        ),
      );
    }

    final maxValue = series.fold<num>(1, (max, item) {
      final value = item['value'] as num? ?? 0;
      return value > max ? value : max;
    });

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: series.map((item) {
          final value = item['value'] as num? ?? 0;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    '$value',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Container(
                    height: 10 + (value / maxValue * (height - 60)),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          accent.withValues(alpha: 0.35),
                          accent,
                        ],
                      ),
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(9),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.22),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${item['label']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall,
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

/// Sürücü kursu ızgaralarında kullanılan kolon sayısı — okul ekranlarıyla aynı
/// kırılma noktası.
int drivingGridColumns(BuildContext context) =>
    ResponsiveLayout.isTablet(context) ? 4 : 2;

/// Alt sayfada açılan ortak kayıt formu (paket / araç / evrak / bakım).
/// Kaydet sırasında butonu kilitler ve hata mesajını SnackBar ile gösterir —
/// böylece doğrulama hataları (ör. "araç ve bitiş tarihi zorunlu") sessizce
/// kaybolmaz.
class DrivingFormSheet extends StatefulWidget {
  final String title;
  final List<Widget> fields;
  final Future<void> Function() onSave;
  final String saveLabel;

  const DrivingFormSheet({
    super.key,
    required this.title,
    required this.fields,
    required this.onSave,
    this.saveLabel = 'Kaydet',
  });

  @override
  State<DrivingFormSheet> createState() => _DrivingFormSheetState();
}

class _DrivingFormSheetState extends State<DrivingFormSheet> {
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.onSave();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      20,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 24,
    ),
    child: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.title,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 16),
          ...widget.fields.expand((w) => [w, const SizedBox(height: 12)]),
          FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_rounded),
            label: Text(_saving ? 'Kaydediliyor…' : widget.saveLabel),
          ),
        ],
      ),
    ),
  );
}
