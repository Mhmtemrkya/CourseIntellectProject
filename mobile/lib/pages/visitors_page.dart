import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/module_api_client.dart';
import '../widgets/admin_ui.dart';

const _types = {
  'Parent': 'Veli',
  'Guest': 'Misafir',
  'Supplier': 'Tedarikçi / Kargo',
  'Official': 'Resmî Görevli',
  'JobCandidate': 'İş Görüşmesi',
  'Maintenance': 'Teknik Servis',
  'Other': 'Diğer',
};

const _departments = ['Müdür', 'Müdür Yardımcısı', 'Rehberlik Servisi', 'Muhasebe', 'Kayıt Birimi', 'Öğretmenler Odası'];

String _time(Object? raw) {
  final value = DateTime.tryParse('${raw ?? ''}')?.toLocal();
  if (value == null) return '—';
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(value.day)}.${two(value.month)} ${two(value.hour)}:${two(value.minute)}';
}

String _duration(Object? minutes) {
  final value = (minutes as num?)?.toInt() ?? 0;
  return value < 60 ? '$value dk' : '${value ~/ 60} sa ${value % 60} dk';
}

/// Ziyaretçi takibi (idari personel / yönetici). Masaüstü VisitorsPage ile aynı
/// kurallar: KVKK aydınlatması zorunlu, kimlik numarasının yalnız son 4 hanesi saklanır.
class VisitorsPage extends StatefulWidget {
  const VisitorsPage({super.key});

  @override
  State<VisitorsPage> createState() => _VisitorsPageState();
}

