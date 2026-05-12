import 'dart:async';

import 'package:flutter/material.dart';

import '../services/message_api_service.dart';
import '../services/message_realtime_service.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/message_threads_view.dart';
import 'administrative_chat_page.dart';

class AdministrativeMessagesPage extends StatefulWidget {
  const AdministrativeMessagesPage({super.key});

  @override
  State<AdministrativeMessagesPage> createState() =>
      _AdministrativeMessagesPageState();
}

class _AdministrativeMessagesPageState
    extends State<AdministrativeMessagesPage> {
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
      title: 'İdari Mesajlar',
      threads: _threads,
      loading: _loading,
      error: _error,
      onRetry: _loadThreads,
      onCompose: _openComposer,
      onOpenThread: (thread) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => AdministrativeChatPage(
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
    await StaffRegistryStore.instance.ensureLoaded();
    await StudentRegistryStore.instance.ensureLoaded();
    if (!mounted) return;

    final recipients = await _loadContacts();
    if (!mounted) return;
    final selected = await MessageThreadsView.showRecipientPicker(
      context: context,
      title: 'Yeni Mesaj',
      description:
          'Öğrenci, veli, öğretmen, muhasebe ve kurum yönetimiyle yeni sohbet başlatın.',
      recipients: recipients,
    );

    if (!mounted || selected == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AdministrativeChatPage(
          user: selected.name,
          role: _prettyRole(selected.role),
          contactKey: selected.contactKey,
        ),
      ),
    );
  }

  Future<List<ChatRecipientOption>> _loadContacts() async {
    final studentContacts = StudentRegistryStore.instance.students.map(
      (item) => ChatRecipientOption(
        name: item.fullName,
        role: 'Student',
        contactKey: item.username,
        subtitle: item.className,
      ),
    );
    final staffContacts = StaffRegistryStore.instance.staff
        .where((item) => _isActive(item.status))
        .map(
          (item) => ChatRecipientOption(
            name: item.fullName,
            role: item.roleType == 'Muhasebeci'
                ? 'Accounting'
                : item.roleType == 'Admin'
                ? 'Admin'
                : item.roleType == 'Öğretmen'
                ? 'Teacher'
                : 'Administrative',
            contactKey: item.username,
            subtitle: item.branchOrDepartment,
          ),
        );
    final parentContacts = StudentRegistryStore.instance.students
        .map((item) => item.parentName)
        .where((item) => item.trim().isNotEmpty)
        .toSet()
        .map(
          (item) => ChatRecipientOption(
            name: item,
            role: 'Parent',
            contactKey: StudentRegistryStore.instance.students
                .firstWhere((student) => student.parentName == item)
                .parentEmail
                .trim()
                .split('@')
                .first,
            subtitle: 'Veli İletişimi',
          ),
        );
    return [...studentContacts, ...staffContacts, ...parentContacts].toList();
  }

  String _prettyRole(String role) {
    switch (role) {
      case 'Student':
        return 'Öğrenci';
      case 'Teacher':
        return 'Öğretmen';
      case 'Accounting':
        return 'Finans';
      case 'Parent':
        return 'Veli İletişimi';
      case 'Admin':
        return 'Merkez';
      default:
        return 'İdari';
    }
  }

  bool _isActive(String status) => status == 'Aktif' || status == 'Active';
}
