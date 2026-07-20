import 'package:flutter/material.dart';

import '../data/assistant_api_service.dart';
import '../data/assistant_models.dart';

class AssistantPage extends StatefulWidget {
  const AssistantPage({super.key});
  @override
  State<AssistantPage> createState() => _AssistantPageState();
}

class _AssistantPageState extends State<AssistantPage> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <AssistantMessageModel>[
    const AssistantMessageModel(
      id: 'welcome',
      sender: 'assistant',
      type: 'text',
      text:
          'Merhaba! Yetkiniz kapsamındaki okul, dershane ve sürücü kursu bilgilerine güvenli biçimde ulaşmanıza yardımcı olabilirim.',
    ),
  ];
  List<AssistantSuggestionModel> _suggestions = const [];
  bool _loading = false;
  String? _conversationId;
  String? _error;
  String? _lastMessage;

  @override
  void initState() {
    super.initState();
    _loadSuggestions();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadSuggestions() async {
    try {
      final rows = await AssistantApiService.instance.suggestions();
      if (mounted) setState(() => _suggestions = rows);
    } catch (_) {}
  }

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _controller.text).trim();
    if (text.isEmpty || _loading) return;
    setState(() {
      _messages.add(
        AssistantMessageModel(
          id: 'local-${DateTime.now().microsecondsSinceEpoch}',
          sender: 'user',
          type: 'text',
          text: text,
        ),
      );
      _controller.clear();
      _loading = true;
      _error = null;
      _lastMessage = text;
    });
    _toBottom();
    try {
      final response = await AssistantApiService.instance.send(
        message: text,
        conversationId: _conversationId,
      );
      if (!mounted) return;
      setState(() {
        _conversationId ??= response.conversationId;
        _messages.add(response);
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
      _toBottom();
    }
  }

  Future<void> _action(AssistantActionModel action) async {
    if (_conversationId == null || action.command == null || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await AssistantApiService.instance.action(
        conversationId: _conversationId!,
        command: action.command!,
        studentId: action.studentId,
      );
      if (mounted) setState(() => _messages.add(response));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
      _toBottom();
    }
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        titleSpacing: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'SchoolAsist Asistan',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            Text(
              'Kural tabanlı · Güvenli erişim',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => setState(() {
              _messages
                ..clear()
                ..add(
                  const AssistantMessageModel(
                    id: 'welcome',
                    sender: 'assistant',
                    type: 'text',
                    text: 'Yeni sohbet hazır. Nasıl yardımcı olabilirim?',
                  ),
                );
              _conversationId = null;
              _error = null;
            }),
            icon: const Icon(Icons.add_comment_outlined),
            tooltip: 'Yeni sohbet',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(14),
                itemCount: _messages.length + (_loading ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == _messages.length) {
                    return const Padding(
                      padding: EdgeInsets.all(12),
                      child: Row(
                        children: [
                          SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 10),
                          Text('Bilgiler güvenli biçimde kontrol ediliyor…'),
                        ],
                      ),
                    );
                  }
                  return _bubble(_messages[index], theme);
                },
              ),
            ),
            if (_messages.length <= 2 && _suggestions.isNotEmpty)
              SizedBox(
                height: 48,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  itemCount: _suggestions.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 7),
                  itemBuilder: (_, i) => ActionChip(
                    label: Text(_suggestions[i].label),
                    onPressed: () => _send(_suggestions[i].label),
                  ),
                ),
              ),
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: theme.colorScheme.onErrorContainer,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: _lastMessage == null
                          ? null
                          : () => _send(_lastMessage),
                      child: const Text('Tekrar dene'),
                    ),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 9, 12, 10),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(
                  top: BorderSide(
                    color: theme.dividerColor.withValues(alpha: .25),
                  ),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 1000,
                      textInputAction: TextInputAction.newline,
                      decoration: const InputDecoration(
                        counterText: '',
                        hintText: 'Bir komut yazın…',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(16)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _loading ? null : _send,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bubble(AssistantMessageModel message, ThemeData theme) {
    final user = message.sender == 'user';
    final denied =
        message.type == 'error' || message.type == 'permission_denied';
    return Align(
      alignment: user ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 560),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: user
              ? theme.colorScheme.primary
              : denied
              ? theme.colorScheme.errorContainer
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.text,
              style: TextStyle(
                color: user
                    ? theme.colorScheme.onPrimary
                    : denied
                    ? theme.colorScheme.onErrorContainer
                    : null,
              ),
            ),
            if (message.data != null) _data(message.data!, theme),
            if (message.actions.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 9),
                child: Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: message.actions
                      .map(
                        (x) => ActionChip(
                          label: Text(x.label),
                          onPressed: () => _action(x),
                        ),
                      )
                      .toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _data(Map<String, dynamic> data, ThemeData theme) {
    final rawItems = data['items'] ?? data['recent'];
    final items = rawItems is List
        ? rawItems.whereType<Map>().take(12).toList()
        : const <Map>[];
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (data['fullName'] != null)
            Text(
              '${data['fullName']}${data['className'] != null ? ' · ${data['className']}' : ''}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          if (data['remaining'] != null)
            Text(
              'Kalan: ${data['remaining']} ₺',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ...items.map((raw) {
            final item = Map<String, dynamic>.from(raw);
            final title =
                item['fullName'] ??
                item['title'] ??
                item['examTitle'] ??
                item['lesson'] ??
                item['label'] ??
                'Kayıt';
            final detail = [
              item['className'],
              item['subject'],
              item['status'],
              item['date'],
              item['deadline'],
              item['score'] == null ? null : '${item['score']} puan',
            ].where((x) => x != null && '$x'.isNotEmpty).join(' · ');
            return Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 7),
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$title',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (detail.isNotEmpty)
                    Text(detail, style: theme.textTheme.bodySmall),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
