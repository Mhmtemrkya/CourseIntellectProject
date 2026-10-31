import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/clubs_api_service.dart';
import '../widgets/admin_ui.dart';

/// Rol bazlı kulüp ekranı. Masaüstündeki ClubsPages ile aynı akış:
/// yönetici kulüp açar, danışman öğretmen üye/etkinlik yönetir,
/// öğrenci katılma isteği gönderir, veli çocuğunun kulüplerini görür.
enum ClubsAudience { admin, staff, teacher, student, parent }

class _Category {
  final String key;
  final String label;
  final IconData icon;
  final Color color;
  const _Category(this.key, this.label, this.icon, this.color);
}

const _categories = [
  _Category('Science', 'Bilim', Icons.science_rounded, Color(0xFF0891B2)),
  _Category('Technology', 'Teknoloji & Robotik', Icons.memory_rounded, Color(0xFF2563EB)),
  _Category('Sports', 'Spor', Icons.sports_soccer_rounded, Color(0xFF16A34A)),
  _Category('Arts', 'Sanat', Icons.palette_rounded, Color(0xFFDB2777)),
  _Category('Music', 'Müzik', Icons.music_note_rounded, Color(0xFF9333EA)),
  _Category('Literature', 'Edebiyat & Münazara', Icons.menu_book_rounded, Color(0xFFCA8A04)),
  _Category('Language', 'Yabancı Dil', Icons.translate_rounded, Color(0xFF0D9488)),
  _Category('SocialResponsibility', 'Sosyal Sorumluluk', Icons.volunteer_activism_rounded, Color(0xFFDC2626)),
  _Category('Culture', 'Kültür & Tarih', Icons.account_balance_rounded, Color(0xFFEA580C)),
  _Category('Other', 'Diğer', Icons.auto_awesome_rounded, Color(0xFF64748B)),
];

_Category _categoryOf(Object? key) => _categories.firstWhere((item) => item.key == '$key', orElse: () => _categories.last);

const _roles = {'President': 'Kulüp Başkanı', 'VicePresident': 'Başkan Yardımcısı', 'Secretary': 'Sekreter', 'Member': 'Üye'};
const _activityStatus = {'Planned': 'Planlandı', 'Completed': 'Tamamlandı', 'Cancelled': 'İptal edildi'};

String _roleLabel(Object? key) => (_roles['$key'] ?? 'Üye').tr;

Color _parseColor(Object? value) {
  final parsed = int.tryParse('${value ?? ''}'.replaceFirst('#', ''), radix: 16);
  return parsed == null ? const Color(0xFF2563EB) : Color(0xFF000000 | parsed);
}

String _currentAcademicYear() {
  final now = DateTime.now();
  final start = now.month >= 9 ? now.year : now.year - 1;
  return '$start-${start + 1}';
}

String _dateTime(Object? raw) {
  final value = DateTime.tryParse('${raw ?? ''}')?.toLocal();
  if (value == null) return '—';
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(value.day)}.${two(value.month)}.${value.year} ${two(value.hour)}:${two(value.minute)}';
}

