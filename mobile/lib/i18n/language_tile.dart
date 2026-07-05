import 'package:flutter/material.dart';

import 'app_locale.dart';

/// Profil ekranlarına eklenen dil seçici. TR/EN arasında geçiş yapar;
/// seçim kalıcıdır ve tüm uygulama seçili dille yeniden çizilir.
class LanguageTile extends StatelessWidget {
  const LanguageTile({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: AppLocale.language,
      builder: (context, lang, _) {
        return ListTile(
          leading: const Icon(Icons.translate_rounded),
          title: Text('Dil / Language'.tr),
          subtitle: Text(lang == 'en' ? 'English' : 'Türkçe'),
          trailing: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'tr', label: Text('TR')),
              ButtonSegment(value: 'en', label: Text('EN')),
            ],
            selected: {lang},
            showSelectedIcon: false,
            onSelectionChanged: (set) => AppLocale.set(set.first),
          ),
        );
      },
    );
  }
}