class _VisitorsPageState extends State<VisitorsPage> {
  final _client = ModuleApiClient.instance;
  final _search = TextEditingController();
  bool _insideOnly = true;
  DateTime _day = DateTime.now();
  Map<String, dynamic>? _data;
  String? _error;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _load();
    AuthSessionStore.instance.load().then((session) {
      if (!mounted || session == null) return;
      final roles = {session.primaryRole, ...session.extraRoles}.map((role) => role.toLowerCase());
      setState(() => _isAdmin = roles.contains('admin') || roles.contains('branchmanager'));
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final start = DateTime(_day.year, _day.month, _day.day);
      final data = asMap(await _client.get('/api/visitors', {
        'search': _search.text.trim(),
        if (_insideOnly) 'status': 'inside',
        if (!_insideOnly) 'fromUtc': start.toUtc().toIso8601String(),
        if (!_insideOnly) 'toUtc': start.add(const Duration(days: 1)).toUtc().toIso8601String(),
      }));
      if (mounted) {
        setState(() {
          _data = data;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  void _snack(String text) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _checkOut(Map<String, dynamic> visitor) async {
    try {
      await _client.post('/api/visitors/${visitor['id']}/checkout', {});
      _snack('${visitor['fullName']} ${'çıkış yaptı'.tr}');
      await _load();
    } catch (error) {
      _snack('$error');
    }
  }

  Future<void> _delete(Map<String, dynamic> visitor) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        content: Text('${visitor['fullName']} kaydı kalıcı olarak silinsin mi? (KVKK silme talebi için)'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: Text('Sil'.tr)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _client.delete('/api/visitors/${visitor['id']}');
      await _load();
    } catch (error) {
      _snack('$error');
    }
  }

  Future<void> _openEditor([Map<String, dynamic>? visitor]) async {
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => _VisitorEditorPage(visitor: visitor)));
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final summary = asMap(_data?['summary']);
    final items = asMapList(_data?['items']);
    return AdminScaffold(
      appBar: AppBar(title: Text('Ziyaretçi Takibi'.tr)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.login_rounded),
        label: Text('Ziyaretçi Girişi'.tr),
      ),
      child: _error != null && _data == null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: FilledButton(onPressed: _load, child: Text(_error!))))
          : _data == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  AdminHeroCard(
                    eyebrow: 'Danışma'.tr,
                    title: 'Ziyaretçi Takibi'.tr,
                    description: 'Okula gelen ziyaretçilerin giriş-çıkışını kaydedin; ziyaret edilen kişiye anında haber verin.'.tr,
                    colors: const [Color(0xFF0F172A), Color(0xFF0D9488)],
                    metrics: [
                      AdminHeroMetric(label: 'Şu an içeride'.tr, value: '${summary['insideCount'] ?? 0}'),
                      AdminHeroMetric(label: 'Bugünkü ziyaret'.tr, value: '${summary['todayCount'] ?? 0}'),
                      AdminHeroMetric(label: 'Uzun süredir içeride'.tr, value: '${summary['overstayCount'] ?? 0}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SegmentedButton<bool>(
                    segments: [
                      ButtonSegment(value: true, label: Text('İçeridekiler'.tr), icon: const Icon(Icons.how_to_reg_rounded)),
                      ButtonSegment(value: false, label: Text('Gün Geçmişi'.tr), icon: const Icon(Icons.history_rounded)),
                    ],
                    selected: {_insideOnly},
                    onSelectionChanged: (value) {
                      setState(() => _insideOnly = value.first);
                      _load();
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: _search,
                        onSubmitted: (_) => _load(),
                        decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: 'Ad, telefon, kart no, ziyaret edilen...'.tr),
                      ),
                    ),
                    if (!_insideOnly)
                      IconButton(
                        tooltip: 'Tarih'.tr,
                        icon: const Icon(Icons.event_rounded),
                        onPressed: () async {
                          final picked = await showDatePicker(context: context, initialDate: _day, firstDate: DateTime(2020), lastDate: DateTime.now());
                          if (picked == null) return;
                          setState(() => _day = picked);
                          await _load();
                        },
                      ),
                  ]),
                  const SizedBox(height: 8),
                  if (items.isEmpty)
                    AdminPanel(
                      child: Column(children: [
                        const Icon(Icons.door_front_door_outlined, size: 36),
                        const SizedBox(height: 8),
                        Text((_insideOnly ? 'Şu an içeride ziyaretçi yok' : 'Bu gün için kayıt yok').tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                      ]),
                    ),
                  ...items.map((visitor) {
                    final inside = visitor['checkOutAtUtc'] == null;
                    final overstay = inside && ((visitor['durationMinutes'] as num?) ?? 0) > 180;
                    return AdminPanel(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          CircleAvatar(
                            backgroundColor: (inside ? const Color(0xFF16A34A) : Colors.grey).withValues(alpha: 0.15),
                            child: Icon(inside ? Icons.login_rounded : Icons.logout_rounded, color: inside ? const Color(0xFF16A34A) : Colors.grey),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${visitor['fullName']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text('${(_types['${visitor['visitorType']}'] ?? '${visitor['visitorType']}').tr}'
                                  '${'${visitor['badgeNo'] ?? ''}'.isEmpty ? '' : ' • ${visitor['badgeNo']}'}'),
                            ]),
                          ),
                          if (overstay) AdminAccentBadge(label: _duration(visitor['durationMinutes']), color: const Color(0xFFDC2626)),
                        ]),
                        const SizedBox(height: 6),
                        Text('→ ${visitor['hostName']} • ${visitor['purpose']}'),
                        if ('${visitor['studentName'] ?? ''}'.isNotEmpty) Text('${'Öğrenci'.tr}: ${visitor['studentName']}'),
                        Text(
                          '${'Giriş'.tr} ${_time(visitor['checkInAtUtc'])}'
                          '${inside ? '' : ' • ${'Çıkış'.tr} ${_time(visitor['checkOutAtUtc'])}'} • ${_duration(visitor['durationMinutes'])}',
                          style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12),
                        ),
                        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                          IconButton(tooltip: 'Düzenle'.tr, onPressed: () => _openEditor(visitor), icon: const Icon(Icons.edit_outlined)),
                          if (_isAdmin)
                            IconButton(
                              tooltip: 'Sil'.tr,
                              onPressed: () => _delete(visitor),
                              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
                            ),
                          if (inside)
                            FilledButton.icon(onPressed: () => _checkOut(visitor), icon: const Icon(Icons.logout_rounded), label: Text('Çıkış'.tr)),
                        ]),
                      ]),
                    );
                  }),
                  Text(
                    'KVKK: Kimlik numarasının yalnız son 4 hanesi saklanır. Kayıtlar {n} gün sonra otomatik silinir.'.tr.replaceFirst('{n}', '${_data?['retentionDays'] ?? 365}'),
                    style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12),
                  ),
                ],
              ),
            ),
    );
  }
}

class _VisitorEditorPage extends StatefulWidget {
  final Map<String, dynamic>? visitor;
  const _VisitorEditorPage({this.visitor});