void _snack(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

class ClubsPage extends StatefulWidget {
  final ClubsAudience audience;
  const ClubsPage({super.key, required this.audience});

  @override
  State<ClubsPage> createState() => _ClubsPageState();
}

class _ClubsPageState extends State<ClubsPage> {
  final _api = ClubsApiService.instance;
  List<Map<String, dynamic>> _clubs = [];
  List<Map<String, dynamic>> _mine = [];
  List<Map<String, dynamic>> _upcoming = [];
  Map<String, dynamic> _overview = const {};
  bool _loading = true;
  String? _error;
  String _category = '';

  bool get _isAdmin => widget.audience == ClubsAudience.admin;

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
      final year = _currentAcademicYear();
      switch (widget.audience) {
        case ClubsAudience.admin:
        case ClubsAudience.staff:
        case ClubsAudience.student:
          final overview = await _api.overview(year);
          final upcoming = widget.audience == ClubsAudience.student ? await _api.upcoming() : <Map<String, dynamic>>[];
          if (!mounted) return;
          setState(() {
            _overview = overview;
            _clubs = ((overview['clubs'] as List?) ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();
            _upcoming = upcoming;
          });
        case ClubsAudience.teacher:
          final results = await Future.wait([_api.mine(), _api.overview(year)]);
          if (!mounted) return;
          setState(() {
            _mine = results[0] as List<Map<String, dynamic>>;
            final overview = results[1] as Map<String, dynamic>;
            _clubs = ((overview['clubs'] as List?) ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();
          });
        case ClubsAudience.parent:
          final results = await Future.wait([_api.mine(), _api.upcoming()]);
          if (!mounted) return;
          setState(() {
            _mine = results[0];
            _upcoming = results[1];
          });
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> club) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ClubDetailPage(clubId: '${club['id']}', canEdit: _isAdmin),
    ));
    await _load();
  }

  Future<void> _openEditor([Map<String, dynamic>? club]) async {
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => ClubEditorPage(club: club)));
    if (saved == true) await _load();
  }

  Future<void> _join(Map<String, dynamic> club) async {
    final note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text('${club['name']}'),
        content: TextField(
          controller: note,
          maxLength: 500,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(labelText: 'Neden katılmak istiyorsun? (isteğe bağlı)'.tr),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: Text('İstek Gönder'.tr)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await _api.join('${club['id']}', note.text.trim());
      if (mounted) _snack(context, 'İsteğin gönderildi'.tr);
      await _load();
    } catch (error) {
      if (mounted) _snack(context, '$error');
    }
  }

  Future<void> _leave(Map<String, dynamic> club) async {
    final pending = club['myStatus'] == 'Pending';
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        content: Text(pending ? 'Katılma isteğiniz geri çekilsin mi?'.tr : 'Kulüpten ayrılmak istiyor musunuz?'.tr),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: Text('Tamam'.tr)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await _api.leave('${club['id']}');
      if (mounted) _snack(context, pending ? 'İstek geri çekildi'.tr : 'Kulüpten ayrıldınız'.tr);
      await _load();
    } catch (error) {
      if (mounted) _snack(context, '$error');
    }
  }

  Widget? _studentFooter(Map<String, dynamic> club) {
    if (widget.audience != ClubsAudience.student) return null;
    final status = club['myStatus'];
    if (status == 'Active') {
      return Row(children: [
        AdminAccentBadge(label: _roleLabel(club['myRole']), color: const Color(0xFF16A34A)),
        const Spacer(),
        TextButton(onPressed: () => _leave(club), child: Text('Ayrıl'.tr)),
      ]);
    }
    if (status == 'Pending') {
      return Row(children: [
        AdminAccentBadge(label: 'Onay bekliyor'.tr, color: const Color(0xFFD97706)),
        const Spacer(),
        TextButton(onPressed: () => _leave(club), child: Text('İsteği geri çek'.tr)),
      ]);
    }
    if (club['acceptsRequests'] != true) return Text('Üyeleri danışman öğretmen belirler.'.tr, style: const TextStyle(fontSize: 12));
    final capacity = (club['capacity'] as num?)?.toInt() ?? 0;
    final full = capacity > 0 && ((club['memberCount'] as num?)?.toInt() ?? 0) >= capacity;
    return Align(
      alignment: Alignment.centerRight,
      child: FilledButton(onPressed: full ? null : () => _join(club), child: Text(full ? 'Kontenjan dolu'.tr : 'Katılma İsteği Gönder'.tr)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _clubs.where((club) => _category.isEmpty || club['category'] == _category).toList();
    final children = <Widget>[];

    if (_isAdmin || widget.audience == ClubsAudience.staff) {
      children.add(AdminHeroCard(
        eyebrow: '${_currentAcademicYear()} ${'öğretim yılı'.tr}',
        title: 'Kulüpler'.tr,
        description: 'Öğrenci kulüplerini açın, danışman atayın; üyelik ve etkinlikleri izleyin.'.tr,
        colors: const [Color(0xFF0F172A), Color(0xFFE11D48)],
        metrics: [
          AdminHeroMetric(label: 'Kulüp'.tr, value: '${_overview['clubCount'] ?? 0}'),
          AdminHeroMetric(label: 'Kulüplü öğrenci'.tr, value: '${_overview['studentsInClubs'] ?? 0}'),
          AdminHeroMetric(label: 'Bekleyen istek'.tr, value: '${_overview['pendingRequestCount'] ?? 0}'),
        ],
      ));
    }
    if (_upcoming.isNotEmpty) {
      children.add(Padding(
        padding: const EdgeInsets.only(top: 12),
        child: AdminPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AdminSectionTitle(title: 'Yaklaşan etkinlikler'.tr),
              ..._upcoming.take(6).map((activity) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_rounded),
                    title: Text('${activity['title']}'),
                    subtitle: Text('${activity['clubName']} • ${_dateTime(activity['startsAtUtc'])}'),
                  )),
            ],
          ),
        ),
      ));
    }

    if (widget.audience == ClubsAudience.teacher || widget.audience == ClubsAudience.parent) {
      final title = widget.audience == ClubsAudience.teacher ? 'Danışmanı olduğum kulüpler' : 'Kulüpler';
      children.add(Padding(padding: const EdgeInsets.only(top: 12, bottom: 8), child: AdminSectionTitle(title: title.tr)));
      if (_mine.isEmpty) {
        children.add(_empty(widget.audience == ClubsAudience.teacher ? 'Danışmanı olduğunuz kulüp yok' : 'Kulüp üyeliği yok'));
      }
      children.addAll(_mine.map((club) => ClubTile(
            club: club,
            onTap: () => _openDetail(club),
            footer: widget.audience == ClubsAudience.parent
                ? AdminAccentBadge(
                    label: club['myStatus'] == 'Pending' ? 'Onay bekliyor'.tr : _roleLabel(club['myRole']),
                    color: const Color(0xFF2563EB),
                  )
                : null,
          )));
      if (widget.audience == ClubsAudience.teacher) {
        final others = _clubs.where((club) => !_mine.any((item) => item['id'] == club['id'])).toList();
        if (others.isNotEmpty) {
          children.add(Padding(padding: const EdgeInsets.only(top: 12, bottom: 8), child: AdminSectionTitle(title: 'Kurumdaki diğer kulüpler'.tr)));
          children.addAll(others.map((club) => ClubTile(club: club, onTap: () => _openDetail(club))));
        }
      }
    } else {
      children.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            ChoiceChip(label: Text('Tümü'.tr), selected: _category.isEmpty, onSelected: (_) => setState(() => _category = '')),
            ..._categories.map((item) => Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: ChoiceChip(
                    avatar: Icon(item.icon, size: 16, color: item.color),
                    label: Text(item.label.tr),
                    selected: _category == item.key,
                    onSelected: (_) => setState(() => _category = _category == item.key ? '' : item.key),
                  ),
                )),
          ]),
        ),
      ));
      if (filtered.isEmpty) children.add(_empty(_clubs.isEmpty ? 'Bu yıl için kulüp yok' : 'Kulüp bulunamadı'));
      children.addAll(filtered.map((club) => ClubTile(club: club, onTap: () => _openDetail(club), footer: _studentFooter(club))));
    }

    return AdminScaffold(
      appBar: AppBar(title: Text('Kulüpler'.tr)),
      floatingActionButton: _isAdmin
          ? FloatingActionButton.extended(onPressed: () => _openEditor(), icon: const Icon(Icons.add_rounded), label: Text('Kulüp Oluştur'.tr))
          : null,
      child: _loading && _clubs.isEmpty && _mine.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: FilledButton(onPressed: _load, child: Text(_error!))))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 100), children: children),
            ),
    );
  }

  Widget _empty(String text) => AdminPanel(
        child: Column(children: [
          const Icon(Icons.flag_rounded, size: 36),
          const SizedBox(height: 8),
          Text(text.tr, style: const TextStyle(fontWeight: FontWeight.w800), textAlign: TextAlign.center),
        ]),
      );
}

