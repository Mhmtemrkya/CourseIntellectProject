import 'package:flutter/material.dart';

/// SchoolAsist premium kart dili (desktop ile ortak):
/// koyu lacivert zemin / açık temada beyaz, ders bazlı vurgu rengi,
/// filigran işaret ve turuncu marka parıltısı.
class ResourceTheme {
  const ResourceTheme(this.hue, this.mark, this.tagline);

  final Color hue;
  final String mark;
  final String tagline;
}

ResourceTheme resourceTheme(String subject) {
  final normalized = subject.toLowerCase();
  if (normalized.contains('mat')) {
    return const ResourceTheme(Color(0xFF4DA3FF), '∑', 'FORMÜL • PROBLEM • MANTIK');
  }
  if (normalized.contains('fiz')) {
    return const ResourceTheme(Color(0xFF7B61FF), 'F', 'HAREKET • ENERJİ • KUVVET');
  }
  if (normalized.contains('kim')) {
    return const ResourceTheme(Color(0xFFFF9D2E), 'H₂O', 'TEPKİME • MADDE • BAĞ');
  }
  if (normalized.contains('biy')) {
    return const ResourceTheme(Color(0xFF30D158), 'DNA', 'CANLI • HÜCRE • SİSTEM');
  }
  if (normalized.contains('türk') || normalized.contains('turk') || normalized.contains('edeb')) {
    return const ResourceTheme(Color(0xFFFF5E7A), 'Aa', 'DİL • ANLAM • PARAGRAF');
  }
  if (normalized.contains('ing') || normalized.contains('eng')) {
    return const ResourceTheme(Color(0xFF22D3EE), 'EN', 'VOCAB • GRAMMAR • READING');
  }
  if (normalized.contains('sosyal') ||
      normalized.contains('tarih') ||
      normalized.contains('coğ') ||
      normalized.contains('cog')) {
    return const ResourceTheme(Color(0xFFFBBF24), 'TR', 'ZAMAN • MEKAN • TOPLUM');
  }
  if (normalized.contains('fen')) {
    return const ResourceTheme(Color(0xFF34D399), 'Fe', 'DENEY • GÖZLEM • KEŞİF');
  }
  return const ResourceTheme(Color(0xFFFF9D2E), '✦', 'PRATİK • TEKRAR • BAŞARI');
}

class PremiumResourceCard extends StatelessWidget {
  const PremiumResourceCard({
    super.key,
    required this.subject,
    required this.title,
    this.eyebrow,
    this.subtitle,
    this.badge,
    this.description,
    this.chips = const [],
    this.stats = const [],
    this.footer,
    this.actions = const [],
    this.statusNote,
    this.onTap,
    this.margin = const EdgeInsets.only(bottom: 12),
  });

  final String subject;
  final String title;
  final String? eyebrow;
  final String? subtitle;
  final String? badge;
  final String? description;
  final List<String> chips;
  final List<(String, String)> stats;
  final Widget? footer;
  final List<Widget> actions;
  final Widget? statusNote;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final theme = resourceTheme(subject);
    final hue = theme.hue;

