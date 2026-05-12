import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/school_feed_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import '../widgets/premium_modal_shell.dart';

class AdministrativeAnnouncementsPage extends StatefulWidget {
  const AdministrativeAnnouncementsPage({super.key});

  @override
  State<AdministrativeAnnouncementsPage> createState() =>
      _AdministrativeAnnouncementsPageState();
}

class _AdministrativeAnnouncementsPageState
    extends State<AdministrativeAnnouncementsPage> {
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
        _announcements = (results[0] as List<AnnouncementFeedItem>);
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

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Duyurular',
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
            eyebrow: 'İdari duyurular',
            title:
                'Kayıt, veli bilgilendirme ve kurum içi akışları hedefli listelerle yönetin.',
            description:
                'Desktop tarafındaki gibi sınıf ve kişi seçerek yalnızca ilgili hesaplara duyuru yayınlayın.',
            colors: const [Color(0xFF0F172A), Color(0xFFB45309)],
            metrics: [
              AdminHeroMetric(
                label: 'Toplam',
                value: '${_announcements.length}',
              ),
              AdminHeroMetric(
                label: 'Sınıf',
                value: _classes.isEmpty ? 'Hazır değil' : '${_classes.length}',
              ),
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
    String audience = 'Veli';
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
            final recipientOptions =
                audience == 'Teacher' || audience == 'Tüm Kurum'
                ? const <_RecipientOption>[]
                : audience == 'Veli' && targetRecipientType == 'Veliler'
                ? _parentOptionsForClass(targetClassName)
                : _studentOptionsForClass(targetClassName);

            return PremiumModalShell(
              eyebrow: 'Yeni Duyuru',
              title: 'İdari duyuruyu hedefli listeyle oluştur.',
              description:
                  'Sınıf ve alıcı listesini seçerek yalnızca ilgili veli veya öğrencilere yayın yap.',
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
                      DropdownMenuItem(value: 'Veli', child: Text('Veliler')),
                      DropdownMenuItem(
                        value: 'Öğrenci',
                        child: Text('Öğrenciler'),
                      ),
                      DropdownMenuItem(
                        value: 'Teacher',
                        child: Text('Öğretmenler'),
                      ),
                      DropdownMenuItem(
                        value: 'Tüm Kurum',
                        child: Text('Tüm Kurum'),
                      ),
                    ],
                    onChanged: (value) => setSheetState(() {
                      audience = value ?? audience;
                      selectedKeys.clear();
                      selectedLabels.clear();
                    }),
                  ),
                  const SizedBox(height: 12),
                  if (audience == 'Veli' || audience == 'Öğrenci') ...[
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
                  if (audience == 'Veli') ...[
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
                            if ((audience == 'Veli' || audience == 'Öğrenci') &&
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
                                        ? 'Yeni idari duyuru'
                                        : titleController.text.trim(),
                                    detail: detailController.text.trim().isEmpty
                                        ? 'İdari duyuru içeriği yayınlandı.'
                                        : detailController.text.trim(),
                                    audience: audience,
                                    createdByRole: 'Administrative',
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
                                content: Text('Duyuru yayınlandı.'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          child: const Text('Yayınla'),
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
