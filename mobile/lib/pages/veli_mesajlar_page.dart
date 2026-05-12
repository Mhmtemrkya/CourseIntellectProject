import 'dart:async';

import 'package:flutter/material.dart';

import '../services/linked_children_service.dart';
import '../services/message_api_service.dart';
import '../services/message_realtime_service.dart';
import '../services/staff_registry_store.dart';
import '../widgets/message_threads_view.dart';
import 'veli_chat_page.dart';

class VeliMesajlarPage extends StatefulWidget {
  const VeliMesajlarPage({super.key});

  @override
  State<VeliMesajlarPage> createState() => _VeliMesajlarPageState();
}

class _VeliMesajlarPageState extends State<VeliMesajlarPage> {
  bool _loading = true;
  String? _error;
  List<MessageThreadRecord> _threads = const [];
  final _staffStore = StaffRegistryStore.instance;
  List<LinkedChildRecord> _children = const [];
  StreamSubscription<Map<String, dynamic>>? _threadSubscription;
  Timer? _silentSyncTimer;

  @override
  void initState() {
    super.initState();
    MessageRealtimeService.instance.ensureConnected().catchError((_) {});
    _threadSubscription = MessageRealtimeService.instance.threadUpdatedStream
        .listen((payload) {
          if (!mounted) return;
          _upsertThread(MessageThreadRecord.fromMap(payload));
        });
    _loadThreads();
    _startSilentFallbackSync();
  }

  @override
  void dispose() {
    _silentSyncTimer?.cancel();
    _threadSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MessageThreadsView(
      title: 'Mesajlar',
      threads: _threads,
      loading: _loading,
      error: _error,
      onRetry: _loadThreads,
      onCompose: _openRecipientPicker,
      onOpenThread: (thread) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => VeliChatPage(
              user: thread.contactName,
              threadId: thread.id,
              contactRole: thread.contactRole,
            ),
          ),
        );
      },
    );
  }

  Future<void> _loadThreads() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final children = await LinkedChildrenService.instance
          .loadLinkedChildren();
      final threads = await MessageApiService.instance.fetchThreads();
      if (!mounted) return;
      setState(() {
        _threads = threads;
        _children = children;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _upsertThread(MessageThreadRecord record) {
    setState(() {
      final next = [..._threads];
      final index = next.indexWhere((item) => item.id == record.id);
      if (index >= 0) {
        next[index] = record;
      } else {
        next.insert(0, record);
      }
      next.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
      _threads = next;
    });
  }

  void _startSilentFallbackSync() {
    _silentSyncTimer?.cancel();
    _silentSyncTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _refreshThreadsSilently();
    });
  }

  Future<void> _refreshThreadsSilently() async {
    if (_loading) return;
    try {
      final latest = await MessageApiService.instance.fetchThreads();
      if (!mounted || _sameThreads(latest, _threads)) return;
      setState(() {
        _threads = latest;
        _error = null;
      });
    } catch (_) {}
  }

  bool _sameThreads(
    List<MessageThreadRecord> left,
    List<MessageThreadRecord> right,
  ) {
    if (identical(left, right)) return true;
    if (left.length != right.length) return false;
    for (var index = 0; index < left.length; index += 1) {
      final a = left[index];
      final b = right[index];
      if (a.id != b.id ||
          a.unreadCount != b.unreadCount ||
          a.lastMessagePreview != b.lastMessagePreview ||
          a.lastMessageStatus != b.lastMessageStatus ||
          a.lastMessageAt != b.lastMessageAt) {
        return false;
      }
    }
    return true;
  }

  Future<void> _openRecipientPicker() async {
    await _staffStore.ensureLoaded();
    if (!mounted) return;

    final teachers = _staffStore.teachers.where(
      (item) => _isActive(item.status),
    );
    final administrative = _staffStore.personnel.where(
      (item) => _isActive(item.status),
    );
    final admins = _staffStore.staff.where(
      (item) => _isActive(item.status) && item.roleType == 'Admin',
    );
    final recipients = <ChatRecipientOption>[
      ..._children.map(
        (child) => ChatRecipientOption(
          name: child.fullName,
          role: 'Student',
          subtitle: child.className,
        ),
      ),
      ...teachers.map(
        (teacher) => ChatRecipientOption(
          name: teacher.fullName,
          role: 'Teacher',
          contactKey: teacher.username,
          subtitle: teacher.branchOrDepartment,
        ),
      ),
      ...administrative.map(
        (staff) => ChatRecipientOption(
          name: staff.fullName,
          role: 'Administrative',
          contactKey: staff.username,
          subtitle: staff.branchOrDepartment,
        ),
      ),
      ...admins.map(
        (staff) => ChatRecipientOption(
          name: staff.fullName,
          role: 'Admin',
          contactKey: staff.username,
          subtitle: staff.branchOrDepartment,
        ),
      ),
    ];

    final selected = await MessageThreadsView.showRecipientPicker(
      context: context,
      title: 'Aliçi Seç',
      description:
          'Çocuğunuza, öğretmenlere, idari birimlere ve yönetiçiye mesaj gönderebilirsiniz.',
      recipients: recipients,
    );

    if (!mounted || selected == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VeliChatPage(
          user: selected.name,
          contactRole: selected.role,
          contactKey: selected.contactKey,
        ),
      ),
    );
  }

  bool _isActive(String status) => status == 'Aktif' || status == 'Active';
}