  @override
  State<_VisitorEditorPage> createState() => _VisitorEditorPageState();
}

class _VisitorEditorPageState extends State<_VisitorEditorPage> {
  final _client = ModuleApiClient.instance;
  late final _name = TextEditingController(text: '${widget.visitor?['fullName'] ?? ''}');
  late final _phone = TextEditingController(text: '${widget.visitor?['phone'] ?? ''}');
  final _identity = TextEditingController();
  late final _purpose = TextEditingController(text: '${widget.visitor?['purpose'] ?? ''}');
  late final _hostName = TextEditingController(text: widget.visitor != null && widget.visitor?['hostUserId'] == null ? '${widget.visitor?['hostName'] ?? ''}' : '');
  late final _badge = TextEditingController(text: '${widget.visitor?['badgeNo'] ?? ''}');
  late final _plate = TextEditingController(text: '${widget.visitor?['vehiclePlate'] ?? ''}');
  late final _companions = TextEditingController(text: '${widget.visitor?['companionCount'] ?? 0}');
  late final _note = TextEditingController(text: '${widget.visitor?['note'] ?? ''}');
  late final _studentSearch = TextEditingController(text: '${widget.visitor?['studentName'] ?? ''}');
  late String _type = '${widget.visitor?['visitorType'] ?? 'Parent'}';
  late bool _hostIsPerson = widget.visitor == null || widget.visitor?['hostUserId'] != null;
  late String? _hostUserId = widget.visitor?['hostUserId'] as String?;
  late String? _studentUserId = widget.visitor?['studentUserId'] as String?;
  bool _privacy = false;
  bool _saving = false;
  List<Map<String, dynamic>> _hosts = [];
  List<Map<String, dynamic>> _suggestions = [];
  List<Map<String, dynamic>> _students = [];

  @override
  void initState() {
    super.initState();
    _client.get('/api/visitors/hosts').then((value) {
      if (mounted) setState(() => _hosts = asMapList(value));
    }).catchError((_) {});
  }

