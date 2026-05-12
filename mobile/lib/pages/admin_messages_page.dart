import 'dart:async';

import 'package:flutter/material.dart';

import '../services/message_api_service.dart';
import '../services/message_realtime_service.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/message_threads_view.dart';
import 'admin_chat_page.dart';

class AdminMessagesPage extends StatefulWidget {
  const AdminMessagesPage({super.key});

  @override
  State<AdminMessagesPage> createState() => _AdminMessagesPageState();
}

class _AdminMessagesPageState extends State<AdminMessagesPage> {
  final _staffStore = StaffRegistryStore.instance;
  final _studentStore = StudentRegistryStore.instance;
  bool _loading = true;
  String? _error;
  List<MessageThreadRecord> _threads = const [];
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
      title: 'Yönetici Mesajları',
      threads: _threads,
      loading: _loading,
      error: _error,
      onRetry: _loadThreads,
      onCompose: _openComposer,
      onOpenThread: (thread) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => AdminChatPage(
              user: thread.contactName,
              role: _prettyRole(thread.contactRole),
              threadId: thread.id,
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
      final threads = await MessageApiService.instance.fetchThreads();
      if (!mounted) return;
      setState(() => _threads = threads);
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

  Future<void> _openComposer() async {
    await _staffStore.ensureLoaded();
    await _studentStore.ensureLoaded();
    if (!mounted) return;

    final recipients = _availableRecipients();
    final selected = await MessageThreadsView.showRecipientPicker(
      context: context,
      title: 'Yeni Mesaj',
      description:
          'Öğrenci, veli, öğretmen, muhasebe ve idari birimler ile yeni sohbet başlatın.',
      recipients: recipients,
    );

    if (!mounted || selected == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AdminChatPage(
          user: selected.name,
          role: _prettyRole(selected.role),
          contactKey: selected.contactKey,
        ),
      ),
    );
  }

  List<ChatRecipientOption> _availableRecipients() {
    final parents = <String, ChatRecipientOption>{};
    for (final student in _studentStore.students) {
      if (student.parentName.trim().isEmpty) continue;
      final key =
          '${student.parentName.trim().toLowerCase()}|${student.parentEmail.trim().toLowerCase()}';
      parents.putIfAbsent(
        key,
        () => ChatRecipientOption(
          name: student.parentName,
          role: 'Parent',
          contactKey: student.parentEmail.trim().isEmpty
              ? null
              : student.parentEmail.trim().split('@').first,
          subtitle: '${student.fullName} • ${student.className}',
        ),
      );
    }

    return [
      ..._studentStore.students.map(
        (item) => ChatRecipientOption(
          name: item.fullName,
          role: 'Student',
          contactKey: item.username,
          subtitle: item.className,
        ),
      ),
      ...parents.values,
      ..._staffStore.teachers
          .where((item) => _isActive(item.status))
          .map(
            (item) => ChatRecipientOption(
              name: item.fullName,
              role: 'Teacher',
              contactKey: item.username,
              subtitle: item.branchOrDepartment,
            ),
          ),
      ..._staffStore.staff
          .where(
            (item) => _isActive(item.status) && item.roleType == 'Muhasebeci',
          )
          .map(
            (item) => ChatRecipientOption(
              name: item.fullName,
              role: 'Accounting',
              contactKey: item.username,
              subtitle: item.branchOrDepartment,
            ),
          ),
      ..._staffStore.personnel
          .where((item) => _isActive(item.status))
          .map(
            (item) => ChatRecipientOption(
              name: item.fullName,
              role: 'Administrative',
              contactKey: item.username,
              subtitle: item.branchOrDepartment,
            ),
          ),
    ];
  }

  String _prettyRole(String role) {
    switch (role) {
      case 'Student':
        return 'Öğrenci';
      case 'Parent':
        return 'Veli';
      case 'Teacher':
        return 'Öğretmen';
      case 'Accounting':
        return 'Muhasebe';
      case 'Admin':
        return 'Yönetici';
      default:
        return 'İdari';
    }
  }

  bool _isActive(String status) => status == 'Aktif' || status == 'Active';
}
