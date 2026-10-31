import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/subject_groups_api_service.dart';
import '../widgets/admin_ui.dart';

const _colors = [
  Color(0xFF2563EB),
  Color(0xFF16A34A),
  Color(0xFFDC2626),
  Color(0xFF9333EA),
  Color(0xFFEA580C),
  Color(0xFF0891B2),
  Color(0xFFDB2777),
  Color(0xFFCA8A04),
];

String _hex(Color color) =>
    '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';

Color _parseColor(Object? value) {
  final text = '${value ?? ''}'.replaceFirst('#', '');
  final parsed = int.tryParse(text, radix: 16);
  return parsed == null ? _colors.first : Color(0xFF000000 | parsed);
}

String _currentAcademicYear() {
  final now = DateTime.now();
  final start = now.month >= 9 ? now.year : now.year - 1;
  return '$start-${start + 1}';
}

String _initials(String name) => name
    .split(RegExp(r'\s+'))
    .where((part) => part.isNotEmpty)
    .take(2)
    .map((part) => part[0].toUpperCase())
    .join();

String _norm(Object? value) => '${value ?? ''}'.trim().toLowerCase();

/// Zümreler (kurum yöneticisi / şube müdürü): ders zümreleri, başkanlar, üyeler.
class SubjectGroupsPage extends StatefulWidget {
  const SubjectGroupsPage({super.key});

  @override
  State<SubjectGroupsPage> createState() => _SubjectGroupsPageState();
}

class _SubjectGroupsPageState extends State<SubjectGroupsPage> {
  final _api = SubjectGroupsApiService.instance;
  String _year = _currentAcademicYear();
  Map<String, dynamic>? _overview;
  List<Map<String, dynamic>> _teachers = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([_api.overview(_year), _api.teachers(_year)]);
      if (!mounted) return;
      setState(() {
        _overview = results[0] as Map<String, dynamic>;
        _teachers = results[1] as List<Map<String, dynamic>>;
      });
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _groups => ((_overview?['groups'] as List?) ?? const [])
      .map((item) => Map<String, dynamic>.from(item as Map))
      .toList();

  List<String> get _years {
    final start = int.parse(_currentAcademicYear().substring(0, 4));
    return [start + 1, start, start - 1].map((year) => '$year-${year + 1}').toList();
  }

