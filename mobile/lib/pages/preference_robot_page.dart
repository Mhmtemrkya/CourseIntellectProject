import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_locale.dart';
import '../services/module_api_client.dart';
import '../widgets/admin_ui.dart';

class _NetField {
  final String key;
  final String label;
  final int max;
  const _NetField(this.key, this.label, this.max);
}

const _tytFields = [
  _NetField('turkish', 'Türkçe', 40),
  _NetField('social', 'Sosyal Bilimler', 20),
  _NetField('math', 'Temel Matematik', 40),
  _NetField('science', 'Fen Bilimleri', 20),
];

const _aytFields = [
  _NetField('aytMath', 'AYT Matematik', 40),
  _NetField('physics', 'Fizik', 14),
  _NetField('chemistry', 'Kimya', 13),
  _NetField('biology', 'Biyoloji', 13),
  _NetField('literature', 'Edebiyat', 24),
  _NetField('history1', 'Tarih-1', 10),
  _NetField('geography1', 'Coğrafya-1', 6),
  _NetField('history2', 'Tarih-2', 11),
  _NetField('geography2', 'Coğrafya-2', 11),
  _NetField('philosophy', 'Felsefe Grubu', 12),
  _NetField('religion', 'Din Kültürü', 6),
  _NetField('foreignLanguage', 'Yabancı Dil (YDT)', 80),
];

const _lgsFields = [
  _NetField('turkish', 'Türkçe', 20),
  _NetField('math', 'Matematik', 20),
  _NetField('science', 'Fen Bilimleri', 20),
  _NetField('revolution', 'T.C. İnkılap Tarihi', 10),
  _NetField('religion', 'Din Kültürü', 10),
  _NetField('foreignLanguage', 'Yabancı Dil', 10),
];

const _scoreTypes = ['SAY', 'EA', 'SÖZ', 'DİL', 'TYT'];

const _bands = {
  'Target': ('Hedef', 'Puanın taban puana yakın', Color(0xFF2563EB)),
  'Reach': ('Zorlayıcı', 'Taban puanın biraz altındasın', Color(0xFFD97706)),
  'Safe': ('Rahat', 'Taban puanın belirgin üstündesin', Color(0xFF16A34A)),
  'Far': ('Uzak', 'Taban puanın çok altındasın', Color(0xFFE11D48)),
};

/// Türkçe harfleri katlar: "İSTANBUL" ile "istanbul", "Ğ" ile "g" eşleşir.
String _fold(String text) => text
    .replaceAll('İ', 'i')
    .replaceAll('I', 'ı')
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replaceAll('\u0307', '');

class _PickOption {
  final String value;
  final String label;
  final String? detail;
  final String? hint;
  const _PickOption(this.value, this.label, {this.detail, this.hint});
}

String _fmt(Object? raw, [int digits = 2]) {
  final value = (raw as num?)?.toDouble();
  if (value == null) return '—';
  return value.toStringAsFixed(digits).replaceAll('.', ',');
}

double? _parse(String text) => double.tryParse(text.trim().replaceAll(',', '.'));

