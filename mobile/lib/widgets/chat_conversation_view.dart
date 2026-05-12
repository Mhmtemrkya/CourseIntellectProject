import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/auth_session_store.dart';
import '../services/message_api_service.dart';
import '../services/message_realtime_service.dart';
import 'message_bubble.dart';
import 'message_composer.dart';

class ChatConversationView extends StatefulWidget {
  final String contactName;
  final String contactRole;
  final String? contactKey;
  final String? threadId;
  final String? initialDraft;
  final EdgeInsetsGeometry padding;

  const ChatConversationView({
    super.key,
    required this.contactName,
    required this.contactRole,
    this.contactKey,
    this.threadId,
    this.initialDraft,
    this.padding = EdgeInsets.zero,
  });

  @override
  State<ChatConversationView> createState() => _ChatConversationViewState();
}

class _ChatConversationViewState extends State<ChatConversationView> {
  final ScrollController _scrollController = ScrollController();
  bool _loading = true;
  String? _error;
  String? _resolvedThreadId;
  AuthSession? _session;
  List<MessageItemRecord> _messages = const [];
  StreamSubscription<Map<String, dynamic>>? _messageSubscription;
  StreamSubscription<Map<String, dynamic>>? _messageStatusSubscription;
  StreamSubscription<Map<String, dynamic>>? _presenceSubscription;
  StreamSubscription<Map<String, dynamic>>? _typingSubscription;
  Timer? _silentSyncTimer;
  Timer? _typingDebounce;
  bool _isContactOnline = false;
  bool _isContactTyping = false;

  @override
  void initState() {
    super.initState();
    _resolvedThreadId = widget.threadId;
    _loadMessages();
  }