/// Kulüp kartı: kategori, danışman, doluluk, sıradaki etkinlik.
class ClubTile extends StatelessWidget {
  final Map<String, dynamic> club;
  final VoidCallback onTap;
  final Widget? footer;
  const ClubTile({super.key, required this.club, required this.onTap, this.footer});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final meta = _categoryOf(club['category']);
    final color = _parseColor(club['color']);
    final capacity = (club['capacity'] as num?)?.toInt() ?? 0;
    final members = (club['memberCount'] as num?)?.toInt() ?? 0;
    final pending = (club['pendingCount'] as num?)?.toInt() ?? 0;
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(height: 4, color: color),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
                        child: Icon(meta.icon, color: Colors.white),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(meta.label.tr.toUpperCase(), style: theme.textTheme.labelSmall?.copyWith(color: theme.hintColor)),
                          Text('${club['name']}', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                        ]),
                      ),
                      if (pending > 0) AdminAccentBadge(label: '$pending ${'istek'.tr}', color: const Color(0xFFD97706)),
                      if (club['status'] == 'Archived') AdminAccentBadge(label: 'Arşiv'.tr, color: Colors.grey),
                    ]),
                    if ('${club['description'] ?? ''}'.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text('${club['description']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: theme.hintColor)),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      '${'Danışman:'.tr} ${'${club['advisorTeacherName'] ?? ''}'.isEmpty ? 'Atanmadı'.tr : club['advisorTeacherName']}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    if ('${club['meetingSchedule'] ?? ''}'.isNotEmpty)
                      Text('${club['meetingSchedule']}${'${club['location'] ?? ''}'.isEmpty ? '' : ' • ${club['location']}'}', style: TextStyle(color: theme.hintColor)),
                    if (club['nextActivityAtUtc'] != null)
                      Text('${'Sıradaki:'.tr} ${_dateTime(club['nextActivityAtUtc'])}', style: TextStyle(color: theme.hintColor)),
                    const SizedBox(height: 8),
                    Text(
                      '$members ${'üye'.tr}${capacity > 0 ? ' / $capacity' : ''}',
                      style: theme.textTheme.labelMedium?.copyWith(color: theme.hintColor),
                    ),
                    if (capacity > 0) ...[
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: (members / capacity).clamp(0, 1).toDouble(),
                          minHeight: 6,
                          color: color,
                          backgroundColor: color.withValues(alpha: 0.15),
                        ),
                      ),
                    ],
                    if (footer != null) ...[const Divider(height: 20), footer!],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Kulüp detayı: üyeler, istekler, etkinlikler; yönetim düğmeleri canManage ise.
