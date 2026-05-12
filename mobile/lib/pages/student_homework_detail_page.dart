import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_config.dart';

class StudentHomeworkDetailPage extends StatelessWidget {
  final Map<String, dynamic> homework;

  const StudentHomeworkDetailPage({super.key, required this.homework});

  String _decodeText(String? value) {
    return (value ?? '')
        .replaceAll('&#xFC;', 'ü')
        .replaceAll('&#xDC;', 'Ü')
        .replaceAll('&#xE7;', 'ç')
        .replaceAll('&#xC7;', 'Ç')
        .replaceAll('&#x131;', 'ı')
        .replaceAll('&#x130;', 'İ')
        .replaceAll('&#xF6;', 'ö')
        .replaceAll('&#xD6;', 'Ö')
        .replaceAll('&#x15F;', 'ş')
        .replaceAll('&#x15E;', 'Ş')
        .replaceAll('&#x11F;', 'ğ')
        .replaceAll('&#x11E;', 'Ğ')
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&Uuml;', 'Ü')
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&Ccedil;', 'Ç')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&Ouml;', 'Ö')
        .replaceAll('&scedil;', 'ş')
        .replaceAll('&Scedil;', 'Ş')
        .replaceAll('&nbsp;', ' ');
  }

  ({String name, String url}) _parseMaterial(String raw) {
    final value = raw.trim();
    if (value.contains('::')) {
      final parts = value.split('::');
      return (
        name: _decodeText(parts.first.trim()),
        url: parts.length > 1
            ? parts.sublist(1).join('::').trim()
            : parts.first.trim(),
      );
    }
    return (name: _decodeText(value.split('/').last), url: value);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final materials = List<String>.from(
      homework["materials"] as List<dynamic>? ?? const [],
    );

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text("Ödev Detayı")),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _decodeText(homework["title"] as String?),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "${_decodeText(homework["subject"] as String?)} • ${_decodeText(homework["teacher"] as String?)}",
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  _row("Teslim Tarihi", homework["deadline"] as String),
                  _row("Durum", homework["status"] as String),
                  _row("Sınıf", homework["className"] as String),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Açıklama",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _decodeText(homework["description"] as String?),
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Materyaller",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (materials.isEmpty)
                    Text(
                      "Bu ödeve ek materyal yüklenmedi.",
                      style: theme.textTheme.bodyMedium,
                    )
                  else
                    ...materials.map(
                      (item) => InkWell(
                        onTap: () => _downloadMaterial(context, item),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: theme.scaffoldBackgroundColor,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.insert_drive_file_rounded,
                                color: theme.colorScheme.primary,
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text(_parseMaterial(item).name)),
                              const Icon(Icons.download_rounded),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _card(ThemeData theme, bool isDark, Widget child) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }

  Future<void> _downloadMaterial(BuildContext context, String raw) async {
    final material = _parseMaterial(raw);
    final resolvedUrl = ApiConfig.resolveAssetUrl(material.url);
    final launched = await launchUrl(
      Uri.parse(resolvedUrl),
      mode: LaunchMode.externalApplication,
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          launched ? '${material.name} açılıyor' : '${material.name} açılamadı',
        ),
      ),
    );
  }
}