  @override
  void dispose() {
    _silentSyncTimer?.cancel();
    _typingDebounce?.cancel();
    _messageSubscription?.cancel();
    _messageStatusSubscription?.cancel();
    _presenceSubscription?.cancel();
    _typingSubscription?.cancel();
    MessageRealtimeService.instance.leaveThread(_resolvedThreadId);
    MessageRealtimeService.instance.unsubscribePresence(
      widget.contactKey ?? widget.contactName,
    );
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadMessages,
              child: const Text('Tekrar Dene'),
            ),
          ],
        ),
      );
    }

    final displayItems = _messages.reversed.toList();

    return Column(
      children: [
        _ConversationStatusCard(
          contactName: widget.contactName,
          contactRole: widget.contactRole,
          isOnline: _isContactOnline,
          isTyping: _isContactTyping,
        ),
        Expanded(
          child: Container(
            padding: widget.padding,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFEFF8F5), Color(0xFFF9FBFF)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: ListView.builder(
              controller: _scrollController,
              reverse: true,
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 18),
              itemCount: displayItems.length,
              itemBuilder: (context, index) {
                final message = displayItems[index];
                return MessageBubble(
                  message: message,
                  isMe: _isOwnMessage(message),
                  timeLabel: _timeLabel(message.sentAt),
                  onAttachmentTap: _openAttachment,
                  onDeleteForMe: () => _openMessageActions(message),
                );
              },
            ),
          ),
        ),
        MessageComposer(
          onSend: _sendMessage,
          onTypingChanged: _handleTypingChanged,
        ),
      ],
    );
  }

  Future<void> _loadMessages() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final thread = widget.threadId == null
          ? await MessageApiService.instance.createOrGetThread(
              contactName: widget.contactName,
              contactRole: widget.contactRole,
              contactKey: widget.contactKey,
              initialMessage: widget.initialDraft,
            )
          : null;
      final resolvedThreadId = widget.threadId ?? thread!.id;
      final messages = await MessageApiService.instance.fetchMessages(
        resolvedThreadId,
      );
      try {
        await MessageRealtimeService.instance.joinThread(resolvedThreadId);
        await MessageRealtimeService.instance.subscribePresence(
          widget.contactKey ?? widget.contactName,
        );
      } catch (_) {}

      _messageSubscription?.cancel();
      _messageSubscription = MessageRealtimeService
          .instance
          .messageReceivedStream
          .listen((payload) {
            if (!mounted ||
                payload['threadId']?.toString() != resolvedThreadId) {
              return;
            }
            final item = MessageItemRecord.fromMap(payload);
            setState(() {
              if (_messages.any((existing) => existing.id == item.id)) return;
              _messages = [..._messages, item];
            });
            _jumpToBottom();
          });

      _messageStatusSubscription?.cancel();
      _messageStatusSubscription = MessageRealtimeService
          .instance
          .messageStatusChangedStream
          .listen((payload) {
            if (!mounted ||
                payload['threadId']?.toString() != resolvedThreadId) {
              return;
            }
            final messageId = payload['messageId']?.toString();
            final status =
                payload['status']?.toString().toLowerCase() ?? 'delivered';
            setState(() {
              _messages = _messages.map((item) {
                if (item.id != messageId) return item;
                return MessageItemRecord(
                  id: item.id,
                  threadId: item.threadId,
                  senderName: item.senderName,
                  senderRole: item.senderRole,
                  isFromCurrentActor: item.isFromCurrentActor,
                  text: item.text,
                  isRead: status == 'read',
                  deliveredAt: item.deliveredAt,
                  readAt: payload['readAtUtc'] == null
                      ? item.readAt
                      : DateTime.tryParse(payload['readAtUtc'].toString()),
                  status: status,
                  attachments: item.attachments,
                  sentAt: item.sentAt,
                );
              }).toList();
            });
          });

      _presenceSubscription?.cancel();
      _presenceSubscription = MessageRealtimeService
          .instance
          .presenceChangedStream
          .listen((payload) {
            final actorKey = payload['actorKey']?.toString().toLowerCase();
            final expected = (widget.contactKey ?? widget.contactName)
                .toLowerCase();
            if (!mounted || actorKey != expected) return;
            setState(() {
              _isContactOnline = payload['isOnline'] == true;
            });
          });

      _typingSubscription?.cancel();
      _typingSubscription = MessageRealtimeService.instance.typingChangedStream
          .listen((payload) {
            if (!mounted ||
                payload['threadId']?.toString() != resolvedThreadId) {
              return;
            }
            final actorKey = payload['actorKey']?.toString().toLowerCase();
            final expected = (widget.contactKey ?? widget.contactName)
                .toLowerCase();
            if (actorKey != expected) return;
            setState(() {
              _isContactTyping = payload['isTyping'] == true;
            });
          });

      if (!mounted) return;
      setState(() {
        _session = session;
        _resolvedThreadId = resolvedThreadId;
        _messages = messages;
      });
      _startSilentFallbackSync();
      _jumpToBottom();
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _startSilentFallbackSync() {
    if (_resolvedThreadId == null) return;
    _silentSyncTimer?.cancel();
    _silentSyncTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      _refreshMessagesSilently();
    });
  }

  Future<void> _refreshMessagesSilently() async {
    final threadId = _resolvedThreadId;
    if (threadId == null || _loading) return;

    try {
      final latest = await MessageApiService.instance.fetchMessages(threadId);
      if (!mounted || _sameMessages(latest, _messages)) return;
      setState(() {
        _messages = latest;
        _error = null;
      });
      _jumpToBottom();
    } catch (_) {}
  }

  bool _sameMessages(
    List<MessageItemRecord> left,
    List<MessageItemRecord> right,
  ) {
    if (identical(left, right)) return true;
    if (left.length != right.length) return false;
    for (var index = 0; index < left.length; index += 1) {
      final a = left[index];
      final b = right[index];
      if (a.id != b.id ||
          a.status != b.status ||
          a.text != b.text ||
          a.isRead != b.isRead ||
          a.attachments.length != b.attachments.length) {
        return false;
      }
    }
    return true;
  }

  bool _isOwnMessage(MessageItemRecord message) {
    if (message.isFromCurrentActor) return true;
    final session = _session;
    if (session == null) return false;

    final senderName = _normalizeActor(message.senderName);
    final senderRole = _normalizeActor(message.senderRole);
    final fullName = _normalizeActor(session.fullName);
    final username = _normalizeActor(session.username);
    final role = _normalizeActor(session.primaryRole);

    return senderName.isNotEmpty &&
        (senderName == fullName || senderName == username) &&
        (senderRole.isEmpty || role.isEmpty || senderRole == role);
  }

  String _normalizeActor(String? value) {
    return (value ?? '')
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u')
        .trim();
  }

  Future<void> _sendMessage(
    String text,
    List<MessageAttachmentRecord> attachments,
  ) async {
    if (_resolvedThreadId == null) return;

    final optimisticId = 'temp-${DateTime.now().microsecondsSinceEpoch}';
    final optimistic = MessageItemRecord(
      id: optimisticId,
      threadId: _resolvedThreadId!,
      senderName: 'Ben',
      senderRole: widget.contactRole,
      isFromCurrentActor: true,
      text: text,
      isRead: false,
      deliveredAt: null,
      readAt: null,
      status: 'sent',
      attachments: attachments,
      sentAt: DateTime.now().toUtc(),
    );

    setState(() {
      _messages = [..._messages, optimistic];
    });
    _jumpToBottom();

    try {
      final created = await MessageApiService.instance.sendMessage(
        threadId: _resolvedThreadId!,
        text: text,
        attachments: attachments,
      );
      if (!mounted) return;
      setState(() {
        _messages = _messages.map((item) {
          if (item.id != optimisticId) return item;
          return MessageItemRecord(
            id: created.id,
            threadId: created.threadId,
            senderName: created.senderName,
            senderRole: created.senderRole,
            isFromCurrentActor: true,
            text: created.text,
            isRead: created.isRead,
            deliveredAt: created.deliveredAt,
            readAt: created.readAt,
            status: created.status == 'read' ? 'read' : 'delivered',
            attachments: created.attachments.isEmpty
                ? item.attachments
                : created.attachments,
            sentAt: created.sentAt,
          );
        }).toList();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _messages = _messages.map((item) {
          if (item.id != optimisticId) return item;
          return MessageItemRecord(
            id: item.id,
            threadId: item.threadId,
            senderName: item.senderName,
            senderRole: item.senderRole,
            isFromCurrentActor: item.isFromCurrentActor,
            text: item.text,
            isRead: item.isRead,
            deliveredAt: item.deliveredAt,
            readAt: item.readAt,
            status: 'failed',
            attachments: item.attachments,
            sentAt: item.sentAt,
          );
        }).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _handleTypingChanged(String value) {
    final hasText = value.trim().isNotEmpty;
    _typingDebounce?.cancel();
    AuthSessionStore.instance.load().then((session) {
      final actorName = session?.username.isNotEmpty == true
          ? session!.username
          : (session?.fullName ?? 'Ben');
      MessageRealtimeService.instance.setTyping(
        threadId: _resolvedThreadId,
        actorName: actorName,
        isTyping: hasText,
      );
    });
    if (!hasText) return;
    _typingDebounce = Timer(const Duration(milliseconds: 900), () {
      AuthSessionStore.instance.load().then((session) {
        final actorName = session?.username.isNotEmpty == true
            ? session!.username
            : (session?.fullName ?? 'Ben');
        MessageRealtimeService.instance.setTyping(
          threadId: _resolvedThreadId,
          actorName: actorName,
          isTyping: false,
        );
      });
    });
  }

  Future<void> _deleteForMe(MessageItemRecord message) async {
    if (_resolvedThreadId == null) return;
    try {
      await MessageApiService.instance.deleteForMe(
        threadId: _resolvedThreadId!,
        messageId: message.id,
      );
      if (!mounted) return;
      setState(() {
        _messages = _messages.where((item) => item.id != message.id).toList();
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _openMessageActions(MessageItemRecord message) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            ListTile(
              leading: const Icon(
                Icons.delete_outline_rounded,
                color: Color(0xFFDC2626),
              ),
              title: const Text('Benden Sil'),
              subtitle: const Text('Mesaj sadece senin ekranından kaldırılır.'),
              onTap: () async {
                Navigator.pop(context);
                await _deleteForMe(message);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openAttachment(MessageAttachmentRecord attachment) async {
    final uri = Uri.tryParse(attachment.absoluteUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _jumpToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  String _timeLabel(DateTime value) {
    final local = value.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}

class _ConversationStatusCard extends StatelessWidget {
  final String contactName;
  final String contactRole;
  final bool isOnline;
  final bool isTyping;

  const _ConversationStatusCard({
    required this.contactName,
    required this.contactRole,
    required this.isOnline,
    required this.isTyping,
  });

  @override
  Widget build(BuildContext context) {
    final subtitle = isTyping
        ? 'Yazıyor...'
        : isOnline
        ? 'Çevrimiçi'
        : contactRole;

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: const Color(0xFFDCFCE7),
            child: Text(
              contactName.trim().isEmpty
                  ? '?'
                  : contactName.trim()[0].toUpperCase(),
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F766E),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contactName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isTyping || isOnline
                            ? const Color(0xFF10B981)
                            : const Color(0xFF94A3B8),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isTyping
                            ? const Color(0xFF0F766E)
                            : const Color(0xFF64748B),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