class ClubDetailPage extends StatefulWidget {
  final String clubId;
  final bool canEdit;
  const ClubDetailPage({super.key, required this.clubId, this.canEdit = false});

  @override
  State<ClubDetailPage> createState() => _ClubDetailPageState();
}

class _ClubDetailPageState extends State<ClubDetailPage> {
  final _api = ClubsApiService.instance;
  Map<String, dynamic>? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await _api.detail(widget.clubId);
      if (mounted) setState(() => _detail = detail);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
      await _load();
    } catch (error) {
      if (mounted) _snack(context, '$error');
    }
  }

  Future<void> _addMember() async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _StudentPicker(clubId: widget.clubId),
    );
    if (picked != null) await _run(() => _api.addMember(widget.clubId, '${picked['userId']}'));
  }

  Future<void> _editActivity([Map<String, dynamic>? activity]) async {
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => _ActivityEditorPage(clubId: widget.clubId, activity: activity),
    ));
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    if (_error != null) return AdminScaffold(appBar: AppBar(), child: Center(child: Text(_error!)));
    if (detail == null) return AdminScaffold(appBar: AppBar(), child: const Center(child: CircularProgressIndicator()));
    final club = Map<String, dynamic>.from(detail['club'] as Map);
    final manage = club['canManage'] == true;
    final members = ((detail['members'] as List?) ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();
    final active = members.where((member) => member['status'] == 'Active').toList();
    final pending = members.where((member) => member['status'] == 'Pending').toList();
    final activities = ((detail['activities'] as List?) ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();
    final meta = _categoryOf(club['category']);

    return DefaultTabController(
      length: manage ? 3 : 2,
      child: AdminScaffold(
        appBar: AppBar(
          title: Text('${club['name']}'),
          actions: [
            if (widget.canEdit && manage)
              IconButton(
                tooltip: 'Düzenle'.tr,
                icon: const Icon(Icons.edit_outlined),
                onPressed: () async {
                  final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => ClubEditorPage(club: club)));
                  if (saved == true) await _load();
                },
              ),
          ],
          bottom: TabBar(tabs: [
            Tab(text: '${'Üyeler'.tr} (${active.length})'),
            if (manage) Tab(text: '${'İstekler'.tr} (${pending.length})'),
            Tab(text: '${'Etkinlikler'.tr} (${activities.length})'),
          ]),
        ),
        child: TabBarView(children: [
          ListView(padding: const EdgeInsets.all(16), children: [
            Text('${meta.label.tr} • ${club['academicYear']} • ${'Danışman:'.tr} ${'${club['advisorTeacherName'] ?? ''}'.isEmpty ? 'Atanmadı'.tr : club['advisorTeacherName']}'),
            if ('${club['description'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${club['description']}')),
            const SizedBox(height: 10),
            if (manage) OutlinedButton.icon(onPressed: _addMember, icon: const Icon(Icons.person_add_alt_rounded), label: Text('Öğrenci Ekle'.tr)),
            if (active.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('Henüz üye yok.'.tr)),
            ...active.map((member) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${member['studentName']}'),
                  subtitle: Text('${member['className']}'),
                  trailing: manage
                      ? PopupMenuButton<String>(
                          tooltip: 'Görev'.tr,
                          onSelected: (value) => value == 'remove'
                              ? _run(() => _api.updateMember(widget.clubId, '${member['id']}', 'remove'))
                              : _run(() => _api.updateMember(widget.clubId, '${member['id']}', 'setRole', role: value)),
                          itemBuilder: (_) => [
                            ..._roles.entries.map((entry) => CheckedPopupMenuItem(value: entry.key, checked: member['role'] == entry.key, child: Text(entry.value.tr))),
                            const PopupMenuDivider(),
                            PopupMenuItem(value: 'remove', child: Text('Kulüpten çıkar'.tr)),
                          ],
                          child: Chip(label: Text(_roleLabel(member['role']))),
                        )
                      : (member['role'] != 'Member' ? Chip(label: Text(_roleLabel(member['role']))) : null),
                )),
          ]),
          if (manage)
            ListView(padding: const EdgeInsets.all(16), children: [
              if (pending.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('Bekleyen istek yok.'.tr)),
              ...pending.map((member) => AdminPanel(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${member['studentName']} • ${member['className']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      if ('${member['requestNote'] ?? ''}'.isNotEmpty) Text('“${member['requestNote']}”'),
                      Text(_dateTime(member['requestedAtUtc']), style: const TextStyle(fontSize: 12)),
                      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                        TextButton(
                          onPressed: () => _run(() => _api.updateMember(widget.clubId, '${member['id']}', 'reject')),
                          child: Text('Reddet'.tr),
                        ),
                        FilledButton(
                          onPressed: () => _run(() => _api.updateMember(widget.clubId, '${member['id']}', 'approve', role: 'Member')),
                          child: Text('Onayla'.tr),
                        ),
                      ]),
                    ]),
                  )),
            ]),
          ListView(padding: const EdgeInsets.all(16), children: [
            if (manage) OutlinedButton.icon(onPressed: () => _editActivity(), icon: const Icon(Icons.event_available_rounded), label: Text('Etkinlik Planla'.tr)),
            if (activities.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('Henüz etkinlik yok.'.tr)),
            ...activities.map((activity) => AdminPanel(
                  margin: const EdgeInsets.only(top: 10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text('${activity['title']}', style: const TextStyle(fontWeight: FontWeight.w800))),
                      AdminAccentBadge(
                        label: (_activityStatus['${activity['status']}'] ?? '${activity['status']}').tr,
                        color: activity['status'] == 'Completed' ? const Color(0xFF16A34A) : const Color(0xFF2563EB),
                      ),
                      if (manage) ...[
                        IconButton(tooltip: 'Etkinliği düzenle'.tr, onPressed: () => _editActivity(activity), icon: const Icon(Icons.edit_outlined)),
                        IconButton(
                          tooltip: 'Etkinliği sil'.tr,
                          onPressed: () => _run(() => _api.deleteActivity(widget.clubId, '${activity['id']}')),
                          icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
                        ),
                      ],
                    ]),
                    Text('${_dateTime(activity['startsAtUtc'])}${'${activity['location'] ?? ''}'.isEmpty ? '' : ' • ${activity['location']}'}'),
                    if ('${activity['description'] ?? ''}'.isNotEmpty) Text('${activity['description']}'),
                    if (activity['status'] == 'Completed' && '${activity['outcome'] ?? ''}'.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text('${activity['attendeeCount'] ?? ''} ${'Katılımcı'.tr}: ${activity['outcome']}'),
                      ),
                  ]),
                )),
          ]),
        ]),
      ),
    );
  }
}

