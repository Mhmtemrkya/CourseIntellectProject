import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/school_feed_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import '../widgets/premium_modal_shell.dart';

class AdminAnnouncementsPage extends StatefulWidget {
  const AdminAnnouncementsPage({super.key});

  @override
  State<AdminAnnouncementsPage> createState() => _AdminAnnouncementsPageState();
}

class _AdminAnnouncementsPageState extends State<AdminAnnouncementsPage> {
  bool _loading = true;
  String? _error;
  List<AnnouncementFeedItem> _announcements = const [];
  List<StudentRegistryRecord> _students = const [];
  List<String> _classes = const [];

  @override
  void initState() {
    super.initState();
    _loadAnnouncements();
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Duyuru Merkezi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateAnnouncementSheet,
        icon: const Icon(Icons.add_comment_outlined),
        label: const Text('Yeni Duyuru'),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Yönetici duyuruları',
            title:
                'Kurum genelindeki duyuruları oluşturun, düzenleyin ve hedef kitleye göre yönetin.',
            description:
                'Öğrenci, veli, öğretmen veya tüm kurum için profesyonel duyuru akışı buradan yönetilir.',
            metrics: [
              AdminHeroMetric(
                label: 'Toplam',
                value: '${_announcements.length}',
              ),
              AdminHeroMetric(label: 'Bugün', value: '1 yeni'),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Center(
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _loadAnnouncements,
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              ),
            )
          else
            ..._announcements.map((item) => _announcementCard(context, item)),
        ],
      ),
    );
  }

  Future<void> _loadAnnouncements() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        SchoolFeedApiService.instance.fetchAnnouncements(
          audience: 'Tüm Kurum',
          includeAll: true,
        ),
        StudentRegistryStore.instance.ensureLoaded(),
        AdminDirectoryApiService.instance.fetchClasses().catchError(
          (_) => <String>[],
        ),
      ]);
      final studentList = StudentRegistryStore.instance.students;
      final classes = <String>{
        ...studentList
            .map((item) => item.className.trim())
            .where((item) => item.isNotEmpty),
        ...((results[2] as List<dynamic>)
            .map((item) => item.toString().trim())
            .where((item) => item.isNotEmpty)),
      }.toList()..sort();
      if (!mounted) return;
      setState(() {
        _announcements = results[0] as List<AnnouncementFeedItem>;
        _students = studentList;
        _classes = classes;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  String _normalizeText(String value) => value
      .trim()
      .toLowerCase()
      .replaceAll('ç', 'c')
      .replaceAll('ğ', 'g')
      .replaceAll('ı', 'i')
      .replaceAll('ö', 'o')
      .replaceAll('ş', 's')
      .replaceAll('ü', 'u');

  String _normalizeClassName(String value) =>
      _normalizeText(value).replaceAll('-', '').replaceAll(' ', '');

  List<StudentRegistryRecord> _studentsForClass(String className) {
    if (className.trim().isEmpty) return _students;
    final normalized = _normalizeClassName(className);
    return _students
        .where((item) => _normalizeClassName(item.className) == normalized)
        .toList();
  }

  List<_RecipientOption> _studentOptionsForClass(String className) {
    return _studentsForClass(className)
        .map(
          (item) => _RecipientOption(
            primaryKey:
                'student:${_normalizeText(item.username.isNotEmpty ? item.username : item.fullName)}',
            keys: [
              'student:${_normalizeText(item.username.isNotEmpty ? item.username : item.fullName)}',
            ],
            label: '${item.fullName} • ${item.className}',
            helper: item.username.isNotEmpty ? item.username : 'Öğrenci hesabı',
          ),
        )
        .toList()
      ..sort((left, right) => left.label.compareTo(right.label));
  }

  List<_RecipientOption> _parentOptionsForClass(String className) {
    final map = <String, _RecipientOption>{};
    for (final item in _studentsForClass(className)) {
      final parentEmail = _normalizeText(item.parentEmail);
      final parentUsername = parentEmail.contains('@')
          ? parentEmail.split('@').first
          : parentEmail;
      final parentName = _normalizeText(item.parentName);
      final key =
          '${parentEmail.isNotEmpty ? parentEmail : parentName}:${_normalizeClassName(item.className)}';
      map[key] = _RecipientOption(
        primaryKey: parentEmail.isNotEmpty
            ? 'parent-email:$parentEmail'
            : parentName.isNotEmpty
            ? 'parent-name:$parentName'
            : 'student:${_normalizeText(item.username)}',
        keys: [
          if (parentEmail.isNotEmpty) 'parent-email:$parentEmail',
          if (parentUsername.isNotEmpty) 'parent-username:$parentUsername',
          if (parentName.isNotEmpty) 'parent-name:$parentName',
        ],
        label: item.parentName.isNotEmpty
            ? '${item.parentName} • ${item.className}'
            : '${item.fullName} velisi',
        helper: item.parentEmail.isNotEmpty ? item.parentEmail : item.fullName,
      );
    }
    return map.values.toList()
      ..sort((left, right) => left.label.compareTo(right.label));
  }

  Widget _announcementCard(BuildContext context, AnnouncementFeedItem item) {
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: item.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(item.icon, color: item.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    AdminAccentBadge(label: item.audience, color: item.color),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  item.summaryDetail,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 8),
                Text(
                  item.date,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openCreateAnnouncementSheet() {
    final titleController = TextEditingController();
    final detailController = TextEditingController();
    String audience = 'Tüm Kurum';
    String targetClassName = _classes.isNotEmpty ? _classes.first : '';
    String targetRecipientType = 'Veliler';
    final selectedKeys = <String>{};
    final selectedLabels = <String>{};

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final normalizedAudience = audience == 'Tüm Kurum'
                ? 'Tüm Kurum'
                : audience;
            final recipientOptions =
                normalizedAudience == 'Teacher' ||
                    normalizedAudience == 'Tüm Kurum'
                ? const <_RecipientOption>[]
                : normalizedAudience == 'Veli' &&
                      targetRecipientType == 'Veliler'
                ? _parentOptionsForClass(targetClassName)
                : _studentOptionsForClass(targetClassName);
            return PremiumModalShell(
              eyebrow: 'Yeni Duyuru',
              title: 'Kurumsal duyuruyu profesyonel biçimde oluşturun.',
              description:
                  'Desktop akışındaki gibi hedef kitleyi, sınıfı ve gerekirse seçili kişi listesini belirleyin.',
              colors: const [Color(0xFF0F172A), Color(0xFFB45309)],
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(
                      labelText: 'Duyuru Başlığı',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: audience,
                    decoration: const InputDecoration(
                      labelText: 'Hedef Kitle',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'Tüm Kurum',
                        child: Text('Tüm Kurum'),
                      ),
                      DropdownMenuItem(
                        value: 'Öğrenci',
                        child: Text('Öğrenciler'),
                      ),
                      DropdownMenuItem(value: 'Veli', child: Text('Veliler')),
                      DropdownMenuItem(
                        value: 'Teacher',
                        child: Text('Öğretmenler'),
                      ),
                    ],
                    onChanged: (value) => setSheetState(() {
                      audience = value ?? audience;
                      selectedKeys.clear();
                      selectedLabels.clear();
                    }),
                  ),
                  const SizedBox(height: 12),
                  if (normalizedAudience == 'Veli' ||
                      normalizedAudience == 'Öğrenci') ...[
                    DropdownButtonFormField<String>(
                      initialValue:
                          targetClassName.isEmpty && _classes.isNotEmpty
                          ? _classes.first
                          : targetClassName,
                      decoration: const InputDecoration(
                        labelText: 'Sınıf',
                        border: OutlineInputBorder(),
                      ),
                      items: _classes
                          .map(
                            (item) => DropdownMenuItem(
                              value: item,
                              child: Text(item),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setSheetState(() {
                        targetClassName = value ?? targetClassName;
                        selectedKeys.clear();
                        selectedLabels.clear();
                      }),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (normalizedAudience == 'Veli') ...[
                    Text(
                      'Liste Kaynağı',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: ['Veliler', 'Öğrenciler']
                          .map(
                            (item) => ChoiceChip(
                              label: Text(item),
                              selected: targetRecipientType == item,
                              onSelected: (_) => setSheetState(() {
                                targetRecipientType = item;
                                selectedKeys.clear();
                                selectedLabels.clear();
                              }),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: detailController,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Duyuru İçeriği',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (recipientOptions.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Text(
                          'Seçili Kişiler',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const Spacer(),
                        AdminAccentBadge(
                          label: '${selectedLabels.length} seçildi',
                          color: const Color(0xFFB45309),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 260),
                      child: SingleChildScrollView(
                        child: Column(
                          children: recipientOptions.map((option) {
                            final checked = selectedKeys.contains(
                              option.primaryKey,
                            );
                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: checked
                                      ? const Color(0xFF0F172A)
                                      : const Color(0xFFE2E8F0),
                                ),
                                color: checked
                                    ? const Color(0xFF0F172A)
                                    : Colors.white,
                              ),
                              child: CheckboxListTile(
                                value: checked,
                                onChanged: (_) => setSheetState(() {
                                  if (checked) {
                                    selectedKeys.removeWhere(
                                      (key) => option.keys.contains(key),
                                    );
                                    selectedLabels.remove(option.label);
                                  } else {
                                    selectedKeys.addAll(option.keys);
                                    selectedLabels.add(option.label);
                                  }
                                }),
                                title: Text(
                                  option.label,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: checked
                                        ? Colors.white
                                        : const Color(0xFF0F172A),
                                  ),
                                ),
                                subtitle: Text(
                                  option.helper,
                                  style: TextStyle(
                                    color: checked
                                        ? Colors.white70
                                        : const Color(0xFF64748B),
                                  ),
                                ),
                                controlAffinity:
                                    ListTileControlAffinity.leading,
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(sheetContext),
                          child: const Text('İptal'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: () async {
                            if ((normalizedAudience == 'Veli' ||
                                    normalizedAudience == 'Öğrenci') &&
                                selectedKeys.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Lütfen en az bir kişi seçin.'),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              return;
                            }
                            try {
                              await SchoolFeedApiService.instance
                                  .createAnnouncement(
                                    title: titleController.text.trim().isEmpty
                                        ? 'Yeni duyuru'
                                        : titleController.text.trim(),
                                    detail: detailController.text.trim().isEmpty
                                        ? 'Kurumsal duyuru içeriği eklendi.'
                                        : detailController.text.trim(),
                                    audience: normalizedAudience,
                                    createdByRole: 'Admin',
                                    targetClassName: targetClassName,
                                    targetRecipientType: targetRecipientType,
                                    recipientKeys: selectedKeys.toList(),
                                    recipientLabels: selectedLabels.toList(),
                                  );
                            } catch (error) {
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(error.toString()),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              return;
                            }
                            if (!context.mounted) return;
                            Navigator.pop(sheetContext);
                            _loadAnnouncements();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Duyuru başarıyla oluşturuldu.'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          child: const Text('Duyuruyu Yayınla'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _RecipientOption {
  final String primaryKey;
  final List<String> keys;
  final String label;
  final String helper;

  const _RecipientOption({
    required this.primaryKey,
    required this.keys,
    required this.label,
    required this.helper,
  });
}