  @override
  void dispose() {
    for (final controller in [_name, _phone, _identity, _purpose, _hostName, _badge, _plate, _companions, _note, _studentSearch]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _lookup(String text) async {
    if (widget.visitor != null || text.trim().length < 2) {
      setState(() => _suggestions = []);
      return;
    }
    try {
      final list = asMapList(await _client.get('/api/visitors/lookup', {'q': text.trim()}));
      if (mounted) setState(() => _suggestions = list);
    } catch (_) {}
  }

  Future<void> _findStudents(String text) async {
    _studentUserId = null;
    if (text.trim().length < 2) {
      setState(() => _students = []);
      return;
    }
    try {
      final list = asMapList(await _client.get('/api/visitors/students', {'search': text.trim()}));
      if (mounted) setState(() => _students = list);
    } catch (_) {}
  }

  Future<void> _save() async {
    if (widget.visitor == null && !_privacy) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('KVKK aydınlatma metnini ziyaretçiye bildirdiğinizi işaretleyin.'.tr)));
      return;
    }
    final body = <String, dynamic>{
      'fullName': _name.text.trim(),
      'phone': _phone.text.trim(),
      'visitorType': _type,
      'purpose': _purpose.text.trim(),
      'hostUserId': _hostIsPerson ? _hostUserId : null,
      'hostName': _hostIsPerson ? null : _hostName.text.trim(),
      'studentUserId': _type == 'Parent' ? _studentUserId : null,
      'badgeNo': _badge.text.trim(),
      'vehiclePlate': _plate.text.trim(),
      'companionCount': int.tryParse(_companions.text.trim()) ?? 0,
      'note': _note.text.trim(),
    };
    setState(() => _saving = true);
    try {
      if (widget.visitor == null) {
        await _client.post('/api/visitors', {...body, 'identity': _identity.text.trim(), 'privacyNoticeShown': _privacy});
      } else {
        await _client.put('/api/visitors/${widget.visitor!['id']}', body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isNew = widget.visitor == null;
    return AdminScaffold(
      appBar: AppBar(
        title: Text(isNew ? 'Ziyaretçi Girişi'.tr : 'Ziyaretçi Kaydını Düzenle'.tr),
        actions: [TextButton(onPressed: _saving ? null : _save, child: Text(isNew ? 'Girişi Kaydet'.tr : 'Kaydet'.tr))],
      ),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        AdminPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: _name, onChanged: _lookup, decoration: InputDecoration(labelText: 'Ad soyad *'.tr)),
            ..._suggestions.map((item) => ListTile(
                  dense: true,
                  leading: const Icon(Icons.history_rounded),
                  title: Text('${item['fullName']}'),
                  subtitle: Text('${item['phone']} • ${'{n} ziyaret'.tr.replaceFirst('{n}', '${item['visitCount']}')}'),
                  onTap: () => setState(() {
                    _name.text = '${item['fullName']}';
                    _phone.text = '${item['phone']}';
                    _type = '${item['visitorType']}';
                    _purpose.text = '${item['lastPurpose']}';
                    _suggestions = [];
                  }),
                )),
            TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: 'Telefon'.tr)),
            if (isNew)
              TextField(
                controller: _identity,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Kimlik no (isteğe bağlı)'.tr, helperText: 'Yalnız son 4 hanesi saklanır'.tr),
              ),
            const SizedBox(height: 10),
            Text('Ziyaretçi türü'.tr, style: Theme.of(context).textTheme.labelLarge),
            Wrap(
              spacing: 6,
              children: _types.entries.map((entry) => ChoiceChip(
                    label: Text(entry.value.tr),
                    selected: _type == entry.key,
                    onSelected: (_) => setState(() => _type = entry.key),
                  )).toList(),
            ),
            TextField(controller: _purpose, decoration: InputDecoration(labelText: 'Ziyaret amacı *'.tr, hintText: 'Örn: Veli görüşmesi, evrak teslimi'.tr)),
            const SizedBox(height: 12),
            SegmentedButton<bool>(
              segments: [
                ButtonSegment(value: true, label: Text('Personel'.tr)),
                ButtonSegment(value: false, label: Text('Birim'.tr)),
              ],
              selected: {_hostIsPerson},
              onSelectionChanged: (value) => setState(() => _hostIsPerson = value.first),
            ),
            if (_hostIsPerson)
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _hosts.any((host) => host['userId'] == _hostUserId) ? _hostUserId : null,
                hint: Text('— Ziyaret edilen kişiyi seçin —'.tr),
                items: _hosts.map((host) => DropdownMenuItem(value: '${host['userId']}', child: Text('${host['fullName']} • ${host['role']}', overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (value) => setState(() => _hostUserId = value),
              )
            else ...[
              Wrap(
                spacing: 6,
                children: _departments.map((item) => ActionChip(label: Text(item.tr), onPressed: () => setState(() => _hostName.text = item))).toList(),
              ),
              TextField(controller: _hostName, decoration: InputDecoration(labelText: 'Birim adı'.tr)),
            ],
            Text('Personel seçilirse gelişinde kendisine bildirim gider.'.tr, style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
            if (_type == 'Parent') ...[
              TextField(controller: _studentSearch, onChanged: _findStudents, decoration: InputDecoration(labelText: 'İlgili öğrenci'.tr)),
              ..._students.map((student) => ListTile(
                    dense: true,
                    title: Text('${student['fullName']}'),
                    subtitle: Text('${student['className']}'),
                    onTap: () => setState(() {
                      _studentUserId = '${student['userId']}';
                      _studentSearch.text = '${student['fullName']} (${student['className']})';
                      _students = [];
                    }),
                  )),
            ],
            TextField(controller: _badge, decoration: InputDecoration(labelText: 'Ziyaretçi kartı no'.tr)),
            Row(children: [
              Expanded(child: TextField(controller: _plate, decoration: InputDecoration(labelText: 'Araç plakası'.tr))),
              const SizedBox(width: 10),
              SizedBox(width: 100, child: TextField(controller: _companions, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: 'Refakatçi'.tr))),
            ]),
            TextField(controller: _note, decoration: InputDecoration(labelText: 'Not'.tr)),
            if (isNew)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _privacy,
                onChanged: (value) => setState(() => _privacy = value ?? false),
                title: Text('KVKK aydınlatması yapıldı.'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('Ziyaretçiye, bilgilerinin okul güvenliği amacıyla kaydedildiği, yalnız yetkili personelce görüldüğü ve süresi dolunca silineceği bildirildi.'.tr),
              ),
          ]),
        ),
      ]),
    );
  }
}