class _StudentPicker extends StatefulWidget {
  final String clubId;
  const _StudentPicker({required this.clubId});

  @override
  State<_StudentPicker> createState() => _StudentPickerState();
}

class _StudentPickerState extends State<_StudentPicker> {
  List<Map<String, dynamic>> _options = [];

  @override
  void initState() {
    super.initState();
    _search('');
  }

  Future<void> _search(String text) async {
    try {
      final options = await ClubsApiService.instance.studentOptions(widget.clubId, text);
      if (mounted) setState(() => _options = options);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: SizedBox(
        height: 420,
        child: Column(children: [
          TextField(
            autofocus: true,
            onChanged: _search,
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: 'Öğrenci adı veya sınıf...'.tr),
          ),
          Expanded(
            child: _options.isEmpty
                ? Center(child: Text('Eşleşen öğrenci yok.'.tr))
                : ListView(children: _options.map((option) => ListTile(
                      title: Text('${option['fullName']}'),
                      subtitle: Text('${option['detail']}'),
                      onTap: () => Navigator.pop(context, option),
                    )).toList()),
          ),
        ]),
      ),
    );
  }
}

/// Kulüp açma/düzenleme (yönetici).
class ClubEditorPage extends StatefulWidget {
  final Map<String, dynamic>? club;
  const ClubEditorPage({super.key, this.club});

