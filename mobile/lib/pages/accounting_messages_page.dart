import 'dart:async';

import 'package:flutter/material.dart';

import '../services/message_api_service.dart';
import '../services/message_realtime_service.dart';
import '../services/staff_registry_store.dart';
import '../widgets/message_threads_view.dart';
import 'accounting_chat_page.dart';

class AccountingMessagesPage extends StatefulWidget {
  final String? initialStudent;

  const AccountingMessagesPage({super.key, this.initialStudent});

  @override
  State<AccountingMessagesPage> createState() => _AccountingMessagesPageState();
}

class _AccountingMessagesPageState extends State<AccountingMessagesPage> {
  bool _loading = true;
  String? _error;
  List<MessageThreadRecord> _threads = const [];
  final _staffStore = StaffRegistryStore.instance;
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
      highlightedContact: widget.initialStudent,
      onOpenThread: (thread) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => AccountingChatPage(
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
    await _staffStore.ensureLoaded();
    if (!mounted) return;

    final recipients = <ChatRecipientOption>[
      ..._staffStore.staff
          .where((item) => _isReachableForAccounting(item))
          .map(
            (staff) => ChatRecipientOption(
              name: staff.fullName,
              role: _resolveRecipientRole(staff),
              contactKey: staff.username,
              subtitle: staff.branchOrDepartment,
            ),
          ),
    ]..sort((a, b) => a.name.compareTo(b.name));

    final selected = await MessageThreadsView.showRecipientPicker(
      context: context,
      title: 'Alıcı Seç',
      description:
          'Yalnızca idari birimler ve yönetiçi ile yeni sohbet başlatabilirsiniz.',
      recipients: recipients,
    );

    if (!mounted || selected == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AccountingChatPage(
          user: selected.name,
          contactRole: selected.role,
          contactKey: selected.contactKey,
        ),
      ),
    );
  }

  bool _isActive(String status) => status == 'Aktif' || status == 'Active';

  bool _isReachableForAccounting(StaffRegistryRecord staff) {
    if (!_isActive(staff.status)) {
      return false;
    }

    final role = staff.roleType.trim();
    final extraRoles = staff.extraRoles.map((item) => item.trim()).toSet();
    return role == 'Admin' ||
        role == 'Personel' ||
        role == 'İdari Birimler' ||
        extraRoles.contains('Admin') ||
        extraRoles.contains('Administrative');
  }

  String _resolveRecipientRole(StaffRegistryRecord staff) {
    final role = staff.roleType.trim();
    final extraRoles = staff.extraRoles.map((item) => item.trim()).toSet();
    if (role == 'Admin' || extraRoles.contains('Admin')) {
      return 'Admin';
    }
    return 'Administrative';
  }
}
