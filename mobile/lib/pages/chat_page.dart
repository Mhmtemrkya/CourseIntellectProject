import 'package:flutter/material.dart';
import 'package:student/widgets/app_header.dart';

import '../widgets/chat_conversation_view.dart';
import '../widgets/responsive_layout.dart';

class ChatPage extends StatefulWidget {
  final String user;
  final String? threadId;
  final String contactRole;
  final String? contactKey;

  const ChatPage({
    super.key,
    required this.user,
    this.threadId,
    this.contactRole = 'Teacher',
    this.contactKey,
  });

  @override
  State<ChatPage> createState() => ChatPageState();
}

class ChatPageState extends State<ChatPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: widget.user),
      body: ResponsiveContent(
        child: ChatConversationView(
          contactName: widget.user,
          contactRole: widget.contactRole,
          contactKey: widget.contactKey,
          threadId: widget.threadId,
        ),
      ),
    );
  }
}