  @override
  State<ClubEditorPage> createState() => _ClubEditorPageState();
}

class _ClubEditorPageState extends State<ClubEditorPage> {
  late final TextEditingController _name = TextEditingController(text: '${widget.club?['name'] ?? ''}');
  late final TextEditingController _description = TextEditingController(text: '${widget.club?['description'] ?? ''}');
  late final TextEditingController _capacity = TextEditingController(
    text: ((widget.club?['capacity'] as num?)?.toInt() ?? 0) > 0 ? '${widget.club?['capacity']}' : '',
  );
  late final TextEditingController _schedule = TextEditingController(text: '${widget.club?['meetingSchedule'] ?? ''}');
  late final TextEditingController _location = TextEditingController(text: '${widget.club?['location'] ?? ''}');
  late String _category = '${widget.club?['category'] ?? 'Science'}';
  late String? _advisor = widget.club?['advisorTeacherUserId'] as String?;
  late bool _acceptsRequests = widget.club?['acceptsRequests'] != false;
  late bool _archived = widget.club?['status'] == 'Archived';
  List<Map<String, dynamic>> _teachers = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    ClubsApiService.instance.teacherOptions().then((list) {
      if (mounted) setState(() => _teachers = list);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    for (final controller in [_name, _description, _capacity, _schedule, _location]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 2) {
      _snack(context, 'Kulüp adını yazın.'.tr);
      return;
    }
    final meta = _categoryOf(_category);
    setState(() => _saving = true);
    try {
      await ClubsApiService.instance.save(widget.club?['id'] as String?, {
        'name': _name.text.trim(),
        'category': _category,
        'description': _description.text.trim(),
        'academicYear': '${widget.club?['academicYear'] ?? _currentAcademicYear()}',
        'advisorTeacherUserId': _advisor,
        'capacity': int.tryParse(_capacity.text.trim()) ?? 0,
        'meetingSchedule': _schedule.text.trim(),
        'location': _location.text.trim(),
        'color': widget.club?['color'] ?? '#${(meta.color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}',
        'acceptsRequests': _acceptsRequests,
        'status': _archived ? 'Archived' : 'Active',
      });
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _snack(context, '$error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        content: Text('${widget.club?['name']} silinsin mi? Üyelik ve etkinlik kayıtları da silinir.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: Text('Sil'.tr)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ClubsApiService.instance.delete('${widget.club?['id']}');
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _snack(context, '$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: Text(widget.club == null ? 'Yeni Kulüp'.tr : 'Kulübü Düzenle'.tr),
        actions: [
          if (widget.club != null) IconButton(tooltip: 'Sil'.tr, onPressed: _delete, icon: const Icon(Icons.delete_outline_rounded)),
          TextButton(onPressed: _saving ? null : _save, child: Text('Kaydet'.tr)),
        ],
      ),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        AdminPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: _name, maxLength: 120, decoration: InputDecoration(labelText: 'Kulüp adı *'.tr)),
            Text('Kategori'.tr, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _categories.map((item) => ChoiceChip(
                    avatar: Icon(item.icon, size: 16, color: _category == item.key ? Colors.white : item.color),
                    label: Text(item.label.tr),
                    selected: _category == item.key,
                    selectedColor: item.color,
                    labelStyle: TextStyle(color: _category == item.key ? Colors.white : null),
                    onSelected: (_) => setState(() => _category = item.key),
                  )).toList(),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: _teachers.any((teacher) => teacher['userId'] == _advisor) ? _advisor : null,
              decoration: InputDecoration(labelText: 'Danışman öğretmen'.tr),
              items: [
                DropdownMenuItem<String?>(value: null, child: Text('— Atanmadı —'.tr)),
                ..._teachers.map((teacher) => DropdownMenuItem<String?>(value: '${teacher['userId']}', child: Text('${teacher['fullName']}'))),
              ],
              onChanged: (value) => setState(() => _advisor = value),
            ),
            TextField(controller: _capacity, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Kontenjan'.tr, hintText: 'Boş = sınırsız'.tr)),
            TextField(controller: _schedule, decoration: InputDecoration(labelText: 'Toplantı günü/saati'.tr, hintText: 'Örn: Çarşamba 15:30'.tr)),
            TextField(controller: _location, decoration: InputDecoration(labelText: 'Yer'.tr)),
            TextField(controller: _description, minLines: 2, maxLines: 5, decoration: InputDecoration(labelText: 'Açıklama'.tr)),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Öğrenciler katılma isteği gönderebilir'.tr),
              subtitle: Text('Kapalıysa üyeleri yalnız danışman ve yönetici ekler.'.tr),
              value: _acceptsRequests,
              onChanged: (value) => setState(() => _acceptsRequests = value),
            ),
            if (widget.club != null)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Arşivle'.tr),
                subtitle: Text('Arşivdeki kulüp öğrencilere görünmez; kayıtları korunur.'.tr),
                value: _archived,
                onChanged: (value) => setState(() => _archived = value),
              ),
          ]),
        ),
      ]),
    );
  }
}

