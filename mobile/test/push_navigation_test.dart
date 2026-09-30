import 'package:flutter_test/flutter_test.dart';
import 'package:student/pages/announcements_page.dart';
import 'package:student/pages/chat_page.dart';
import 'package:student/pages/homework_page.dart';
import 'package:student/pages/messages_page.dart';
import 'package:student/pages/veli_chat_page.dart';
import 'package:student/pages/veli_duyurular_page.dart';
import 'package:student/services/push_navigation.dart';

void main() {
  test('öğrenci: mesaj/duyuru/ödev bildirimi ilgili ekrana gider', () {
    expect(
      PushNavigation.pageFor(role: 'Student', category: 'message', threadId: 't1', senderName: 'Hasan'),
      isA<ChatPage>().having((p) => p.threadId, 'threadId', 't1').having((p) => p.user, 'user', 'Hasan'),
    );
    expect(PushNavigation.pageFor(role: 'Student', category: 'message'), isA<MessagesPage>());
    expect(PushNavigation.pageFor(role: 'Student', category: 'announcement'), isA<AnnouncementsPage>());
    expect(PushNavigation.pageFor(role: 'Student', category: 'homework'), isA<HomeworkPage>());
  });

  test('veli kendi ekranlarına gider', () {
    expect(PushNavigation.pageFor(role: 'Parent', category: 'message', threadId: 't1'), isA<VeliChatPage>());
    expect(PushNavigation.pageFor(role: 'Parent', category: 'announcement'), isA<VeliDuyurularPage>());
  });

  test('bilinmeyen kategori panelde bırakır', () {
    expect(PushNavigation.pageFor(role: 'Student', category: 'bilinmeyen'), isNull);
    expect(PushNavigation.pageFor(role: 'Parent', category: 'homework'), isNull);
  });
}