Future<void> _openSource(Object? url) async {
  final uri = Uri.tryParse('${url ?? ''}');
  if (uri != null && uri.scheme == 'https') await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// LGS/YKS tercih robotu. Masaüstü PreferenceRobotPage ile aynı uçlar ve kurallar:
/// resmî geçmiş taban puanları, netten puan yalnız tahmin, liste yalnız öğrencide kaydedilir.
class PreferenceRobotPage extends StatefulWidget {
  final bool canSave;
  const PreferenceRobotPage({super.key, this.canSave = false});

  @override
  State<PreferenceRobotPage> createState() => _PreferenceRobotPageState();
}

class _PreferenceRobotPageState extends State<PreferenceRobotPage> {
  final _client = ModuleApiClient.instance;
  final _score = TextEditingController();
  final _diploma = TextEditingController();
  final _query = TextEditingController();
  final Map<String, TextEditingController> _nets = {};
  Map<String, dynamic>? _meta;
  String? _error;
  String _exam = 'YKS';
  bool _fromNets = false;
  String _scoreType = 'SAY';
  String _city = '';
  String _university = '';
  String _department = '';
  String _institutionType = '';
  String _level = '';
  Map<String, dynamic>? _options;
  int _optionsRequest = 0;
  Map<String, dynamic>? _estimate;
  Map<String, dynamic>? _result;
  String _band = 'Target';
  bool _busy = false;
  List<Map<String, dynamic>> _choices = [];
  bool _choicesDirty = false;

  int get _maxChoices => _exam == 'LGS' ? 5 : 24;
  List<_NetField> get _fields => _exam == 'LGS' ? _lgsFields : [..._tytFields, ..._aytFields];

  @override
  void initState() {
    super.initState();
    _loadMeta();
    _loadChoices();
    _loadOptions();
  }

  /// İl → üniversite → bölüm listeleri; yalnız gerçekten var olan eşleşmeler gelir.
  Future<void> _loadOptions() async {
    final request = ++_optionsRequest;
    try {
      final options = asMap(
        await _client.get('/api/preference-robot/options', {
          'exam': _exam,
          'scoreType': _exam == 'LGS' ? '' : _scoreType,
          'level': _level,
          'institutionType': _institutionType,
          'city': _city,
          'university': _university,
        }),
      );
      if (!mounted || request != _optionsRequest) return;
      setState(() {
        _options = options;
        final universities = asMapList(options['universities']).map((item) => '${item['name']}').toSet();
        final departments = asMapList(options['departments']).map((item) => '${item['name']}').toSet();
        if (_university.isNotEmpty && !universities.contains(_university)) {
          _university = '';
          _department = '';
        }
        if (_department.isNotEmpty && !departments.contains(_department)) _department = '';
      });
    } catch (_) {
      if (mounted && request == _optionsRequest) setState(() => _options = null);
    }
  }

  /// Filtre değişince seçenekler ve (daha önce arandıysa) sonuçlar yenilenir.
  void _changeFilter(VoidCallback change) {
    setState(change);
    _loadOptions();
    if (_result != null) _search(silent: true);
  }

  Future<void> _pick({
    required String title,
    required String allLabel,
    required String value,
    required List<_PickOption> options,
    required ValueChanged<String> onChanged,
  }) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => _PickerSheet(title: title, allLabel: allLabel, value: value, options: options),
    );
    if (picked != null && picked != value) onChanged(picked);
  }

  Widget _pickerField({
    required String label,
    required String value,
    required String allLabel,
    required List<_PickOption> options,
    required ValueChanged<String> onChanged,
  }) {
    final selected = options.where((option) => option.value == value).firstOrNull;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _pick(title: label.tr, allLabel: allLabel, value: value, options: options, onChanged: onChanged),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label.tr,
          isDense: true,
          suffixIcon: value.isEmpty
              ? const Icon(Icons.unfold_more_rounded)
              : IconButton(tooltip: 'Seçimi temizle'.tr, icon: const Icon(Icons.close_rounded), onPressed: () => onChanged('')),
        ),
        child: Text(selected?.label ?? allLabel, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    );
  }

  @override
  void dispose() {
    for (final controller in [_score, _diploma, _query, ..._nets.values]) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _net(String key) => _nets.putIfAbsent(key, TextEditingController.new);

  void _snack(String text) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _loadMeta() async {
    try {
      final meta = asMap(await _client.get('/api/preference-robot/meta', {'exam': _exam}));
      if (mounted) setState(() => _meta = meta);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  Future<void> _loadChoices() async {
    if (!widget.canSave) return;
    try {
      final list = asMapList(await _client.get('/api/preference-robot/choices', {'exam': _exam}));
      if (!mounted) return;
      setState(() {
        _choices = list.map((item) => asMap(item['program'])).where((item) => item.isNotEmpty).toList();
        _choicesDirty = false;
      });
    } catch (_) {
      if (mounted) setState(() => _choices = []);
    }
  }

  void _switchExam(String exam) {
    setState(() {
      _exam = exam;
      _result = null;
      _estimate = null;
      _scoreType = exam == 'LGS' ? 'LGS' : 'SAY';
      _city = '';
      _university = '';
      _department = '';
      _institutionType = '';
      _level = '';
      _query.clear();
      _options = null;
      for (final controller in _nets.values) {
        controller.clear();
      }
    });
    _loadMeta();
    _loadChoices();
    _loadOptions();
  }

  Future<void> _calculate() async {
    final body = <String, dynamic>{'exam': _exam, 'diplomaGrade': _parse(_diploma.text)};
    for (final field in _fields) {
      final value = _parse(_net(field.key).text);
      if (value != null) body[field.key] = value;
    }
    try {
      final estimate = asMap(await _client.post('/api/preference-robot/estimate', body));
      final scores = asMapList(estimate['scores']);
      setState(() {
        _estimate = estimate;
        final best = scores.where((item) => item['scoreType'] == _scoreType).firstOrNull ?? scores.lastOrNull;
        if (best != null) {
          _scoreType = '${best['scoreType']}';
          _score.text = '${best['score']}';
        }
      });
    } catch (error) {
      _snack('$error');
    }
  }

  Future<void> _search({bool silent = false}) async {
    final score = _parse(_score.text);
    if (score == null || score == 0) {
      if (!silent) _snack('Puanını gir ya da netlerinden hesapla.'.tr);
      return;
    }
    setState(() => _busy = true);
    try {
      final result = asMap(
        await _client.post('/api/preference-robot/search', {
          'exam': _exam,
          'scoreType': _exam == 'LGS' ? 'LGS' : _scoreType,
          'score': score,
          'city': _city.isEmpty ? null : _city,
          'institutionType': _institutionType.isEmpty ? null : _institutionType,
          'level': _level.isEmpty ? null : _level,
          'query': _query.text.trim().isEmpty ? null : _query.text.trim(),
          'university': _university.isEmpty ? null : _university,
          'department': _department.isEmpty ? null : _department,
          'limit': 1000,
        }),
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        int count(String key) => ((result[key] as num?) ?? 0).toInt();
        _band = count('targetCount') > 0
            ? 'Target'
            : count('reachCount') > 0
            ? 'Reach'
            : count('safeCount') > 0
            ? 'Safe'
            : count('farCount') > 0
            ? 'Far'
            : 'Target';
      });
    } catch (error) {
      _snack('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _addChoice(Map<String, dynamic> item) {
    if (_choices.any((choice) => choice['code'] == item['code'])) return;
    if (_choices.length >= _maxChoices) {
      _snack('En fazla {n} tercih yapılabilir.'.tr.replaceFirst('{n}', '$_maxChoices'));
      return;
    }
    setState(() {
      _choices = [..._choices, item];
      _choicesDirty = true;
    });
  }

  Future<void> _saveChoices() async {
    try {
      await _client.put('/api/preference-robot/choices', {
        'exam': _exam,
        'items': _choices.map((item) => {'programCode': item['code'], 'note': null}).toList(),
      });
      setState(() => _choicesDirty = false);
      _snack('Tercih listen kaydedildi'.tr);
    } catch (error) {
      _snack('$error');
    }
  }

  Future<void> _openChoices() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) {
          void update(VoidCallback change) {
            setState(change);
            setSheet(() {});
          }

          return SafeArea(
            child: SizedBox(
              height: MediaQuery.of(sheet).size.height * 0.75,
              child: Column(
                children: [
                  ListTile(
                    title: Text('Tercih Listem'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                    trailing: AdminAccentBadge(label: '${_choices.length} / $_maxChoices', color: const Color(0xFF7C3AED)),
                  ),
                  Expanded(
                    child: _choices.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text('Sonuçlardan “Listeme ekle” ile tercih ekle.'.tr),
                            ),
                          )
                        : ReorderableListView.builder(
                            itemCount: _choices.length,
                            onReorder: (from, to) => update(() {
                              final list = [..._choices];
                              final item = list.removeAt(from);
                              list.insert(to > from ? to - 1 : to, item);
                              _choices = list;
                              _choicesDirty = true;
                            }),
                            itemBuilder: (_, index) {
                              final item = _choices[index];
                              return ListTile(
                                key: ValueKey(item['code']),
                                leading: CircleAvatar(radius: 14, child: Text('${index + 1}', style: const TextStyle(fontSize: 12))),
                                title: Text('${item['programName']}', maxLines: 2, overflow: TextOverflow.ellipsis),
                                subtitle: Text(
                                  '${item['institutionName']} • ${'Taban'.tr} ${_fmt(item['minScore'])}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: IconButton(
                                  tooltip: 'Listeden çıkar'.tr,
                                  icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
                                  onPressed: () => update(() {
                                    _choices = _choices.where((choice) => choice['code'] != item['code']).toList();
                                    _choicesDirty = true;
                                  }),
                                ),
                              );
                            },
                          ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                    child: SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _choicesDirty
                            ? () async {
                                await _saveChoices();
                                setSheet(() {});
                              }
                            : null,
                        icon: const Icon(Icons.save_rounded),
                        label: Text('Listeyi Kaydet'.tr),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(
                      'Bu liste yalnız planlama içindir; resmî tercih ÖSYM / MEB sisteminden yapılır.'.tr,
                      style: TextStyle(color: Theme.of(sheet).hintColor, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _netGrid(List<_NetField> fields) => LayoutBuilder(
    builder: (context, constraints) {
      final columns = constraints.maxWidth > 560 ? 4 : 2;
      final width = (constraints.maxWidth - (columns - 1) * 8) / columns;
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: fields
            .map(
              (field) => SizedBox(
                width: width,
                child: TextField(
                  controller: _net(field.key),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: '${field.label.tr} / ${field.max}', isDense: true),
                ),
              ),
            )
            .toList(),
      );
    },
  );

  Widget _dropdown(String label, String value, List<String> options, ValueChanged<String> onChanged, {Map<String, String>? labels}) =>
      DropdownButtonFormField<String>(
        key: ValueKey('$label-$_exam'),
        initialValue: value,
        isExpanded: true,
        decoration: InputDecoration(labelText: label.tr, isDense: true),
        items: [
          DropdownMenuItem(value: '', child: Text('Tümü'.tr)),
          ...options.map(
            (option) => DropdownMenuItem(
              value: option,
              child: Text((labels?[option] ?? option).tr, overflow: TextOverflow.ellipsis),
            ),
          ),
        ],
        onChanged: (selected) => onChanged(selected ?? ''),
      );

  @override
  Widget build(BuildContext context) {
    final meta = _meta;
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    if (meta == null) {
      return AdminScaffold(
        appBar: AppBar(title: Text('Tercih Robotu'.tr)),
        child: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Padding(
                  padding: const EdgeInsets.all(24),
                  child: FilledButton(onPressed: _loadMeta, child: Text(_error!)),
                ),
        ),
      );
    }
    final datasets = asMapList(meta['datasets']).where((item) => item['exam'] == _exam).toList();
    final lgsMissing = _exam == 'LGS' && meta['lgsAvailable'] != true;
    final result = _result;
    final visible = asMapList(result?['items']).where((item) => item['band'] == _band).toList();
    final total = datasets.fold<num>(0, (sum, item) => sum + ((item['count'] as num?) ?? 0));

    return AdminScaffold(
      appBar: AppBar(
        title: Text('Tercih Robotu'.tr),
        actions: [
          if (widget.canSave)
            IconButton(
              tooltip: 'Tercih Listem'.tr,
              onPressed: _openChoices,
              icon: Badge(
                label: Text('${_choices.length}'),
                isLabelVisible: _choices.isNotEmpty,
                child: const Icon(Icons.format_list_numbered_rounded),
              ),
            ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          AdminHeroCard(
            eyebrow: (_exam == 'LGS' ? 'LGS (Lise)' : 'YKS (Üniversite)').tr,
            title: 'Tercih Robotu'.tr,
            description: 'Puanına ya da netlerine göre geçmiş yılların resmî taban puanlarıyla uygun okul ve programları bul.'.tr,
            colors: const [Color(0xFF1E1B4B), Color(0xFF7C3AED)],
            metrics: [
              AdminHeroMetric(label: 'Yüklü program'.tr, value: '$total'),
              AdminHeroMetric(
                label: 'Veri kaynağı'.tr,
                value: datasets.map((item) => '${item['year']}').join(', ').isEmpty
                    ? '—'
                    : datasets.map((item) => '${item['year']}').join(', '),
              ),
              if (widget.canSave) AdminHeroMetric(label: 'Tercih Listem'.tr, value: '${_choices.length} / $_maxChoices'),
            ],
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'YKS', label: Text('YKS (Üniversite)'.tr), icon: const Icon(Icons.school_rounded)),
              ButtonSegment(value: 'LGS', label: Text('LGS (Lise)'.tr), icon: const Icon(Icons.apartment_rounded)),
            ],
            selected: {_exam},
            onSelectionChanged: (value) => _switchExam(value.first),
          ),
          const SizedBox(height: 12),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 18),
                    const SizedBox(width: 6),
                    Text('Veri kaynağı'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 6),
                if (datasets.isEmpty)
                  Text(
                    (lgsMissing
                            ? 'LGS okul taban puanları henüz yüklenmedi. MEB verisi yüklendiğinde arama açılır; netten puan hesaplama şimdi de kullanılabilir.'
                            : 'Veri yüklenmedi.')
                        .tr,
                    style: hint,
                  ),
                ...datasets.map(
                  (item) => InkWell(
                    onTap: () => _openSource(item['sourceUrl']),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text('${item['year']}: ${item['count']} • ${item['source']} ↗', style: hint),
                    ),
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
                Text('1. Puanın'.tr, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 8),
                SegmentedButton<bool>(
                  segments: [
                    ButtonSegment(value: false, label: Text('Puanımı biliyorum'.tr)),
                    ButtonSegment(value: true, label: Text('Netlerimden hesapla'.tr), icon: const Icon(Icons.calculate_outlined)),
                  ],
                  selected: {_fromNets},
                  onSelectionChanged: (value) => setState(() => _fromNets = value.first),
                ),
                if (_fromNets) ...[
                  const SizedBox(height: 12),
                  if (_exam == 'YKS') Text('TYT', style: hint),
                  const SizedBox(height: 6),
                  _netGrid(_exam == 'LGS' ? _lgsFields : _tytFields),
                  if (_exam == 'YKS') ...[
                    const SizedBox(height: 12),
                    Text('AYT (yalnız girdiğin testler)'.tr, style: hint),
                    const SizedBox(height: 6),
                    _netGrid(_aytFields),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: 200,
                      child: TextField(
                        controller: _diploma,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(labelText: 'Diploma notu (50-100)'.tr, hintText: 'Örn: 87,5'.tr, isDense: true),
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  FilledButton.tonalIcon(
                    onPressed: _calculate,
                    icon: const Icon(Icons.calculate_rounded),
                    label: Text('Puanımı Hesapla'.tr),
                  ),
                  if (_estimate != null) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: asMapList(_estimate!['scores'])
                          .map(
                            (item) => ChoiceChip(
                              selected: _scoreType == item['scoreType'],
                              label: Text('${item['scoreType']} ${_fmt(item['score'], 3)} ${'(tahmini)'.tr}'),
                              onSelected: (_) => setState(() {
                                _scoreType = '${item['scoreType']}';
                                _score.text = '${item['score']}';
                              }),
                            ),
                          )
                          .toList(),
                    ),
                    ...asList(_estimate!['warnings']).map(
                      (warning) => Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text('$warning'.tr, style: const TextStyle(color: Color(0xFFD97706), fontSize: 12)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text('${_estimate!['method']}'.tr, style: hint),
                  ],
                ],
                const SizedBox(height: 12),
                if (_exam == 'YKS') ...[
                  Text('Puan türü'.tr, style: hint),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 6,
                    children: _scoreTypes
                        .map(
                          (type) => ChoiceChip(
                            label: Text(type),
                            selected: _scoreType == type,
                            onSelected: (_) => _changeFilter(() => _scoreType = type),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 8),
                ],
                TextField(
                  controller: _score,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: (_exam == 'LGS' ? 'LGS puanı' : 'Yerleştirme puanı').tr,
                    hintText: 'Örn: 412,35'.tr,
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
                Row(
                  children: [
                    Expanded(
                      child: Text('2. Nerede, hangi bölüm?'.tr, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    ),
                    if (_city.isNotEmpty ||
                        _university.isNotEmpty ||
                        _department.isNotEmpty ||
                        _institutionType.isNotEmpty ||
                        _level.isNotEmpty)
                      TextButton.icon(
                        onPressed: () => _changeFilter(() {
                          _city = '';
                          _university = '';
                          _department = '';
                          _institutionType = '';
                          _level = '';
                        }),
                        icon: const Icon(Icons.close_rounded, size: 18),
                        label: Text('Filtreleri temizle'.tr),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                _pickerField(
                  label: 'İl',
                  value: _city,
                  allLabel: 'Tüm iller'.tr,
                  options: asMapList(_options?['cities'])
                      .map(
                        (item) => _PickOption(
                          '${item['name']}',
                          '${item['name']}',
                          hint: _exam == 'LGS' ? '${item['programCount']} ${'okul'.tr}' : '${item['universityCount']} ${'üniversite'.tr}',
                        ),
                      )
                      .toList(),
                  onChanged: (value) => _changeFilter(() {
                    _city = value;
                    _university = '';
                    _department = '';
                  }),
                ),
                const SizedBox(height: 10),
                _pickerField(
                  label: _exam == 'LGS' ? 'Okul' : 'Üniversite',
                  value: _university,
                  allLabel:
                      (_exam == 'LGS'
                              ? (_city.isEmpty ? 'Tüm okullar' : 'Bu ildeki tüm okullar')
                              : (_city.isEmpty ? 'Tüm üniversiteler' : 'Bu ildeki tüm üniversiteler'))
                          .tr,
                  options: asMapList(_options?['universities'])
                      .map(
                        (item) => _PickOption(
                          '${item['name']}',
                          '${item['name']}',
                          detail: '${item['city']} • ${item['institutionType']}',
                          hint: _exam == 'LGS' ? null : '${item['programCount']} ${'program'.tr}',
                        ),
                      )
                      .toList(),
                  onChanged: (value) => _changeFilter(() {
                    _university = value;
                    _department = '';
                  }),
                ),
                if (_exam == 'YKS') ...[
                  const SizedBox(height: 10),
                  _pickerField(
                    label: 'Bölüm',
                    value: _department,
                    allLabel: (_university.isEmpty ? 'Tüm bölümler' : 'Bu üniversitedeki tüm bölümler').tr,
                    options: asMapList(_options?['departments'])
                        .map(
                          (item) => _PickOption(
                            '${item['name']}',
                            '${item['name']}',
                            hint: _university.isEmpty
                                ? '${item['universityCount']} ${'üniversite'.tr}'
                                : '${item['programCount']} ${'program'.tr}',
                          ),
                        )
                        .toList(),
                    onChanged: (value) => _changeFilter(() => _department = value),
                  ),
                ],
                const SizedBox(height: 10),
                _dropdown(
                  _exam == 'LGS' ? 'Okul türü' : 'Üniversite türü',
                  _institutionType,
                  asList(meta['institutionTypes']).map((item) => '$item').toList(),
                  (value) => _changeFilter(() => _institutionType = value),
                ),
                if (_exam == 'YKS') ...[
                  const SizedBox(height: 8),
                  _dropdown(
                    'Düzey',
                    _level,
                    const ['Lisans', 'Önlisans'],
                    (value) => _changeFilter(() => _level = value),
                    labels: const {'Lisans': 'Lisans (4 yıllık)', 'Önlisans': 'Önlisans (2 yıllık)'},
                  ),
                ],
                const SizedBox(height: 8),
                TextField(
                  controller: _query,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _search(),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search_rounded),
                    labelText: 'Serbest arama'.tr,
                    hintText: (_exam == 'LGS' ? 'Örn: Fen Lisesi' : 'Örn: İngilizce, burslu, fakülte').tr,
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  (_exam == 'LGS'
                          ? 'Okul seçersen o okulun puanı sana göre konumu gösterilir.'
                          : 'Üniversite ya da bölüm seçersen puan aralığı uygulanmaz: o seçimdeki tüm programlar, sana göre konumlarıyla listelenir. İl, üniversitenin bulunduğu ildir.')
                      .tr,
                  style: hint,
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _busy || lgsMissing ? null : () => _search(),
                    icon: const Icon(Icons.travel_explore_rounded),
                    label: Text((_busy ? 'Aranıyor…' : 'Uygun Programları Bul').tr),
                  ),
                ),
              ],
            ),
          ),
          if (result != null) ...[
            const SizedBox(height: 12),
            Row(
              children: _bands.entries.where((entry) => entry.key != 'Far' || result['focused'] == true).map((entry) {
                final count = switch (entry.key) {
                  'Target' => result['targetCount'],
                  'Reach' => result['reachCount'],
                  'Safe' => result['safeCount'],
                  _ => result['farCount'],
                };
                final selected = _band == entry.key;
                final color = entry.value.$3;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => setState(() => _band = entry.key),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: selected
                              ? color.withValues(alpha: 0.14)
                              : Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
                          border: Border.all(color: selected ? color : Colors.transparent),
                        ),
                        child: Column(
                          children: [
                            Text(
                              '${count ?? 0}',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: color),
                            ),
                            Text(entry.value.$1.tr, style: const TextStyle(fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 6),
            Text(_bands[_band]!.$2.tr, style: hint, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            if (visible.isEmpty)
              AdminPanel(
                child: Column(
                  children: [
                    const Icon(Icons.track_changes_rounded, size: 36),
                    const SizedBox(height: 8),
                    Text('Bu bantta program yok'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
                    Text('Diğer bantlara bakın ya da filtreleri genişletin.'.tr, style: hint),
                  ],
                ),
              ),
            ...visible.map(
              (item) => _ProgramCard(
                item: item,
                canSave: widget.canSave,
                added: _choices.any((choice) => choice['code'] == item['code']),
                onAdd: () => _addChoice(item),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: const Color(0xFFD97706).withValues(alpha: 0.1),
                border: Border.all(color: const Color(0xFFD97706).withValues(alpha: 0.3)),
              ),
              child: Text('${result['disclaimer']}'.tr, style: const TextStyle(fontSize: 12)),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProgramCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final bool canSave;
  final bool added;
  final VoidCallback onAdd;
  const _ProgramCard({required this.item, required this.canSave, required this.added, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    final min = (item['minScore'] as num?)?.toDouble();
    final previous = (item['previousMinScore'] as num?)?.toDouble();
    final trend = min != null && previous != null ? min - previous : null;
    final gap = ((item['gap'] as num?) ?? 0).toDouble();
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item['programName']}', style: const TextStyle(fontWeight: FontWeight.w800)),
          Text('${item['institutionName']}${'${item['unit'] ?? ''}'.isEmpty ? '' : ' • ${item['unit']}'}', style: hint),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              if ('${item['city'] ?? ''}'.isNotEmpty) AdminAccentBadge(label: '${item['city']}', color: const Color(0xFF64748B)),
              if ('${item['institutionType'] ?? ''}'.isNotEmpty)
                AdminAccentBadge(label: '${item['institutionType']}', color: const Color(0xFF64748B)),
              if ('${item['level'] ?? ''}'.isNotEmpty) AdminAccentBadge(label: '${item['level']}'.tr, color: const Color(0xFF64748B)),
              if (item['quota'] != null)
                AdminAccentBadge(label: 'Kontenjan {n}'.tr.replaceFirst('{n}', '${item['quota']}'), color: const Color(0xFF64748B)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Taban ({n})'.tr.replaceFirst('{n}', '${item['year']}'), style: hint),
                    Text(_fmt(min), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                    if (trend != null)
                      Text(
                        '${trend > 0
                            ? '▲ +'
                            : trend < 0
                            ? '▼ '
                            : ''}${_fmt(trend)} ${'geçen yıla göre'.tr}',
                        style: TextStyle(
                          fontSize: 12,
                          color: trend > 0
                              ? const Color(0xFFDC2626)
                              : trend < 0
                              ? const Color(0xFF16A34A)
                              : Theme.of(context).hintColor,
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Farkın'.tr, style: hint),
                  Text(
                    '${gap >= 0 ? '+' : ''}${_fmt(gap)}',
                    style: TextStyle(fontWeight: FontWeight.w900, color: gap >= 0 ? const Color(0xFF16A34A) : const Color(0xFFD97706)),
                  ),
                ],
              ),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _openSource(item['sourceUrl']),
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: Text('kaynak'.tr),
              ),
              if (canSave)
                FilledButton.tonalIcon(
                  onPressed: added ? null : onAdd,
                  icon: Icon(added ? Icons.check_rounded : Icons.add_rounded),
                  label: Text((added ? 'Listede' : 'Listeme ekle').tr),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Aranabilir seçim sayfası (il, üniversite, bölüm). Boş değer "Tümü" demektir.
class _PickerSheet extends StatefulWidget {
  final String title;
  final String allLabel;
  final String value;
  final List<_PickOption> options;
  const _PickerSheet({required this.title, required this.allLabel, required this.value, required this.options});

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String _term = '';

  @override
  Widget build(BuildContext context) {
    final words = _fold(_term).split(RegExp(r'\s+')).where((word) => word.isNotEmpty).toList();
    final filtered = words.isEmpty
        ? widget.options
        : widget.options.where((option) {
            final haystack = _fold('${option.label} ${option.detail ?? ''}');
            return words.every(haystack.contains);
          }).toList();
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.8,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                autofocus: true,
                onChanged: (value) => setState(() => _term = value),
                decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: 'Ara...'.tr, isDense: true),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: filtered.length + (words.isEmpty ? 1 : 0),
                itemBuilder: (_, index) {
                  if (words.isEmpty && index == 0) {
                    return ListTile(
                      leading: Icon(widget.value.isEmpty ? Icons.check_rounded : null),
                      title: Text(widget.allLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
                      onTap: () => Navigator.pop(context, ''),
                    );
                  }
                  final option = filtered[index - (words.isEmpty ? 1 : 0)];
                  return ListTile(
                    leading: Icon(option.value == widget.value ? Icons.check_rounded : null),
                    title: Text(option.label),
                    subtitle: option.detail == null ? null : Text(option.detail!, style: hint),
                    trailing: option.hint == null ? null : Text(option.hint!, style: hint),
                    onTap: () => Navigator.pop(context, option.value),
                  );
                },
              ),
            ),
            if (filtered.isEmpty && words.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Sonuç bulunamadı'.tr, style: hint),
              ),
          ],
        ),
      ),
    );
  }
}
