import 'dart:math';

import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/module_api_client.dart';
import '../widgets/topic_recommendations_card.dart';
import '../services/assistant_focus.dart';

const _brand = Color(0xFF4F46E5);
/// Öğrenci kendi analizine bakarken öneriler "sen" diliyle (masaüstü selfAdvice ile aynı metinler).
const _selfAdvice = {
  'misconception': 'Burada bir kavram yanılgısı olabilir; temel kuralları tekrar et, sonra çözümlü örneklerle yanlışlarının nedenine bak.',
  'skipping': 'Soruları boş bırakma eğilimindesin; kolaydan zora giden kısa testlerle soruya başlama alışkanlığı kazanabilirsin.',
  'declining': 'Son çalışmalarında biraz düşüş var; kısa bir konu tekrarı yapıp son yanlışlarını yeniden çözmeni öneririm.',
};
const _days = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

class _ChatMessage {
  final bool mine;
  final String text;
  final Map<String, dynamic>? response;
  final String? id;
  int? feedback;
  _ChatMessage(this.mine, this.text, [this.response, this.id, this.feedback]);
}

const _toneColors = {'warn': Color(0xFFF59E0B), 'good': Color(0xFF16A34A), 'info': _brand};

String _str(Object? value) => value == null ? '' : '$value';
num _num(Object? value) => value is num ? value : num.tryParse('$value') ?? 0;
String _money(Object? value) => '${_num(value).toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.')} ₺';
String _clientId() {
  final random = Random.secure();
  String hex(int length) => List.generate(length, (_) => random.nextInt(16).toRadixString(16)).join();
  return '${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}';
}

/// SchoolAsist Asistan (mobil). Masaüstü paneliyle aynı uçları kullanır; cevap metni ve
/// rol kapsamı sunucudan gelir. [portal] kullanıcının bulunduğu paneldir (student, parent,
/// teacher, admin, administrative, accounting): her rol yalnız kendi portalının sorularını sorabilir.
class AssistantPage extends StatefulWidget {
  final String portal;
  const AssistantPage({super.key, required this.portal});

  @override
  State<AssistantPage> createState() => _AssistantPageState();
}

class _AssistantPageState extends State<AssistantPage> {
  final _messages = <_ChatMessage>[];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<String> _suggestions = [];
  String? _conversationId;
  String _firstName = '';
  Map<String, dynamic>? _briefing;
  bool _busy = false;

  bool get _english => AppLocale.isEnglish;
  bool get _student => widget.portal == 'student';
  Map<String, dynamic> get _context => {
        'currentRoute': '/mobile/${widget.portal}',
        // Son bakılan öğrenci; öğrenci portalında başkası hedeflenemez.
        'selectedStudentId': _student ? null : AssistantFocus.current.value?.id,
        'selectedStudentName': _student ? null : AssistantFocus.current.value?.name,
        'portal': widget.portal,
        'language': AppLocale.language.value,
      };

