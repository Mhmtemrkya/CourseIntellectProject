import 'package:flutter/material.dart';

enum CardTone { brand, blue, emerald, violet, amber, rose, cyan }

CardTone cardToneFor(String title) {
  final text = title.toLowerCase().replaceAll('ı', 'i').replaceAll('ş', 's')
      .replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c');
  bool has(String pattern) => RegExp(pattern).hasMatch(text);
  if (has('geciken kayit|randevu|takvim|bekleyen|yaklasan|hedef|menu|yemek')) return CardTone.amber;
  if (has('gecik|devamsiz|risk|uyari|hata|redd|iptal')) return CardTone.rose;
  if (has('tahsilat orani|iade|pesinat|odev|sinav|rehber|gorusme|mesaj|bildirim')) return CardTone.violet;
  if (has('tahsilat|gelir|bakiye|tamam|basari|gelisim|onay|aktif')) return CardTone.emerald;
  if (has('devam|yoklama|katilim|servis|ulasim')) return CardTone.cyan;
  if (has('gider|net akis|ders|ogrenci|ogretmen|personel|kayit|sube|kurum|rapor|belge')) return CardTone.blue;
  return CardTone.brand;
}

class CardPalette {
  const CardPalette(this.start, this.end, this.ink);
  final Color start;
  final Color end;
  final Color ink;
  static CardPalette forTone(CardTone tone) => switch (tone) {
    CardTone.blue => const CardPalette(Color(0xFF0D63ED), Color(0xFF1625B6), Colors.white),
    CardTone.emerald => const CardPalette(Color(0xFF0B8D6C), Color(0xFF0C6461), Colors.white),
    CardTone.violet => const CardPalette(Color(0xFF7534DC), Color(0xFF652689), Colors.white),
    CardTone.rose => const CardPalette(Color(0xFFCA1643), Color(0xFFAE3812), Colors.white),
    CardTone.amber => const CardPalette(Color(0xFFFFC63D), Color(0xFFFCA21B), Color(0xFF111D36)),
    CardTone.cyan => const CardPalette(Color(0xFF42E0DD), Color(0xFF18BBE8), Color(0xFF111D36)),
    CardTone.brand => const CardPalette(Color(0xFFF9A547), Color(0xFFF7652F), Color(0xFF111D36)),
  };
}

/// Shared quiet treatment for content cards. Data and form controls keep theme ink.
BoxDecoration contentCardDecoration(BuildContext context, {
  String title = '', Color? accent, double radius = 24,
}) => contentCardDecorationForTheme(Theme.of(context), title: title, accent: accent, radius: radius);

BoxDecoration contentCardDecorationForTheme(ThemeData theme, {
  String title = '', Color? accent, double radius = 24,
}) {
  final dark = theme.brightness == Brightness.dark;
  final hue = accent ?? CardPalette.forTone(cardToneFor(title)).start;
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [Color.alphaBlend(hue.withValues(alpha: dark ? .18 : .10), theme.cardColor), theme.cardColor],
    ),
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(color: hue.withValues(alpha: dark ? .38 : .24)),
    boxShadow: [BoxShadow(color: hue.withValues(alpha: dark ? .10 : .08), blurRadius: 18, offset: const Offset(0, 8))],
  );
}

/// Extracts a visible heading from ordinary layout widgets, not arbitrary data.
String cardTitleOf(Widget? child, [int depth = 0]) {
  if (child == null || depth > 8) return '';
  if (child is Text) return child.data ?? child.textSpan?.toPlainText() ?? '';
  if (child is ListTile) return cardTitleOf(child.title, depth + 1);
  if (child is Flex) {
    for (final item in child.children) {
      final title = cardTitleOf(item, depth + 1);
      if (title.isNotEmpty) return title;
    }
  }
  if (child is Padding) return cardTitleOf(child.child, depth + 1);
  if (child is Align) return cardTitleOf(child.child, depth + 1);
  if (child is Expanded) return cardTitleOf(child.child, depth + 1);
  if (child is Flexible) return cardTitleOf(child.child, depth + 1);
  if (child is Container) return cardTitleOf(child.child, depth + 1);
  if (child is SizedBox) return cardTitleOf(child.child, depth + 1);
  return '';
}

/// Full-colour summaries, with a decorative relief of the actual metric icon.
class VividMetricCard extends StatelessWidget {
  const VividMetricCard({super.key, required this.title, required this.value,
    this.caption, this.icon, this.tone, this.onTap, this.compact = false});
  final String title;
  final String value;
  final String? caption;
  final IconData? icon;
  final CardTone? tone;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = CardPalette.forTone(tone ?? cardToneFor(title));
    final radius = BorderRadius.circular(compact ? 20 : 24);
    final metricIcon = icon ?? Icons.auto_graph_rounded;
    return Semantics(
      button: onTap != null,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: radius,
          boxShadow: [BoxShadow(color: palette.end.withValues(alpha: .18), blurRadius: 18, offset: const Offset(0, 8))],
        ),
        child: Material(
          color: palette.start,
          borderRadius: radius,
          clipBehavior: Clip.antiAlias,
          child: Ink(
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [palette.start, palette.end], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: radius,
              border: Border.all(color: Colors.white.withValues(alpha: .18)),
            ),
            child: InkWell(
              onTap: onTap,
              child: Stack(
                children: [
                  Positioned(right: -8, bottom: -10, child: ExcludeSemantics(child: Transform.rotate(
                    angle: -.18, child: Icon(metricIcon, size: compact ? 70 : 100, color: palette.ink.withValues(alpha: .12)),
                  ))),
                  Padding(
                    padding: EdgeInsets.all(compact ? 12 : 16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          if (!compact) ...[Icon(metricIcon, size: 21, color: palette.ink), const SizedBox(width: 9)],
                          Expanded(child: Text(title, style: TextStyle(color: palette.ink, fontSize: compact ? 11 : 13, fontWeight: FontWeight.w700, height: 1.35))),
                        ]),
                        SizedBox(height: compact ? 10 : 20),
                        SizedBox(width: double.infinity, child: FittedBox(
                          fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                          child: Text(value, style: TextStyle(color: palette.ink, fontSize: compact ? 24 : 32, fontWeight: FontWeight.w900, height: 1.15, letterSpacing: -.8)),
                        )),
                        if (caption != null && caption!.isNotEmpty) ...[
                          const SizedBox(height: 7),
                          Text(caption!, style: TextStyle(color: palette.ink.withValues(alpha: .87), fontSize: 11, height: 1.4)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