    final Color cardColor = dark ? const Color(0xFF0B1728) : Colors.white;
    final Color borderColor =
        dark ? Colors.white.withValues(alpha: 0.10) : const Color(0xFFE2E8F0);
    final Color titleColor = dark ? Colors.white : const Color(0xFF0F172A);
    final Color mutedColor =
        dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final Color faintColor =
        dark ? const Color(0xFF64748B) : const Color(0xFF94A3B8);
    final Color tileColor = dark
        ? Colors.white.withValues(alpha: 0.04)
        : const Color(0xFFF6F8FC);
    final Color tileBorder = dark
        ? Colors.white.withValues(alpha: 0.07)
        : const Color(0xFFE9EEF6);

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: dark ? 0.32 : 0.06),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Stack(
              children: [
                // Ders rengi parıltısı
                Positioned(
                  right: -40,
                  top: -52,
                  child: Container(
                    width: 168,
                    height: 168,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          hue.withValues(alpha: dark ? 0.18 : 0.12),
                          hue.withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ),
                // Filigran işaret
                Positioned(
                  right: 4,
                  top: -18,
                  child: Text(
                    theme.mark,
                    style: TextStyle(
                      fontSize: 76,
                      fontWeight: FontWeight.w900,
                      color: hue.withValues(alpha: dark ? 0.09 : 0.10),
                      height: 1,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(15),
                              color: hue.withValues(alpha: 0.13),
                              border: Border.all(
                                color: hue.withValues(alpha: 0.30),
                              ),
                            ),
                            child: Text(
                              theme.mark,
                              style: TextStyle(
                                color: hue,
                                fontWeight: FontWeight.w900,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (eyebrow ?? subject).toUpperCase(),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: hue,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 11,
                                    letterSpacing: 1.8,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  theme.tagline,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: faintColor,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 9.5,
                                    letterSpacing: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (badge != null) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 11,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(99),
                                color: hue.withValues(alpha: 0.12),
                                border: Border.all(
                                  color: hue.withValues(alpha: 0.30),
                                ),
                              ),
                              child: Text(
                                badge!,
                                style: TextStyle(
                                  color: hue,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 13),
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: titleColor,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          height: 1.15,
                        ),
                      ),
                      if (subtitle != null && subtitle!.isNotEmpty) ...[
                        const SizedBox(height: 5),
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: mutedColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ],
                      if (description != null && description!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: mutedColor,
                            fontSize: 13,
                            height: 1.45,
                          ),
                        ),
                      ],
                      if (chips.isNotEmpty) ...[
                        const SizedBox(height: 11),
                        Wrap(
                          spacing: 7,
                          runSpacing: 7,
                          children: chips
                              .where((chip) => chip.isNotEmpty)
                              .map(
                                (chip) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 11,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(99),
                                    color: tileColor,
                                    border: Border.all(color: tileBorder),
                                  ),
                                  child: Text(
                                    chip,
                                    style: TextStyle(
                                      color: mutedColor,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 11.5,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                      if (stats.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            for (var i = 0; i < stats.length; i++) ...[
                              if (i > 0) const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(15),
                                    color: tileColor,
                                    border: Border.all(color: tileBorder),
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        stats[i].$1,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: faintColor,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 10.5,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        stats[i].$2,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: titleColor,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 13.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                      if (footer != null) ...[
                        const SizedBox(height: 13),
                        footer!,
                      ],
                      if (actions.isNotEmpty || statusNote != null) ...[
                        const SizedBox(height: 13),
                        Container(height: 1, color: tileBorder),
                        const SizedBox(height: 11),
                        Row(
                          children: [
                            Expanded(
                              child: statusNote ?? const SizedBox.shrink(),
                            ),
                            for (final action in actions) ...[
                              const SizedBox(width: 8),
                              action,
                            ],
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Kart altındaki ikon aksiyonları (görüntüle / düzenle / sil).
class CardIconAction extends StatelessWidget {
  const CardIconAction({
    super.key,
    required this.icon,
    required this.onTap,
    this.tooltip,
    this.danger = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final Color color = danger
        ? const Color(0xFFF87171)
        : (dark ? const Color(0xFFCBD5E1) : const Color(0xFF475569));
    final button = Material(
      color: dark
          ? Colors.white.withValues(alpha: 0.05)
          : const Color(0xFFF1F5F9),
      borderRadius: BorderRadius.circular(13),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(13),
        child: Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(13),
            border: Border.all(
              color: dark
                  ? Colors.white.withValues(alpha: 0.10)
                  : const Color(0xFFE2E8F0),
            ),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}

/// Turuncu marka rengi ile ana aksiyon butonu.
class CardPrimaryButton extends StatelessWidget {
  const CardPrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFFF7A1A),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 18),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
