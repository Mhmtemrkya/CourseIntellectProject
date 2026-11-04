import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/module_api_client.dart';
import '../services/subject_catalog.dart';
import '../services/optical_template_layout.dart';
import '../widgets/admin_ui.dart';

const _intro =
    'Optik okuyucunuzun oluşturduğu TXT/DAT dosyasında öğrenci bilgileri ve cevaplar belirli karakter aralıklarında bulunur. '
    'Bu şablon, sistemin her bilgiyi nereden okuyacağını belirler. Karakter sayımı 1’den başlar; boşluklar da karakter sayılır.';
const _nameNote =
    'Karakter sayısı, ismin harf sayısı değildir. Dosyada bu bilgiye ayrılmış alanın genişliğidir; kısa isimlerde kalan bölüm boşluk olabilir.';
const _help = [
  'Bu sayılar okulun belirlediği bir şey değildir; optik okuyucu cihazının (ve kullanılan optik formun) dosyayı hangi düzende yazdığına göre belirlenir.',
  'Değerleri cihazın kullanım kılavuzundaki “çıktı formatı / alan düzeni” bölümünden ya da cihazı kullanan yetkiliden öğrenebilirsiniz.',
  'Yeni şablonda hazır gelen sayılar yalnız örnektir ve sizin cihazınıza uygun olmayabilir. Aşağıdan örnek bir dosya seçip renkli önizlemeyle doğru yerlere denk geldiğini kontrol edin.',
  'Şablonu bir kez doğru kurduğunuzda, aynı cihaz ve aynı form düzeniyle yapılan sonraki sınavlarda tekrar kullanabilirsiniz.',
];

const _studentFields = [
  ('studentNo', 'Öğrenci no', 'Okul numarasıyla eşleştirilir'),
  ('name', 'Ad soyad', 'Numara yoksa adla eşleştirilir'),
  ('class', 'Sınıf', 'Aynı adlı öğrencileri ayırır (isteğe bağlı)'),
  ('booklet', 'Kitapçık', 'A/B gibi kitapçık türü'),
];

Map<String, dynamic> _emptyTemplate() => {
      'name': '',
      'encoding': 'windows-1254',
      'studentNoStart': 1,
      'studentNoLength': 10,
      'nameStart': 11,
      'nameLength': 25,
      'classStart': 36,
      'classLength': 4,
      'bookletStart': 40,
      'bookletLength': 1,
      'subjects': [
        {'name': 'Türkçe', 'start': 41, 'count': 40},
      ],
    };

/// Optik şablon (karakter düzeni) oluşturma/düzenleme: masaüstündeki şablon penceresiyle aynı
/// açıklamalar, canlı okuma özeti, çakışma uyarısı ve isteğe bağlı örnek dosya önizlemesi.
class OpticalTemplateEditorPage extends StatefulWidget {
  const OpticalTemplateEditorPage({super.key, this.template, this.save, this.pickSample, this.suggest});

  final Map<String, dynamic>? template;

  /// Testlerde sahte kaydetme; null ise ModuleApiClient.
  final Future<void> Function(String? id, Map<String, dynamic> body)? save;

  /// Testlerde sahte dosya seçimi: (dosya adı, baytlar).
  final Future<(String, List<int>)?> Function()? pickSample;

  /// Testlerde sahte öneri isteği; null ise sunucudaki /templates/suggest.
  final Future<Map<String, dynamic>> Function(String fileName, List<int> bytes)? suggest;

  @override
  State<OpticalTemplateEditorPage> createState() => _OpticalTemplateEditorPageState();
}