class _ActivityEditorPage extends StatefulWidget {
  final String clubId;
  final Map<String, dynamic>? activity;
  const _ActivityEditorPage({required this.clubId, this.activity});

  @override
  State<_ActivityEditorPage> createState() => _ActivityEditorPageState();
}

class _ActivityEditorPageState extends State<_ActivityEditorPage> {
  late final TextEditingController _title = TextEditingController(text: '${widget.activity?['title'] ?? ''}');
  late final TextEditingController _description = TextEditingController(text: '${widget.activity?['description'] ?? ''}');
  late final TextEditingController _location = TextEditingController(text: '${widget.activity?['location'] ?? ''}');
  late final TextEditingController _attendees = TextEditingController(text: '${widget.activity?['attendeeCount'] ?? ''}');
  late final TextEditingController _outcome = TextEditingController(text: '${widget.activity?['outcome'] ?? ''}');
  late DateTime _startsAt = DateTime.tryParse('${widget.activity?['startsAtUtc'] ?? ''}')?.toLocal() ?? DateTime.now().add(const Duration(days: 1));
  late String _status = '${widget.activity?['status'] ?? 'Planned'}';
  bool _saving = false;

  @override
  void dispose() {
    for (final controller in [_title, _description, _location, _attendees, _outcome]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(context: context, initialDate: _startsAt, firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_startsAt));
    if (time == null) return;
    setState(() => _startsAt = DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _save() async {
    if (_title.text.trim().length < 2) {
      _snack(context, 'Etkinlik başlığını yazın.'.tr);
      return;
    }
    setState(() => _saving = true);
    try {
      await ClubsApiService.instance.saveActivity(widget.clubId, widget.activity?['id'] as String?, {
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'startsAtUtc': _startsAt.toUtc().toIso8601String(),
        'location': _location.text.trim(),
        'status': _status,
        'attendeeCount': _status == 'Completed' ? int.tryParse(_attendees.text.trim()) : null,
        'outcome': _status == 'Completed' ? _outcome.text.trim() : '',
      });
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _snack(context, '$error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: Text(widget.activity == null ? 'Etkinlik Planla'.tr : 'Etkinliği Düzenle'.tr),
        actions: [TextButton(onPressed: _saving ? null : _save, child: Text('Kaydet'.tr))],
      ),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        AdminPanel(
          child: Column(children: [
            TextField(controller: _title, maxLength: 160, decoration: InputDecoration(labelText: 'Başlık *'.tr)),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event_rounded),
              title: Text('Tarih ve saat'.tr),
              subtitle: Text(_dateTime(_startsAt.toIso8601String())),
              onTap: _pickDateTime,
            ),
            TextField(controller: _location, decoration: InputDecoration(labelText: 'Yer'.tr)),
            TextField(controller: _description, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: 'Açıklama'.tr)),
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: InputDecoration(labelText: 'Durum'.tr),
              items: _activityStatus.entries.map((entry) => DropdownMenuItem(value: entry.key, child: Text(entry.value.tr))).toList(),
              onChanged: (value) => setState(() => _status = value ?? _status),
            ),
            if (_status == 'Completed') ...[
              TextField(controller: _attendees, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Katılımcı'.tr)),
              TextField(controller: _outcome, minLines: 2, maxLines: 5, decoration: InputDecoration(labelText: 'Etkinlik raporu'.tr)),
            ],
          ]),
        ),
      ]),
    );
  }
}
