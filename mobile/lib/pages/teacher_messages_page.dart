import 'dart:async';

import 'package:flutter/material.dart';

import '../services/message_api_service.dart';
import '../services/message_realtime_service.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/message_threads_view.dart';
import 'teacher_chat_page.dart';

class TeacherMessagesPage extends StatefulWidget {
  const TeacherMessagesPage({super.key});

  @override
  State<TeacherMessagesPage> createState() => _TeacherMessagesPageState();
}

class _TeacherMessagesPageState extends State<TeacherMessagesPage> {
  bool _loading = true;
  String? _error;
  List<MessageThreadRecord> _threads = const [];
  final _studentStore = StudentRegistryStore.instance;
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
            builder: (_) => TeacherChatPage(
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

  Future<void> _openRecipientPicker() async {
    await _studentStore.ensureLoaded();
    await StaffRegistryStore.instance.ensureLoaded();
    if (!mounted) return;

    final parentMap = <String, ChatRecipientOption>{};
    for (final student in _studentStore.students) {
      if (student.parentName.trim().isEmpty) continue;
      final key =
          '${student.parentName.trim().toLowerCase()}|${student.parentEmail.trim().toLowerCase()}';
      parentMap.putIfAbsent(
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

    final recipients = <ChatRecipientOption>[
      ..._studentStore.students.map(
        (student) => ChatRecipientOption(
          name: student.fullName,
          role: 'Student',
          contactKey: student.username,
          subtitle: student.className,
        ),
      ),
      ...parentMap.values,
      ...StaffRegistryStore.instance.staff
          .where(
            (item) =>
                _isActive(item.status) &&
                (item.roleType == 'Personel' || item.roleType == 'Admin'),
          )
          .map(
            (staff) => ChatRecipientOption(
              name: staff.fullName,
              role: staff.roleType == 'Admin' ? 'Admin' : 'Administrative',
              contactKey: staff.username,
              subtitle: staff.branchOrDepartment,
            ),
          ),
    ];

    final selected = await MessageThreadsView.showRecipientPicker(
      context: context,
      title: 'Alıcı Seç',
      description:
          'Öğrenci, veli, idari birim veya yönetiçi ile yeni sohbet başlatın.',
      recipients: recipients,
    );

    if (!mounted || selected == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TeacherChatPage(
          user: selected.name,
          contactRole: selected.role,
          contactKey: selected.contactKey,
        ),
      ),
    );
  }

  bool _isActive(String status) => status == 'Aktif' || status == 'Active';
}