  @override
  void initState() {
    super.initState();
    AssistantFocus.current.addListener(_refresh);
    _loadIntro();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    AssistantFocus.current.removeListener(_refresh);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadIntro() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final query = {'portal': widget.portal, 'language': AppLocale.language.value};
      final items = asMapList(await ModuleApiClient.instance.get('/api/assistant/suggestions', query));
      Map<String, dynamic>? briefing;
      try {
        briefing = asMap(await ModuleApiClient.instance.get('/api/assistant/briefing', query));
      } catch (_) {
        briefing = null;
      }
      if (!mounted) return;
      setState(() {
        _firstName = (session?.fullName ?? '').split(' ').first;
        _suggestions = items.map((item) => _str(item['label'])).where((label) => label.isNotEmpty).toList();
        _briefing = briefing;
      });
    } catch (_) {
      // Öneriler gelmezse giriş metni yine görünür.
    }
  }

  void _scrollDown() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
        }
      });

  Future<void> _run(String shown, Future<dynamic> Function() request) async {
    if (_busy) return;
    setState(() {
      _messages.add(_ChatMessage(true, shown));
      _busy = true;
    });
    _scrollDown();
    try {
      final response = asMap(await request());
      _conversationId = _str(response['conversationId']);
      _messages.add(_ChatMessage(false, _str(response['text']), response, _str(response['messageId'])));
    } on ModuleApiException catch (error) {
      _messages.add(_ChatMessage(false, error.message));
    } catch (_) {
      _messages.add(_ChatMessage(false, _english ? 'Something went wrong. Please try again.' : 'Bir sorun oluştu. Lütfen tekrar deneyin.'));
    }
    if (mounted) setState(() => _busy = false);
    _scrollDown();
  }

  void _send(String text) {
    final message = text.trim();
    if (message.isEmpty) return;
    _input.clear();
    _run(message, () => ModuleApiClient.instance.post('/api/assistant/messages', {
          'conversationId': _conversationId,
          'message': message,
          'clientMessageId': _clientId(),
          'context': _context,
        }));
  }

  void _command(String label, String command, String? studentId) {
    final conversationId = _conversationId;
    if (conversationId == null) return;
    _run(label, () => ModuleApiClient.instance.post('/api/assistant/actions', {
          'conversationId': conversationId,
          'command': command,
          'studentId': studentId,
          'context': _context,
        }));
  }

  void _reset() => setState(() {
        _messages.clear();
        _conversationId = null;
      });

  void _rate(_ChatMessage message, bool helpful) {
    final id = message.id;
    if (id == null || id.isEmpty) return;
    setState(() => message.feedback = helpful ? 1 : -1);
    ModuleApiClient.instance.post('/api/assistant/messages/$id/feedback', {'helpful': helpful}).catchError((_) => null);
  }

  /// Bu portalda açılmış önceki sohbetler; seçilen sohbet kartlarıyla birlikte geri yüklenir.
  Future<void> _openHistory() async {
    List<Map<String, dynamic>> items;
    try {
      items = asMapList(await ModuleApiClient.instance.get('/api/assistant/conversations', {'portal': widget.portal}));
    } catch (_) {
      items = const [];
    }
    if (!mounted) return;
    final chosen = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: items.isEmpty
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_english ? 'No saved chats in this portal yet.' : 'Bu portalda henüz kayıtlı sohbet yok.'),
              )
            : ListView(
                shrinkWrap: true,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(_english ? 'Previous chats' : 'Önceki sohbetler', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  ),
                  ...items.map((item) => ListTile(
                        leading: const Icon(Icons.chat_bubble_outline_rounded),
                        title: Text(_str(item['title']), maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text(_str(item['lastMessageAtUtc']).replaceFirst('T', ' ').split('.').first),
                        onTap: () => Navigator.pop(sheetContext, _str(item['id'])),
                      )),
                ],
              ),
      ),
    );
    if (chosen == null || chosen.isEmpty) return;
    try {
      final rows = asMapList(await ModuleApiClient.instance.get('/api/assistant/conversations/$chosen/messages'));
      if (!mounted) return;
      setState(() {
        _conversationId = chosen;
        _messages
          ..clear()
          ..addAll(rows.map((row) => row['sender'] == 'user'
              ? _ChatMessage(true, _str(row['text']))
              : _ChatMessage(false, _str(row['text']), {
                  'conversationId': chosen,
                  'messageId': row['id'],
                  'type': row['type'],
                  'text': row['text'],
                  'data': row['data'],
                  'actions': row['actions'] ?? const [],
                  'suggestions': row['suggestions'] ?? const [],
                }, _str(row['id']), (row['feedback'] as num?)?.toInt())));
      });
      _scrollDown();
    } catch (_) {
      // Sohbet açılamazsa mevcut ekran korunur.
    }
  }

  @override
  Widget build(BuildContext context) {
    final last = _messages.lastWhere((item) => !item.mine && item.response != null, orElse: () => _ChatMessage(false, ''));
    final focus = _student ? null : AssistantFocus.current.value;
    final focusChips = focus == null
        ? const <String>[]
        : widget.portal == 'accounting'
            ? [_english ? 'Payment status' : 'Ödeme durumu']
            : _english
                ? ['Attendance?', 'Exam results', 'Weak topics']
                : ['Devamsızlığı nasıl?', 'Sınav sonuçları', 'Zayıf olduğu konular'];
    final chips = _messages.isEmpty
        ? [...focusChips, ..._suggestions]
        : (last.response?['suggestions'] as List?)?.map(_str).where((label) => label.isNotEmpty).toList() ?? const <String>[];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const CircleAvatar(radius: 16, backgroundColor: _brand, child: Icon(Icons.smart_toy_rounded, size: 18, color: Colors.white)),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_english ? 'SchoolAsist Assistant' : 'SchoolAsist Asistan', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                Text(
                  _busy ? (_english ? 'typing…' : 'yazıyor…') : (_english ? 'Online' : 'Çevrimiçi'),
                  style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(tooltip: _english ? 'Previous chats' : 'Önceki sohbetler', onPressed: _openHistory, icon: const Icon(Icons.history_rounded)),
          IconButton(tooltip: _english ? 'New chat' : 'Yeni sohbet', onPressed: _reset, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                children: [
                  if (_messages.isEmpty) _intro(context),
                  ..._messages.map((message) => message.mine ? _mine(message.text) : _theirs(context, message)),
                  if (_busy) _typing(context),
                ],
              ),
            ),
            if (focus != null)
              Container(
                width: double.infinity,
                color: _brand.withValues(alpha: 0.06),
                padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
                child: Row(
                  children: [
                    const Icon(Icons.push_pin_rounded, size: 15, color: _brand),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(text: _english ? 'Student on screen: ' : 'Son bakılan öğrenci: '),
                          TextSpan(text: focus.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ]),
                        style: const TextStyle(fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      tooltip: _english ? 'Clear context' : 'Bağlamı kaldır',
                      onPressed: AssistantFocus.clear,
                      icon: const Icon(Icons.close_rounded, size: 16),
                    ),
                  ],
                ),
              ),
            if (chips.isNotEmpty && !_busy)
              SizedBox(
                height: 46,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  itemCount: chips.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (_, index) => ActionChip(
                    label: Text(chips[index], style: const TextStyle(fontSize: 12)),
                    onPressed: () => _send(chips[index]),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      maxLength: 1000,
                      textInputAction: TextInputAction.send,
                      onSubmitted: _send,
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: _english ? 'Ask something…' : _student ? 'Bir şey sor…' : 'Sorunuzu yazın…',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(999)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: _brand),
                    tooltip: _english ? 'Send' : 'Gönder',
                    onPressed: _busy ? null : () => _send(_input.text),
                    icon: const Icon(Icons.send_rounded, color: Colors.white),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _intro(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: _brand.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _briefing?['greeting'] != null ? _str(_briefing?['greeting']) : (_english ? 'Hi $_firstName!' : 'Merhaba $_firstName!'),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            // Günlük brifing: role göre bugünün öne çıkanları; dokununca ilgili soru sorulur.
            ...asMapList(_briefing?['items']).map((item) {
              final ask = _str(item['ask']);
              final row = Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: CircleAvatar(radius: 4, backgroundColor: _toneColors[_str(item['tone'])] ?? _brand),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_str(item['text']), style: const TextStyle(fontSize: 13.5))),
                    if (ask.isNotEmpty) Icon(Icons.chevron_right_rounded, size: 18, color: Theme.of(context).hintColor),
                  ],
                ),
              );
              return ask.isEmpty ? row : InkWell(borderRadius: BorderRadius.circular(8), onTap: () => _send(ask), child: row);
            }),
            const SizedBox(height: 4),
            Text(
              _english
                  ? 'Ask me in your own words — I only answer about your own portal.'
                  : _student
                      ? 'Bana kendi cümlelerinle sorabilirsin; yalnız kendi portalınla ilgili bilgileri paylaşırım.'
                      : 'Sorunuzu kendi cümlelerinizle yazabilirsiniz; yalnız kendi portalınızla ilgili bilgileri paylaşırım.',
              style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12),
            ),
          ],
        ),
      );

  Widget _mine(String text) => Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 300),
          margin: const EdgeInsets.only(bottom: 10, left: 40),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: const BoxDecoration(
            color: _brand,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(18), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(6)),
          ),
          child: Text(text, style: const TextStyle(color: Colors.white)),
        ),
      );

  Widget _typing(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            const CircleAvatar(radius: 13, backgroundColor: Color(0x224F46E5), child: Icon(Icons.smart_toy_rounded, size: 15, color: _brand)),
            const SizedBox(width: 8),
            Text(_english ? 'typing…' : 'yazıyor…', style: TextStyle(color: Theme.of(context).hintColor, fontStyle: FontStyle.italic)),
          ],
        ),
      );

  Widget _theirs(BuildContext context, _ChatMessage message) {
    final response = message.response;
    final denied = response?['type'] == 'permission_denied';
    final bubbleColor = denied ? const Color(0xFFF59E0B).withValues(alpha: 0.14) : Theme.of(context).dividerColor.withValues(alpha: 0.18);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, right: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CircleAvatar(radius: 13, backgroundColor: Color(0x224F46E5), child: Icon(Icons.smart_toy_rounded, size: 15, color: _brand)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(6), topRight: Radius.circular(18), bottomLeft: Radius.circular(18), bottomRight: Radius.circular(18)),
                  ),
                  child: Text(message.text, style: const TextStyle(height: 1.35)),
                ),
                if (response != null) ..._body(context, response),
                if (response != null) _feedback(context, message),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Cevap altında 👍/👎; "işe yaramadı" yöneticinin "Asistan Soruları" listesine düşer.
  Widget _feedback(BuildContext context, _ChatMessage message) {
    final hint = Theme.of(context).hintColor;
    if (message.feedback != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(_english ? 'Thanks for the feedback.' : 'Geri bildiriminiz için teşekkürler.', style: TextStyle(fontSize: 11, color: hint)),
      );
    }
    return Row(
      children: [
        IconButton(
          visualDensity: VisualDensity.compact,
          tooltip: _english ? 'Helpful' : 'İşe yaradı',
          onPressed: () => _rate(message, true),
          icon: Icon(Icons.thumb_up_alt_outlined, size: 16, color: hint),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          tooltip: _english ? 'Not helpful' : 'İşe yaramadı',
          onPressed: () => _rate(message, false),
          icon: Icon(Icons.thumb_down_alt_outlined, size: 16, color: hint),
        ),
      ],
    );
  }

  // ── Yanıt kartları ─────────────────────────────────────────────────────────

  List<Widget> _body(BuildContext context, Map<String, dynamic> response) {
    final data = asMap(response['data']);
    final items = asMapList(data['items']);
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    final widgets = <Widget>[];

    switch (response['type']) {
      case 'student_summary':
        widgets.add(_card(context, ListTile(
          dense: true,
          leading: CircleAvatar(backgroundColor: _brand.withValues(alpha: 0.15), child: Text(_str(data['fullName']).characters.firstOrNull ?? '', style: const TextStyle(color: _brand))),
          title: Text(_str(data['fullName']), style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text([_str(data['className']), _str(data['studentNumberMasked'])].where((part) => part.isNotEmpty && part != '-').join(' • ')),
        )));
      case 'student_selection' || 'student_list':
        if (items.isNotEmpty) {
          widgets.add(_card(context, Column(
            children: [
              ...items.take(12).map((item) {
                final id = _str(item['studentId']);
                final name = _str(item['fullName']);
                return ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  trailing: Text(item.containsKey('remaining') ? _money(item['remaining']) : _str(item['className']), style: hint),
                  onTap: id.isEmpty ? null : () => _command(name, 'summary', id),
                );
              }),
              if (items.length > 12) Padding(padding: const EdgeInsets.all(8), child: Text('+${items.length - 12}', style: hint)),
            ],
          )));
        }
      case 'attendance_summary':
        if (_num(data['total']) == 0) break;
        widgets.add(_stats(context, [
          (_english ? 'Records' : 'Kayıt', _str(data['total'])),
          (_english ? 'Absent' : 'Devamsız', _str(data['absent'])),
          (_english ? 'Late' : 'Geç', _str(data['late'])),
        ]));
        widgets.add(_rows(context, asMapList(data['recent']).take(5).map((row) => (_str(row['lesson']), _str(row['date']).split('T').first, _str(row['status']))).toList()));
      case 'exam_results':
        widgets.add(_rows(context, items.take(6).map((row) => ('${row['subject']} — ${row['examTitle']}', _str(row['date']), _str(row['score']))).toList()));
      case 'homework_list':
        widgets.add(_rows(context, items.take(6).map((row) => ('${row['subject']} — ${row['title']}', _str(row['deadline']), '')).toList()));
      case 'schedule':
        final today = _num(data['today']).toInt();
        final todays = items.where((row) => _num(row['dayOfWeek']).toInt() == today).toList();
        final shown = todays.isNotEmpty ? todays : items;
        widgets.add(_rows(context, shown.take(8).map((row) {
          final day = _num(row['dayOfWeek']).toInt();
          return ('${row['startTime']} ${row['lesson']}', '${day >= 0 && day < _days.length ? _days[day].tr : ''} • ${row['className']}', '');
        }).toList()));
      case 'announcement_list':
        widgets.add(_rows(context, items.take(5).map((row) => (_str(row['title']), _str(row['date']), '')).toList()));
      case 'payment_summary':
        widgets.add(_stats(context, [
          (_english ? 'Total' : 'Toplam', _money(data['total'])),
          (_english ? 'Paid' : 'Ödenen', _money(data['paid'])),
          (_english ? 'Remaining' : 'Kalan', _money(data['remaining'])),
        ]));
      case 'library_loans':
        widgets.add(_rows(context, items.take(6).map((row) => (_str(row['title']), _str(row['deadline']), _str(row['status']))).toList()));
      case 'finance_overview':
        widgets.add(_stats(context, [
          (_english ? 'Collected' : 'Tahsil edilen', _money(data['collectedThisMonth'])),
          (_english ? 'Open debt' : 'Açık borç', _money(data['openDebt'])),
          (_english ? 'Overdue' : 'Vadesi geçen', _str(data['overdueInstallments'])),
        ]));
      case 'institution_summary':
        widgets.add(_stats(context, asMapList(data['metrics']).map((metric) => (_str(metric['label']), _str(metric['value']))).toList()));
      case 'topic_insight':
        for (final topic in asMapList(data['weakTopics'])) {
          final diagnosis = topicDiagnoses[_str(topic['diagnosis'])] ?? topicDiagnoses['misconception']!;
          widgets.add(_card(context, Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(child: Text(_str(topic['topic']), style: const TextStyle(fontWeight: FontWeight.w700))),
                  Text(diagnosis.$1.tr, style: TextStyle(fontSize: 11, color: diagnosis.$3, fontWeight: FontWeight.w600)),
                ]),
                Text('${topic['subject']} • ${topicPct(topic['successRate'])}', style: hint),
                const SizedBox(height: 4),
                Text((_student ? _selfAdvice[_str(topic['diagnosis'])] ?? _selfAdvice['misconception']! : diagnosis.$2).tr, style: const TextStyle(fontSize: 13)),
              ],
            ),
          )));
        }
      case 'how_to':
        final steps = (data['steps'] as List?)?.map(_str).toList() ?? const <String>[];
        widgets.add(_card(context, Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var index = 0; index < steps.length; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(radius: 10, backgroundColor: _brand, child: Text('${index + 1}', style: const TextStyle(fontSize: 11, color: Colors.white))),
                      const SizedBox(width: 8),
                      Expanded(child: Text(steps[index])),
                    ],
                  ),
                ),
            ],
          ),
        )));
      case 'transport_status':
        final route = asMap(data['route']);
        if (route.isNotEmpty) {
          widgets.add(_stats(context, [
            (_english ? 'Route' : 'Hat', _str(route['routeName'])),
            (_english ? 'Stop' : 'Durak', _str(route['stopName'])),
          ]));
        }
    }

    // Mobilde masaüstü rotalarına gidilemez; yalnız sohbet içi komutlar ve onay butonları gösterilir.
    final actions = asMapList(response['actions']).where((action) => action['type'] != 'navigate').toList();
    if (actions.isNotEmpty) {
      widgets.add(Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: actions.map((action) {
            final label = _str(action['label']);
            final command = _str(action['command']);
            final studentId = _str(asMap(action['parameters'])['studentId']);
            final onPressed = command.isEmpty ? null : () => _command(label, command, studentId.isEmpty ? null : studentId);
            return action['type'] == 'confirm_action'
                ? FilledButton(style: FilledButton.styleFrom(backgroundColor: _brand, visualDensity: VisualDensity.compact), onPressed: onPressed, child: Text(label))
                : OutlinedButton(style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact), onPressed: onPressed, child: Text(label));
          }).toList(),
        ),
      ));
    }
    return widgets;
  }

  Widget _card(BuildContext context, Widget child) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 8),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.35)),
        ),
        child: child,
      );

  Widget _stats(BuildContext context, List<(String, String)> stats) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: stats
              .map((stat) => Container(
                    constraints: const BoxConstraints(minWidth: 90),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: Theme.of(context).dividerColor.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(stat.$1, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
                        Text(stat.$2, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      ],
                    ),
                  ))
              .toList(),
        ),
      );

  Widget _rows(BuildContext context, List<(String, String, String)> rows) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    return _card(
      context,
      Column(
        children: rows
            .map((row) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  child: Row(
                    children: [
                      Expanded(child: Text(row.$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                      const SizedBox(width: 8),
                      Text(row.$2, style: hint),
                      if (row.$3.isNotEmpty) ...[const SizedBox(width: 8), Text(row.$3, style: const TextStyle(fontWeight: FontWeight.w800))],
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}
