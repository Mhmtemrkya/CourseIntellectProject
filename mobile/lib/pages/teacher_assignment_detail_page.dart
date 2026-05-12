import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/api_config.dart';
import 'package:student/services/homework_api_service.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherAssignmentDetailPage extends StatefulWidget {
  final Map<String, dynamic> assignment;

  const TeacherAssignmentDetailPage({super.key, required this.assignment});

  @override
  State<TeacherAssignmentDetailPage> createState() =>
      _TeacherAssignmentDetailPageState();
}

class _TeacherAssignmentDetailPageState
    extends State<TeacherAssignmentDetailPage> {
  String _teacherName = '';

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
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted || session == null) return;
    setState(() => _teacherName = session.fullName);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final materials = List<String>.from(
      widget.assignment["materials"] as List<dynamic>? ?? const [],
    );

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Ödev Detayı",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle:
            '${_decodeText(widget.assignment["subject"] as String? ?? 'Ders')} Öğretmeni',
        showBackButton: true,
      ),
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
                    _decodeText(widget.assignment["title"] as String?),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "${_decodeText(widget.assignment["subject"] as String?)} • ${widget.assignment["className"]}",
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  _row(
                    "Teslim Tarihi",
                    widget.assignment["deadline"] as String,
                  ),
                  _row("Durum", widget.assignment["status"] as String),
                  _row(
                    "Teslim Eden",
                    "${widget.assignment["submitted"]}/${widget.assignment["total"]}",
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
                    "Açıklama",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _decodeText(
                      widget.assignment["description"] as String? ??
                          "Bu ödev için açıklama eklenmedi.",
                    ),
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
                  Row(
                    children: [
                      Text(
                        "Ek Materyaller",
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () => _deleteAssignment(context),
                        icon: const Icon(Icons.delete_outline_rounded),
                        label: const Text("Sil"),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (materials.isEmpty)
                    Text(
                      "Bu ödeve öğretmen tarafından ek materyal yüklenmedi.",
                      style: theme.textTheme.bodyMedium,
                    )
                  else
                    ...materials.map((item) => _fileTile(context, theme, item)),
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

  Widget _fileTile(BuildContext context, ThemeData theme, String name) {
    return InkWell(
      onTap: () => _downloadMaterial(context, name),
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
            Expanded(child: Text(_parseMaterial(name).name)),
            const Icon(Icons.download_rounded),
          ],
        ),
      ),
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

  Future<void> _deleteAssignment(BuildContext context) async {
    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text("Ödevi Sil"),
        content: Text(
          '"${_decodeText(widget.assignment["title"] as String?)}" ödevi silinsin mi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text("Vazgeç"),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text("Sil"),
          ),
        ],
      ),
    );

    if (shouldDelete != true) return;

    await HomeworkApiService.instance.deleteAssignment(
      widget.assignment["id"] as String,
    );
    if (!context.mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text("Ödev silindi")));
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
}