  void _snack(String text) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openEditor({Map<String, dynamic>? group, String subject = ''}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _SubjectGroupEditorPage(
          year: _year,
          group: group,
          initialSubject: subject,
          teachers: _teachers,
          usedColors: _groups.map((item) => '${item['color']}').toSet(),
          suggestions: ((_overview?['suggestions'] as List?) ?? const [])
              .map((item) => '${(item as Map)['subject']}')
              .toList(),
        ),
      ),
    );
    if (saved == true) await _load();
  }

  Future<void> _delete(Map<String, dynamic> group) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('Zümreyi Sil'.tr),
        content: Text('${group['name']} silinsin mi? Üyelik kayıtları da silinir.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: Text('Sil'.tr)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.delete('${group['id']}');
      _snack('Zümre silindi'.tr);
      await _load();
    } catch (error) {
      _snack('$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final overview = _overview;
    final missing = ((overview?['suggestions'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .where((item) => item['hasGroup'] != true)
        .toList();
    return AdminScaffold(
      appBar: AppBar(
        title: Text('Zümreler'.tr),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Öğretim yılı'.tr,
            initialValue: _year,
            icon: const Icon(Icons.calendar_month_rounded),
            onSelected: (value) {
              setState(() => _year = value);
              _load();
            },
            itemBuilder: (_) => _years.map((year) => PopupMenuItem(value: year, child: Text(year))).toList(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loading ? null : () => _openEditor(),
        icon: const Icon(Icons.add_rounded),
        label: Text('Zümre Oluştur'.tr),
      ),
      child: _loading && overview == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: FilledButton(onPressed: _load, child: Text(_error!))))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  AdminHeroCard(
                    eyebrow: '$_year ${'öğretim yılı'.tr}',
                    title: 'Zümreler'.tr,
                    description: 'Ders zümrelerini, zümre başkanlarını ve üye öğretmenleri yönetin.'.tr,
                    colors: const [Color(0xFF0F172A), Color(0xFF4F46E5)],
                    metrics: [
                      AdminHeroMetric(label: 'Zümre'.tr, value: '${overview?['groupCount'] ?? 0}'),
                      AdminHeroMetric(label: 'Zümresiz öğretmen'.tr, value: '${overview?['teachersWithoutGroup'] ?? 0}'),
                      AdminHeroMetric(label: 'Başkansız zümre'.tr, value: '${overview?['groupsWithoutHead'] ?? 0}'),
                    ],
                  ),
                  if (missing.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    AdminPanel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AdminSectionTitle(title: 'Personel branşlarına göre önerilen zümreler'.tr),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: missing.take(12).map((item) => ActionChip(
                                  avatar: const Icon(Icons.auto_awesome_rounded, size: 16),
                                  label: Text('${item['subject']} · ${item['teacherCount']} ${'öğretmen'.tr}'),
                                  onPressed: () => _openEditor(subject: '${item['subject']}'),
                                )).toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  if (_groups.isEmpty)
                    AdminPanel(
                      child: Column(
                        children: [
                          const Icon(Icons.menu_book_rounded, size: 36),
                          const SizedBox(height: 8),
                          Text('Bu yıl için zümre yok'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text('Yukarıdaki önerilerden ya da "Zümre Oluştur" ile başlayın.'.tr, textAlign: TextAlign.center),
                        ],
                      ),
                    ),
                  ..._groups.map((group) => SubjectGroupCard(
                        group: group,
                        onEdit: () => _openEditor(group: group),
                        onDelete: () => _delete(group),
                      )),
                ],
              ),
            ),
    );
  }
}

/// Zümre kartı; düzenleme düğmeleri yalnız yönetici ekranında verilir.
class SubjectGroupCard extends StatelessWidget {
  final Map<String, dynamic> group;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  /// Öğretmen görünümünde oturumdaki kişinin adı; başkansa rozet çizilir.
  final String? highlightName;

  const SubjectGroupCard({super.key, required this.group, this.onEdit, this.onDelete, this.highlightName});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _parseColor(group['color']);
    final members = ((group['members'] as List?) ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();
    final headName = '${group['headTeacherName'] ?? ''}';
    final iAmHead = highlightName != null && headName.isNotEmpty && _norm(headName) == _norm(highlightName);
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(height: 4, color: color),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${group['subject']} • ${group['academicYear']}'.toUpperCase(),
                              style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 0.6, color: theme.hintColor),
                            ),
                            const SizedBox(height: 2),
                            Text('${group['name']}', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                      if (iAmHead) AdminAccentBadge(label: 'Başkansınız'.tr, color: const Color(0xFFD97706)),
                      if (onEdit != null) IconButton(tooltip: 'Düzenle'.tr, onPressed: onEdit, icon: const Icon(Icons.edit_outlined)),
                      if (onDelete != null)
                        IconButton(
                          tooltip: 'Sil'.tr,
                          onPressed: onDelete,
                          icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: headName.isEmpty
                        ? Text('Zümre başkanı atanmadı.'.tr, style: TextStyle(color: theme.hintColor))
                        : Row(
                            children: [
                              CircleAvatar(
                                radius: 18,
                                backgroundColor: color,
                                child: Text(_initials(headName), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.workspace_premium_rounded, size: 14, color: Color(0xFFD97706)),
                                        const SizedBox(width: 4),
                                        Text('Zümre Başkanı'.tr, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
                                      ],
                                    ),
                                    Text(headName, style: const TextStyle(fontWeight: FontWeight.w800)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                  ),
                  const SizedBox(height: 10),
                  Text('${members.length} ${'üye'.tr}', style: theme.textTheme.labelMedium?.copyWith(color: theme.hintColor)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: members.map((member) => Chip(
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          avatar: member['isHead'] == true
                              ? const Icon(Icons.workspace_premium_rounded, size: 16, color: Color(0xFFD97706))
                              : null,
                          label: Text('${member['teacherName']}'),
                        )).toList(),
                  ),
                  if ('${group['description'] ?? ''}'.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('${group['description']}', style: TextStyle(color: theme.hintColor)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubjectGroupEditorPage extends StatefulWidget {
  final String year;
  final Map<String, dynamic>? group;
  final String initialSubject;
  final List<Map<String, dynamic>> teachers;
  final Set<String> usedColors;
  final List<String> suggestions;

  const _SubjectGroupEditorPage({
    required this.year,
    required this.group,
    required this.initialSubject,
    required this.teachers,
    required this.usedColors,
    required this.suggestions,
  });

  @override
  State<_SubjectGroupEditorPage> createState() => _SubjectGroupEditorPageState();
}

class _SubjectGroupEditorPageState extends State<_SubjectGroupEditorPage> {
  late final TextEditingController _subject;
  late final TextEditingController _name;
  late final TextEditingController _description;
  final _search = TextEditingController();
  late Color _color;
  late Set<String> _members;
  String? _head;
  bool _onlyBranch = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final group = widget.group;
    _subject = TextEditingController(text: group == null ? widget.initialSubject : '${group['subject']}');
    _name = TextEditingController(text: group == null ? '' : '${group['name']}');
    _description = TextEditingController(text: group == null ? '' : '${group['description'] ?? ''}');
    _color = group == null
        ? _colors.firstWhere((color) => !widget.usedColors.contains(_hex(color)), orElse: () => _colors.first)
        : _parseColor(group['color']);
    _members = group == null
        ? widget.teachers
            .where((teacher) => widget.initialSubject.isNotEmpty && _norm(teacher['branch']) == _norm(widget.initialSubject))
            .map((teacher) => '${teacher['userId']}')
            .toSet()
        : ((group['members'] as List?) ?? const []).map((item) => '${(item as Map)['teacherUserId']}').toSet();
    _head = group?['headTeacherUserId'] as String?;
    _onlyBranch = _subject.text.isNotEmpty;
  }

  @override
  void dispose() {
    _subject.dispose();
    _name.dispose();
    _description.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_subject.text.trim().length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ders adını yazın.'.tr)));
      return;
    }
    setState(() => _saving = true);
    try {
      await SubjectGroupsApiService.instance.save(
        id: widget.group?['id'] as String?,
        subject: _subject.text.trim(),
        name: _name.text.trim(),
        academicYear: widget.year,
        headTeacherUserId: _head,
        memberUserIds: _members.toList(),
        description: _description.text.trim(),
        color: _hex(_color),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final query = _norm(_search.text);
    final subject = _norm(_subject.text);
    final visible = widget.teachers.where((teacher) {
      final id = '${teacher['userId']}';
      if (_onlyBranch && subject.isNotEmpty && _norm(teacher['branch']) != subject && !_members.contains(id)) return false;
      return query.isEmpty || _norm('${teacher['fullName']} ${teacher['branch']}').contains(query);
    }).toList();
    return AdminScaffold(
      appBar: AppBar(
        title: Text(widget.group == null ? 'Yeni Zümre'.tr : 'Zümreyi Düzenle'.tr),
        actions: [
          TextButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Kaydediliyor…'.tr : 'Kaydet'.tr)),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${widget.year} ${'öğretim yılı'.tr}', style: TextStyle(color: theme.hintColor)),
                const SizedBox(height: 10),
                TextField(
                  controller: _subject,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(labelText: 'Ders *'.tr, hintText: 'Örn: Matematik'.tr),
                ),
                if (widget.suggestions.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: widget.suggestions
                        .where((item) => _subject.text.isEmpty || _norm(item).contains(_norm(_subject.text)))
                        .take(8)
                        .map((item) => ActionChip(
                              visualDensity: VisualDensity.compact,
                              label: Text(item),
                              onPressed: () => setState(() => _subject.text = item),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 10),
                TextField(
                  controller: _name,
                  decoration: InputDecoration(
                    labelText: 'Zümre adı'.tr,
                    hintText: 'Boş bırakılırsa ders adından üretilir'.tr,
                  ),
                ),
                const SizedBox(height: 12),
                Text('Renk'.tr, style: theme.textTheme.labelLarge),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 10,
                  children: _colors.map((color) => Semantics(
                        button: true,
                        selected: color == _color,
                        label: _hex(color),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () => setState(() => _color = color),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: color == _color ? theme.colorScheme.onSurface : Colors.transparent,
                                width: 3,
                              ),
                            ),
                          ),
                        ),
                      )).toList(),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _description,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Açıklama'.tr,
                    hintText: 'Toplantı günü, ortak sınav planı, notlar...'.tr,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminSectionTitle(title: 'Seçilen üyeler ({n})'.tr.replaceFirst('{n}', '${_members.length}')),
                Text('Başkanı taç simgesiyle seçin.'.tr, style: TextStyle(color: theme.hintColor, fontSize: 12)),
                const SizedBox(height: 8),
                TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: 'Öğretmen ara...'.tr),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Yalnız bu branş'.tr),
                  value: _onlyBranch,
                  onChanged: (value) => setState(() => _onlyBranch = value),
                ),
                if (visible.isEmpty)
                  Padding(padding: const EdgeInsets.all(12), child: Text('Eşleşen öğretmen yok.'.tr)),
                ...visible.map((teacher) {
                  final id = '${teacher['userId']}';
                  final selected = _members.contains(id);
                  final isHead = _head == id;
                  final branch = '${teacher['branch'] ?? ''}';
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Checkbox(
                      value: selected,
                      onChanged: (_) => setState(() {
                        if (selected) {
                          _members.remove(id);
                          if (isHead) _head = null;
                        } else {
                          _members.add(id);
                        }
                      }),
                    ),
                    title: Text('${teacher['fullName']}'),
                    subtitle: Text(branch.isEmpty ? 'Branş girilmemiş'.tr : branch),
                    trailing: selected
                        ? IconButton(
                            tooltip: isHead ? 'Başkanlıktan çıkar'.tr : 'Zümre başkanı yap'.tr,
                            icon: Icon(
                              Icons.workspace_premium_rounded,
                              color: isHead ? const Color(0xFFD97706) : theme.hintColor,
                            ),
                            onPressed: () => setState(() => _head = isHead ? null : id),
                          )
                        : null,
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Öğretmen görünümü: üyesi olduğu zümreler (salt okunur).
class TeacherSubjectGroupsPage extends StatefulWidget {
  const TeacherSubjectGroupsPage({super.key});

  @override
  State<TeacherSubjectGroupsPage> createState() => _TeacherSubjectGroupsPageState();
}

class _TeacherSubjectGroupsPageState extends State<TeacherSubjectGroupsPage> {
  List<Map<String, dynamic>>? _groups;
  String? _error;
  String? _myName;

  @override
  void initState() {
    super.initState();
    _load();
    AuthSessionStore.instance.load().then((session) {
      if (mounted && session != null) setState(() => _myName = session.fullName);
    });
  }

  Future<void> _load() async {
    try {
      final groups = await SubjectGroupsApiService.instance.mine();
      if (mounted) setState(() => _groups = groups);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groups;
    return AdminScaffold(
      appBar: AppBar(title: Text('Zümrem'.tr)),
      child: _error != null
          ? Center(child: Text(_error!))
          : groups == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (groups.isEmpty)
                    AdminPanel(
                      child: Column(
                        children: [
                          const Icon(Icons.groups_rounded, size: 36),
                          const SizedBox(height: 8),
                          Text('Henüz bir zümrede değilsiniz'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text('Zümreler kurum yöneticisi tarafından oluşturulur.'.tr, textAlign: TextAlign.center),
                        ],
                      ),
                    ),
                  ...groups.map((group) => SubjectGroupCard(group: group, highlightName: _myName)),
                ],
              ),
            ),
    );
  }
}
