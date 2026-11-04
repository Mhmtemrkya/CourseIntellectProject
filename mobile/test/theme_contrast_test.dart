import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/theme.dart';

double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (max(la, lb) + 0.05) / (min(la, lb) + 0.05);
}

/// Seçili öğelerde yazı kayboluyordu (seçili segmentte lacivert zemin üstünde siyah yazı, koyu
/// temada lacivert seçili sekme). Her kurum paletinde ve iki temada seçili öğe okunur olmalı.
void main() {
  const palettes = <String, (Color, Color?)>{
    'varsayılan (lacivert + turuncu)': (Color(0xFF08111F), Color(0xFFFF7A1A)),
    'aksansız kurum (aksan = lacivert)': (Color(0xFF07152E), null),
    'koyu aksan': (Color(0xFF0B2841), Color(0xFF0C1936)),
    'açık sarı aksan': (Color(0xFF1E3A8A), Color(0xFFFDE047)),
  };

  for (final entry in palettes.entries) {
    for (final brightness in Brightness.values) {
      test('${entry.key} / ${brightness.name}', () {
        final (primary, accent) = entry.value;
        final theme = buildDynamicTheme(primary, brightness, accent: accent ?? primary);
        final scheme = theme.colorScheme;
        const selected = {WidgetState.selected};

        final segmentBg = theme.segmentedButtonTheme.style!.backgroundColor!.resolve(selected)!;
        final segmentFg = theme.segmentedButtonTheme.style!.foregroundColor!.resolve(selected)!;
        expect(contrast(segmentFg, Color.alphaBlend(segmentBg, theme.cardColor)), greaterThanOrEqualTo(4.5), reason: 'seçili segment');
        expect(contrast(scheme.onSecondaryContainer, scheme.secondaryContainer), greaterThanOrEqualTo(4.5), reason: 'secondaryContainer');
        expect(contrast(scheme.onPrimaryContainer, scheme.primaryContainer), greaterThanOrEqualTo(4.5), reason: 'primaryContainer');
        expect(contrast(scheme.onPrimary, scheme.primary), greaterThanOrEqualTo(3.0), reason: 'dolgu buton yazısı');
        expect(contrast(scheme.primary, theme.cardColor), greaterThanOrEqualTo(2.2), reason: 'aksan dolgu zemine karışmasın');

        final nav = theme.bottomNavigationBarTheme;
        expect(contrast(nav.selectedItemColor!, nav.backgroundColor!), greaterThanOrEqualTo(4.5), reason: 'alt gezinti seçili sekme');
        final indicator = theme.navigationBarTheme.indicatorColor!;
        final navIcon = theme.navigationBarTheme.iconTheme!.resolve(selected)!.color!;
        expect(contrast(navIcon, indicator), greaterThanOrEqualTo(4.5), reason: 'gezinti göstergesi');

        expect(contrast(theme.tabBarTheme.labelColor!, theme.cardColor), greaterThanOrEqualTo(3.0), reason: 'seçili sekme yazısı');
        expect(contrast(theme.chipTheme.secondaryLabelStyle!.color!, Color.alphaBlend(theme.chipTheme.selectedColor!, theme.cardColor)), greaterThanOrEqualTo(4.5), reason: 'seçili çip');
        expect(contrast(theme.listTileTheme.selectedColor!, theme.listTileTheme.selectedTileColor!), greaterThanOrEqualTo(4.5), reason: 'seçili liste satırı');
        expect(contrast(theme.textButtonTheme.style!.foregroundColor!.resolve({})!, theme.cardColor), greaterThanOrEqualTo(3.0), reason: 'metin butonu');
      });
    }
  }
}