class _OpticalTemplateEditorPageState extends State<OpticalTemplateEditorPage> {
  late Map<String, dynamic> _form;
  late List<Map<String, dynamic>> _subjects;
  final _name = TextEditingController();
  final Map<String, TextEditingController> _numbers = {};
  (String, List<int>)? _sample;
  bool _busy = false;
  Map<String, dynamic>? _suggestion;
  bool _suggesting = false;
  String? _suggestError;
  bool _applied = false;
  String _numberChoice = '';
  // Her analizin numarası: yeni dosya seçilince artar; geç gelen eski yanıt yok sayılır.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    final source = widget.template ?? _emptyTemplate();
    _form = {
      for (final key in _emptyTemplate().keys.where((key) => key != 'subjects' && key != 'name')) key: source[key] ?? _emptyTemplate()[key],
    };
    _name.text = '${source['name'] ?? ''}';
    _subjects = [
      for (final item in (source['subjects'] as List? ?? const []).whereType<Map>())
        {'name': '${item['name'] ?? ''}', 'start': (item['start'] as num?)?.toInt() ?? 1, 'count': (item['count'] as num?)?.toInt() ?? 1},
    ];
  }

  @override
  void dispose() {
    _name.dispose();
    for (final controller in _numbers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> get _body => {..._form, 'name': _name.text.trim(), 'subjects': _subjects};

  TextEditingController _number(String key, int value) => _numbers.putIfAbsent(key, () => TextEditingController(text: '$value'));

  int _parse(String text) => int.tryParse(text.trim()) ?? 0;

  void _addSubject() => setState(() {
        final last = _subjects.isEmpty ? null : _subjects.last;
        final start = last == null ? 1 : (last['start'] as int) + (last['count'] as int);
        _subjects.add({'name': nextFreeSubject(_subjects.map((item) => '${item['name']}')), 'start': start, 'count': 20});
      });

  void _removeSubject(int index) => setState(() {
        _subjects.removeAt(index);
        // Satır numarasına bağlı denetleyiciler yeniden kurulur (kaymış değer gösterilmesin).
        for (final key in _numbers.keys.where((key) => key.startsWith('subject-')).toList()) {
          _numbers.remove(key)?.dispose();
        }
      });

  /// Dosya seçer; 5 MB'tan büyükse uyarır ve null döner (büyük dosyada arayüz donmasın).
  Future<(String, List<int>)?> _pickFile() async {
    final custom = widget.pickSample;
    (String, List<int>)? picked;
    if (custom != null) {
      picked = await custom();
    } else {
      final result = await FilePicker.platform.pickFiles(withData: true);
      final file = result?.files.firstOrNull;
      if (file == null) return null;
      final bytes = file.bytes ?? (file.path != null ? await File(file.path!).readAsBytes() : null);
      if (bytes == null) return null;
      picked = (file.name, bytes);
    }
    if (picked != null && picked.$2.length > 5 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Dosya 5 MB’tan büyük; önizleme için ilk birkaç satır yeterli, küçük bir örnek seçin.'.tr)),
        );
      }
      return null;
    }
    return picked;
  }

  Future<void> _pick() async {
    final picked = await _pickFile();
    if (picked == null || !mounted) return;
    setState(() {
      _sample = picked;
      // Dosya değişti: bekleyen analizin yanıtı artık bu dosyaya ait değil.
      if (_suggesting) {
        _generation++;
        _suggesting = false;
      }
    });
  }

  Future<void> _suggestFromFile() async {
    final picked = await _pickFile();
    if (picked == null || !mounted) return;
    final generation = ++_generation;
    setState(() {
      _sample = picked;
      _suggestion = null;
      _suggestError = null;
      _applied = false;
      _suggesting = true;
    });
    try {
      final custom = widget.suggest;
      final result = custom != null
          ? await custom(picked.$1, picked.$2)
          : asMap(await ModuleApiClient.instance.postFile('/api/optical-exams/templates/suggest',
              field: 'file', fileName: picked.$1, bytes: picked.$2, fields: const {'encoding': 'auto'}));
      if (!mounted || generation != _generation) return;
      final studentNo = _suggestedField(result, 'studentNo');
      final pick = asMapList(result['numberCandidates'])
          .where((item) => item['constant'] != true && item['start'] == studentNo?['start'])
          .firstOrNull;
      setState(() {
        _suggestion = result;
        _suggesting = false;
        _numberChoice = '${pick?['id'] ?? ''}';
      });
      // Yeni şablonda öneri forma hemen yerleşir; düzenlenen şablon ancak "Öneriyi uygula" ile değişir.
      if (widget.template == null && result['supported'] == true && result['manualRecommended'] != true) _apply();
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _suggesting = false;
        _suggestError = '${'Dosya analiz edilemedi'.tr}: $error. ${'Değerleri elle girebilirsiniz.'.tr}';
      });
    }
  }

  static Map<String, dynamic>? _suggestedField(Map<String, dynamic> suggestion, String key) =>
      asMapList(suggestion['fields']).where((item) => item['key'] == key).firstOrNull;

  void _setNumber(String key, int value) {
    final controller = _numbers[key];
    if (controller != null && controller.text != '$value') controller.text = '$value';
  }

  /// Öneriyi forma yerleştirir; bulunamayan alanın karakter sayısı 0 olur, bloklar ders adı olmadan gelir.
  void _apply() {
    final suggestion = _suggestion;
    if (suggestion == null) return;
    setState(() {
      for (final key in ['studentNo', 'name', 'class', 'booklet']) {
        final field = _suggestedField(suggestion, key);
        final length = (field?['length'] as num?)?.toInt() ?? 0;
        final start = length > 0 ? (field?['start'] as num?)?.toInt() ?? 1 : 1;
        _form['${key}Start'] = start;
        _form['${key}Length'] = length;
        _setNumber('$key-start', start);
        _setNumber('$key-length', length);
      }
      final candidate = asMapList(suggestion['numberCandidates']).where((item) => item['id'] == _numberChoice).firstOrNull;
      if (candidate != null) _useNumber(candidate);
      if (_form['encoding'] != 'auto') _form['encoding'] = '${suggestion['encoding']}';
      final blocks = asMapList(suggestion['answerBlocks']);
      if (blocks.isNotEmpty) {
        for (final key in _numbers.keys.where((key) => key.startsWith('subject-')).toList()) {
          _numbers.remove(key)?.dispose();
        }
        _subjects = [
          for (final block in blocks) {'name': '', 'start': (block['start'] as num).toInt(), 'count': (block['count'] as num).toInt()},
        ];
      }
      _applied = true;
    });
  }

  void _useNumber(Map<String, dynamic> candidate) {
    final start = (candidate['start'] as num).toInt();
    final length = (candidate['length'] as num).toInt();
    _form['studentNoStart'] = start;
    _form['studentNoLength'] = length;
    _setNumber('studentNo-start', start);
    _setNumber('studentNo-length', length);
  }

  void _chooseNumber(Map<String, dynamic> candidate) => setState(() {
        _numberChoice = '${candidate['id']}';
        if (_applied) _useNumber(candidate);
      });

  Future<void> _split(int index) async {
    final count = (_subjects[index]['count'] as num).toInt();
    final controller = TextEditingController();
    final first = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Bloğu derslere böl'.tr),
        content: TextField(
          key: const ValueKey('optical-split-count'),
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'İlk kaç soru bu derste?'.tr,
            helperText: 'Kalan sorular yeni bir satıra geçer; dersini listeden seçin.'.tr,
            helperMaxLines: 2,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, int.tryParse(controller.text.trim())), child: Text('Böl'.tr)),
        ],
      ),
    );
    if (first == null || first < 1 || first >= count || !mounted) return;
    setState(() {
      final subject = _subjects[index];
      _subjects
        ..[index] = {...subject, 'count': first}
        ..insert(index + 1, {'name': '', 'start': (subject['start'] as num).toInt() + first, 'count': count - first});
      for (final key in _numbers.keys.where((key) => key.startsWith('subject-')).toList()) {
        _numbers.remove(key)?.dispose();
      }
    });
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    final id = widget.template?['id'] as String?;
    try {
      final custom = widget.save;
      if (custom != null) {
        await custom(id, _body);
      } else if (id != null) {
        await ModuleApiClient.instance.put('/api/optical-exams/templates/$id', _body);
      } else {
        await ModuleApiClient.instance.post('/api/optical-exams/templates', _body);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Şablon kaydedildi'.tr)));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${'Şablon kaydedilemedi'.tr}: $error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hint = TextStyle(color: theme.hintColor, fontSize: 12, height: 1.35);
    final fields = opticalLayoutFields(_body);
    final problems = opticalLayoutProblems(fields);
    OpticalLayoutField fieldOf(String id) => fields.firstWhere((field) => field.id == id);
    final subjectProblems = [
      for (var i = 0; i < _subjects.length; i++)
        if ('${_subjects[i]['name']}'.isEmpty) 'Cevap bloğu {n} için listeden ders seçin.'.tr.replaceFirst('{n}', '${i + 1}'),
    ];
    final allProblems = [...problems, ...subjectProblems];
    final canSave = !_busy && _name.text.trim().isNotEmpty && subjectProblems.isEmpty && problems.isEmpty;

    return AdminScaffold(
      appBar: AppBar(title: Text(widget.template == null ? 'Yeni optik şablon'.tr : 'Şablonu düzenle'.tr)),
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                Text(_intro.tr, style: theme.textTheme.bodyMedium?.copyWith(height: 1.4)),
                const SizedBox(height: 8),
                AdminPanel(
                  padding: EdgeInsets.zero,
                  child: ExpansionTile(
                    key: const ValueKey('optical-template-help'),
                    leading: const Icon(Icons.help_outline_rounded),
                    title: Text('Bu değerleri nasıl bulabilirim?'.tr, style: const TextStyle(fontWeight: FontWeight.w600)),
                    childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    children: [
                      for (final line in _help)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [Text('•  ', style: hint), Expanded(child: Text(line.tr, style: hint))],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _suggestionSection(theme, hint),
                const SizedBox(height: 12),
                TextField(
                  controller: _name,
                  decoration: InputDecoration(labelText: 'Şablon adı'.tr, hintText: 'Örn: Okul optik formu (LGS)'.tr),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  key: ValueKey('optical-encoding-${_form['encoding']}'),
                  initialValue: '${_form['encoding']}',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: 'Dosya kodlaması'.tr, isDense: true),
                  items: [
                    DropdownMenuItem(value: 'windows-1254', child: Text('Türkçe Windows (1254)'.tr)),
                    const DropdownMenuItem(value: 'utf-8', child: Text('UTF-8')),
                    DropdownMenuItem(value: 'auto', child: Text('Otomatik algıla'.tr)),
                  ],
                  onChanged: (value) => setState(() => _form['encoding'] = value ?? _form['encoding']),
                ),
                const SizedBox(height: 16),
                Text('Öğrenci alanları'.tr, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                for (final (key, label, description) in _studentFields)
                  _card(
                    key: ValueKey('optical-field-$key'),
                    title: Text(label.tr, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: description.tr,
                    inputs: _positionInputs(key, '${key}Start', '${key}Length', 'Karakter sayısı'),
                    field: fieldOf(key),
                    note: key == 'name' ? _nameNote : null,
                    hint: hint,
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: Text('Ders cevapları (sırayla)'.tr, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                    TextButton.icon(
                      onPressed: nextFreeSubject(_subjects.map((item) => '${item['name']}')).isEmpty ? null : _addSubject,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: Text('Ders ekle'.tr),
                    ),
                  ],
                ),
                for (var i = 0; i < _subjects.length; i++)
                  _card(
                    key: ValueKey('optical-subject-row-$i'),
                    title: Row(
                      children: [
                        Expanded(child: _subjectSelect(i)),
                        IconButton(
                          tooltip: 'Dersi kaldır'.tr,
                          onPressed: _subjects.length == 1 ? null : () => _removeSubject(i),
                          icon: Icon(Icons.delete_outline_rounded, color: theme.colorScheme.error),
                        ),
                      ],
                    ),
                    inputs: _positionInputs('subject-$i', 'start', 'count', 'Soru sayısı', subject: i),
                    field: fieldOf('subject-$i'),
                    hint: hint,
                    extra: (_subjects[i]['count'] as num) > 1
                        ? Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton.icon(
                              key: ValueKey('optical-split-$i'),
                              onPressed: () => _split(i),
                              icon: const Icon(Icons.content_cut_rounded, size: 16),
                              label: Text('Bloğu derslere böl'.tr),
                            ),
                          )
                        : null,
                  ),
                if (allProblems.isNotEmpty)
                  Container(
                    key: const ValueKey('optical-template-problems'),
                    margin: const EdgeInsets.only(top: 4, bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: theme.colorScheme.errorContainer, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Kaydetmeden önce düzeltin:'.tr, style: TextStyle(fontWeight: FontWeight.w700, color: theme.colorScheme.onErrorContainer)),
                        for (final problem in allProblems)
                          Text('• $problem', style: TextStyle(fontSize: 12, color: theme.colorScheme.onErrorContainer)),
                      ],
                    ),
                  ),
                const SizedBox(height: 8),
                _samplePreview(fields, theme, hint),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(key: const ValueKey('optical-template-save'), onPressed: canSave ? _save : null, child: Text('Kaydet'.tr)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card({
    required Key key,
    required Widget title,
    String? subtitle,
    required Widget inputs,
    required OpticalLayoutField field,
    String? note,
    required TextStyle hint,
    Widget? extra,
  }) {
    final off = field.length <= 0;
    return AdminPanel(
      key: key,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          title,
          if (subtitle != null) Text(subtitle, style: hint),
          const SizedBox(height: 8),
          inputs,
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 4, right: 6),
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: off ? Colors.transparent : field.color, borderRadius: BorderRadius.circular(2)),
              ),
              Expanded(
                child: Text(
                  opticalReadingSummary(field),
                  key: ValueKey('reading-${field.id}'),
                  style: hint.copyWith(fontStyle: off ? FontStyle.italic : FontStyle.normal),
                ),
              ),
            ],
          ),
          if (note != null) ...[const SizedBox(height: 4), Text(note.tr, style: hint)],
          ?extra,
        ],
      ),
    );
  }

  Widget _positionInputs(String id, String startKey, String lengthKey, String lengthLabel, {int? subject}) {
    int read(String key) => subject == null ? (_form[key] as num).toInt() : (_subjects[subject][key] as num).toInt();
    void write(String key, int value) => setState(() {
          if (subject == null) {
            _form[key] = value;
          } else {
            _subjects[subject][key] = value;
          }
        });
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: TextField(
            key: ValueKey('$id-start'),
            controller: _number('$id-start', read(startKey)),
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              isDense: true,
              labelText: 'Başlangıç konumu'.tr,
              helperText: 'Bilgi satırın kaçıncı karakterinde başlıyor?'.tr,
              helperMaxLines: 3,
            ),
            onChanged: (value) => write(startKey, _parse(value)),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
            key: ValueKey('$id-length'),
            controller: _number('$id-length', read(lengthKey)),
            keyboardType: TextInputType.number,
            decoration: InputDecoration(isDense: true, labelText: lengthLabel.tr),
            onChanged: (value) => write(lengthKey, _parse(value)),
          ),
        ),
      ],
    );
  }

  Widget _subjectSelect(int index) {
    final value = '${_subjects[index]['name']}';
    final taken = {for (var i = 0; i < _subjects.length; i++) if (i != index) '${_subjects[i]['name']}'};
    final legacy = value.isNotEmpty && !allSubjects.contains(value);
    final items = <DropdownMenuItem<String>>[
      if (legacy) DropdownMenuItem(value: value, child: Text('{n} (mevcut kayıt)'.tr.replaceFirst('{n}', value))),
      for (final (group, subjects) in subjectGroups) ...[
        DropdownMenuItem<String>(enabled: false, value: '__$group', child: Text(group.tr, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
        for (final subject in subjects.where((subject) => subject == value || !taken.contains(subject)))
          DropdownMenuItem(value: subject, child: Padding(padding: const EdgeInsets.only(left: 8), child: Text(subject.tr))),
      ],
    ];
    return DropdownButtonFormField<String>(
      key: ValueKey('optical-subject-select-$index-$value-${_subjects[index]['start']}'),
      initialValue: value.isEmpty ? null : value,
      isExpanded: true,
      decoration: InputDecoration(labelText: 'Ders'.tr, isDense: true),
      hint: Text('Cevap bloğu {n} — ders seçin'.tr.replaceFirst('{n}', '${index + 1}')),
      items: items,
      onChanged: (name) {
        if (name != null && !name.startsWith('__')) setState(() => _subjects[index]['name'] = name);
      },
    );
  }

  static const _confidenceLabel = {'high': 'Yüksek güven', 'medium': 'Orta güven', 'low': 'Düşük güven', 'none': 'Algılanamadı'};
  static const _confidenceColor = {'high': Color(0xFF059669), 'medium': Color(0xFFB45309), 'low': Color(0xFFE11D48), 'none': Color(0xFF64748B)};
  static const _aiStatus = {
    'used': 'Yerel yapay zekâ adayları yorumlamaya yardım etti; konumlar kurallı kontrollerle hesaplandı.',
    'not-needed': 'Dosya düzeni kurallı kontrollerle netleşti; yapay zekâya gerek olmadı.',
    'disabled': 'Yerel yapay zekâ kapalı; öneri kurallı kontrollerle üretildi.',
    'unavailable': 'Yerel yapay zekâya ulaşılamadı; öneri kurallı kontrollerle üretildi.',
    'timeout': 'Yerel yapay zekâ zamanında yanıt vermedi; öneri kurallı kontrollerle üretildi.',
    'invalid': 'Yerel yapay zekânın yanıtı geçersizdi ve kullanılmadı; öneri kurallı kontrollerle üretildi.',
  };

  static String _span(Object? start, Object? length) {
    final s = (start as num?)?.toInt() ?? 0;
    final l = (length as num?)?.toInt() ?? 0;
    if (l <= 0) return '—';
    return l == 1 ? '$s. karakter' : '$s–${s + l - 1}. karakterler';
  }

  Widget _confidenceChip(String confidence) {
    final color = _confidenceColor[confidence] ?? _confidenceColor['none']!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(99)),
      child: Text((_confidenceLabel[confidence] ?? 'Algılanamadı').tr, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }

  Widget _suggestionRow(String title, String span, String confidence, String reason, TextStyle hint, {Key? key}) => Container(
        key: key,
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(border: Border.all(color: Theme.of(context).dividerColor), borderRadius: BorderRadius.circular(8)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w600)), Text(span, style: hint), _confidenceChip(confidence)],
            ),
            const SizedBox(height: 2),
            Text(reason, style: hint),
          ],
        ),
      );

  /// "Dosyadan otomatik şablon öner": dosya seçimi, yükleniyor durumu, hata ve öneri paneli.
  Widget _suggestionSection(ThemeData theme, TextStyle hint) {
    final suggestion = _suggestion;
    final warn = TextStyle(fontSize: 12, color: const Color(0xFFB45309), height: 1.35);
    return AdminPanel(
      key: const ValueKey('optical-suggestion'),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Dosyadan otomatik şablon öner'.tr, style: const TextStyle(fontWeight: FontWeight.w700)),
          Text('Optik okuyucunun TXT/DAT çıktısını seçin; sistem alanların konumlarını önerir. Dosya kaydedilmez, öğrenci ya da sınav sonucu oluşturulmaz.'.tr, style: hint),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              key: const ValueKey('optical-suggest-pick'),
              onPressed: _suggesting ? null : _suggestFromFile,
              icon: _suggesting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.auto_fix_high_rounded, size: 18),
              label: Text((_suggesting ? 'Dosya inceleniyor…' : 'TXT/DAT dosyası seç').tr),
            ),
          ),
          if (_suggestError != null) ...[
            const SizedBox(height: 6),
            Text(_suggestError!, key: const ValueKey('optical-suggest-error'), style: TextStyle(fontSize: 12, color: theme.colorScheme.error)),
          ],
          if (suggestion != null) ...[
            const SizedBox(height: 10),
            Text((suggestion['supported'] == true ? 'Dosyadan önerilen şablon' : 'Bu dosyadan öneri üretilemedi').tr,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Text('${suggestion['message'] ?? ''}', style: hint),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(8)),
              child: Text('Bu özellik dosya düzenini önerir. Cevap anahtarı ve soru konuları ayrıca girilir.'.tr, style: const TextStyle(fontSize: 12)),
            ),
            const SizedBox(height: 8),
            if (suggestion['supported'] == true) ...[
              Text(
                '${suggestion['totalLines']} ${'satır'.tr} · ${suggestion['sampledLines']} ${'satır incelendi'.tr} · '
                '${'kodlama'.tr}: ${suggestion['encoding'] == 'utf-8' ? 'UTF-8' : 'Türkçe Windows (1254)'.tr}',
                style: hint,
              ),
              const SizedBox(height: 6),
              for (final field in asMapList(suggestion['fields']))
                _suggestionRow('${field['label']}'.tr, _span(field['start'], field['length']), '${field['confidence']}', '${field['reason']}', hint,
                    key: ValueKey('suggested-${field['key']}')),
              for (final block in asMapList(suggestion['answerBlocks']))
                _suggestionRow('${block['label']} · ${block['count']} ${'soru'.tr}', _span(block['start'], block['count']), '${block['confidence']}',
                    '${block['reason']}', hint, key: const ValueKey('suggested-answers')),
              if (asMapList(suggestion['numberCandidates']).where((item) => item['constant'] != true).length > 1) ...[
                Text('Öğrenci numarası hangisi?'.tr, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                RadioGroup<String>(
                  groupValue: _numberChoice,
                  onChanged: (id) {
                    final candidate = asMapList(suggestion['numberCandidates']).where((item) => item['id'] == id).firstOrNull;
                    if (candidate != null) _chooseNumber(candidate);
                  },
                  child: Column(
                    children: [
                      for (final candidate in asMapList(suggestion['numberCandidates']))
                        RadioListTile<String>(
                          key: ValueKey('number-candidate-${candidate['id']}'),
                          value: '${candidate['id']}',
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text(_span(candidate['start'], candidate['length']), style: const TextStyle(fontSize: 13)),
                          subtitle: Text('${candidate['note']}', style: hint),
                        ),
                    ],
                  ),
                ),
              ],
              if ((suggestion['booklets'] as List? ?? const []).isNotEmpty)
                Text('${'Kitapçık türleri'.tr}: ${(suggestion['booklets'] as List).join(', ')}', style: const TextStyle(fontSize: 12)),
            ],
            for (final text in (suggestion['confirmations'] as List? ?? const []))
              Padding(padding: const EdgeInsets.only(top: 4), child: Text('⚠ $text', style: warn.copyWith(fontWeight: FontWeight.w600))),
            for (final text in (suggestion['warnings'] as List? ?? const []))
              Padding(padding: const EdgeInsets.only(top: 4), child: Text('• $text', style: hint)),
            if (asMapList(suggestion['flaggedLines']).isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Kontrol edilmesi gereken satırlar'.tr, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              for (final line in asMapList(suggestion['flaggedLines']))
                Text('${'{n}. satır'.tr.replaceFirst('{n}', '${line['line']}')}: ${line['reason']}', style: warn),
            ],
            if (suggestion['supported'] == true) ...[
              const SizedBox(height: 6),
              Text(
                [(_aiStatus['${suggestion['aiStatus']}'] ?? '').tr, ...(suggestion['aiNotes'] as List? ?? const []).map((item) => '$item')].join(' '),
                style: hint.copyWith(fontSize: 11),
              ),
            ],
            if (suggestion['supported'] == true && suggestion['manualRecommended'] != true) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.tonal(
                  key: const ValueKey('optical-suggest-apply'),
                  onPressed: _applied ? null : _apply,
                  child: Text((_applied ? 'Öneri forma uygulandı' : 'Öneriyi uygula').tr),
                ),
              ),
              if (_applied)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('Değerleri aşağıda kontrol edip düzeltebilirsiniz; Kaydet’e basana kadar hiçbir şey kaydedilmez.'.tr, style: hint),
                ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _samplePreview(List<OpticalLayoutField> fields, ThemeData theme, TextStyle hint) {
    final sample = _sample;
    final used = fields.where((field) => field.used).toList();
    final decoded = sample == null ? null : decodeOpticalSample(sample.$2, '${_form['encoding']}');
    final lines = decoded == null ? const <OpticalSampleLine>[] : opticalSampleLines(decoded.text);
    var width = 10;
    for (final line in lines) {
      if (line.text.length > width) width = line.text.length;
    }
    for (final field in used) {
      if (field.end > width) width = field.end;
    }
    final ruler = opticalRuler(width);
    const mono = TextStyle(fontFamily: 'monospace', fontFamilyFallback: ['Menlo', 'Courier New', 'Courier'], fontSize: 12, height: 1.5);

    return AdminPanel(
      key: const ValueKey('optical-sample-preview'),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Örnek dosyayla dene (isteğe bağlı)'.tr, style: const TextStyle(fontWeight: FontWeight.w700)),
          Text('Yalnız önizlemedir: dosya kaydedilmez, öğrenci ya da sınav sonucu oluşturulmaz.'.tr, style: hint),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              OutlinedButton.icon(
                key: const ValueKey('optical-sample-pick'),
                onPressed: _pick,
                icon: const Icon(Icons.description_outlined, size: 18),
                label: Text((sample == null ? 'TXT/DAT dosyası seç' : 'Başka dosya seç').tr),
              ),
              if (sample != null) TextButton(onPressed: () => setState(() => _sample = null), child: Text('Önizlemeyi kapat'.tr)),
            ],
          ),
          if (sample != null && decoded != null) ...[
            const SizedBox(height: 8),
            if (lines.isEmpty)
              Text('Dosyada dolu satır bulunamadı.'.tr, style: hint)
            else ...[
              Text(
                '${sample.$1} · ${'ilk {n} dolu satır'.tr.replaceFirst('{n}', '${lines.length}')} · '
                '${'kodlama'.tr}: ${decoded.encoding == 'utf-8' ? 'UTF-8' : 'Türkçe Windows (1254)'.tr}',
                style: hint,
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  for (final field in used)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 12, height: 12, decoration: BoxDecoration(color: field.color.withValues(alpha: 0.35), border: Border(bottom: BorderSide(color: field.color, width: 2)))),
                        const SizedBox(width: 4),
                        Text(field.label.tr, style: const TextStyle(fontSize: 12)),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(border: Border.all(color: theme.dividerColor), borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.all(8),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(ruler.tens, style: mono.copyWith(color: theme.hintColor), softWrap: false),
                      Text(ruler.units, style: mono.copyWith(color: theme.hintColor), softWrap: false),
                      for (final line in lines)
                        Text.rich(
                          key: ValueKey('optical-sample-line-${line.line}'),
                          TextSpan(
                            children: [
                              for (final (text, field) in segmentOpticalLine(line.text, used))
                                TextSpan(text: text, style: field == null ? null : TextStyle(backgroundColor: field.color.withValues(alpha: 0.30))),
                            ],
                          ),
                          style: mono.copyWith(color: theme.colorScheme.onSurface),
                          softWrap: false,
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              for (final line in lines) _lineReading(line, used, theme, hint),
              Text(
                'Cevaplarda “·” işaretlenmemiş (boş bırakılmış) soruyu gösterir; bu normaldir. Satırın alana yetmemesi ise konumların yanlış olabileceğini gösterir.'.tr,
                style: hint.copyWith(fontSize: 11),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _lineReading(OpticalSampleLine line, List<OpticalLayoutField> used, ThemeData theme, TextStyle hint) {
    final readings = readOpticalSampleLine(line, used);
    return Container(
      key: ValueKey('optical-sample-reading-${line.line}'),
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(border: Border.all(color: theme.dividerColor), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('{n}. satırdan okunan'.tr.replaceFirst('{n}', '${line.line}'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          for (final reading in readings)
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: '${reading.field.label.tr}: ', style: hint),
                  TextSpan(
                    text: reading.field.kind == OpticalFieldKind.subject
                        ? (reading.value.isEmpty ? '—' : reading.value.replaceAll(' ', '·'))
                        : (reading.value.isEmpty ? '(boş)'.tr : reading.value),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  if (reading.blankQuestions.isNotEmpty)
                    TextSpan(text: ' ${'({n} soru boş bırakılmış)'.tr.replaceFirst('{n}', '${reading.blankQuestions.length}')}', style: hint),
                ],
              ),
            ),
          for (final reading in readings.where((item) => item.missing != null))
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFB45309)),
                  const SizedBox(width: 4),
                  Expanded(child: Text(reading.missing!, style: const TextStyle(fontSize: 12, color: Color(0xFFB45309)))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
