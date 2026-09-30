import 'package:flutter/material.dart';

import '../pages/admin_announcements_page.dart';
import '../pages/admin_messages_page.dart';
import '../pages/administrative_announcements_page.dart';
import '../pages/administrative_messages_page.dart';
import '../pages/accounting_messages_page.dart';
import '../pages/announcements_page.dart';
import '../pages/chat_page.dart';
import '../pages/homework_page.dart';
import '../pages/messages_page.dart';
import '../pages/student_guidance_page.dart';
import '../pages/student_library_page.dart';
import '../pages/teacher_announcements_page.dart';
import '../pages/teacher_library_page.dart';
import '../pages/teacher_messages_page.dart';
import '../pages/veli_chat_page.dart';
import '../pages/veli_duyurular_page.dart';
import '../pages/veli_guidance_page.dart';
import '../pages/veli_library_page.dart';
import '../pages/veli_mesajlar_page.dart';
import 'auth_session_store.dart';

/// Push bildirimine dokununca ilgili ekranı açar. Sunucu `data.category`
/// (message/announcement/homework/library/guidance) ve mesajda `threadId`
/// gönderir. Uygulama kapalıyken dokunulursa istek, rol paneli açılana kadar
/// bekletilir (splash/giriş akışı aksi halde açılan sayfayı ezerdi).
class PushNavigation {
  PushNavigation._();

  static final PushNavigation instance = PushNavigation._();

  // MaterialApp dil değişiminde yeniden kurulduğu için global bir navigatorKey
  // yerine panelin açıldığı Navigator saklanır (dil değişince giriş akışı
  // yeniden işler ve bunu tazeler).
  NavigatorState? _navigator;
  Map<String, dynamic>? _pending;

  /// LoginPage rol panelini açtıktan sonra çağırır.
  void markPanelReady(NavigatorState navigator) {
    _navigator = navigator;
    final pending = _pending;
    _pending = null;
    if (pending != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _open(pending));
    }
  }

  /// Oturum kapanınca panel yok sayılır; sonraki dokunuş girişten sonra açılır.
  void markPanelClosed() {
    _navigator = null;
    _pending = null;
  }

  void handleTap(Map<String, dynamic> data) {
    if (_navigator?.mounted != true) {
      _pending = data;
      return;
    }
    _open(data);
  }

  Future<void> _open(Map<String, dynamic> data) async {
    final session = await AuthSessionStore.instance.load();
    final navigator = _navigator;
    if (session == null || navigator == null || !navigator.mounted) return;
    final page = pageFor(
      role: session.primaryRole,
      category: data['category']?.toString() ?? '',
      threadId: data['threadId']?.toString(),
      senderName: data['senderName']?.toString(),
    );
    if (page == null) return;
    navigator.push(MaterialPageRoute<void>(builder: (_) => page));
  }

  /// Rol × kategori → hedef ekran. Eşleşme yoksa null (panelde kalınır).
  static Widget? pageFor({
    required String role,
    required String category,
    String? threadId,
    String? senderName,
  }) {
    final hasThread = threadId != null && threadId.isNotEmpty;
    final contact = (senderName == null || senderName.isEmpty) ? 'Mesaj' : senderName;
    switch (category) {
      case 'message':
        if (role == 'Parent') {
          return hasThread ? VeliChatPage(user: contact, threadId: threadId) : const VeliMesajlarPage();
        }
        if (hasThread) return ChatPage(user: contact, threadId: threadId);
        return switch (role) {
          'Student' => const MessagesPage(),
          'Teacher' => const TeacherMessagesPage(),
          'Admin' => const AdminMessagesPage(),
          'Administrative' => const AdministrativeMessagesPage(),
          'Accounting' => const AccountingMessagesPage(),
          _ => null,
        };
      case 'announcement':
        return switch (role) {
          'Student' => const AnnouncementsPage(),
          'Parent' => const VeliDuyurularPage(),
          'Teacher' => const TeacherAnnouncementsPage(),
          'Admin' => const AdminAnnouncementsPage(),
          'Administrative' => const AdministrativeAnnouncementsPage(),
          _ => null,
        };
      case 'homework':
        return role == 'Student' ? const HomeworkPage() : null;
      case 'library':
        return switch (role) {
          'Student' => const StudentLibraryPage(),
          'Parent' => const VeliLibraryPage(),
          'Teacher' => const TeacherLibraryPage(),
          _ => null,
        };
      case 'guidance':
        return switch (role) {
          'Student' => const StudentGuidancePage(),
          'Parent' => const VeliGuidancePage(),
          _ => null,
        };
      default:
        return null;
    }
  }
}
