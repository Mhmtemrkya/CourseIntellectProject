import 'package:flutter/material.dart';

import '../widgets/chat_conversation_view.dart';

class TeacherChatPage extends StatefulWidget {
  final String user;
  final String? threadId;
  final String contactRole;
  final String? contactKey;

  const TeacherChatPage({
    super.key,
    required this.user,
    this.threadId,
    this.contactRole = 'Student',
    this.contactKey,
  });

  @override
  State<TeacherChatPage> createState() => _TeacherChatPageState();
}

class _TeacherChatPageState extends State<TeacherChatPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(title: Text(widget.user)),
      body: ChatConversationView(
        contactName: widget.user,
        contactRole: widget.contactRole,
        contactKey: widget.contactKey,
        threadId: widget.threadId,
      ),
    );
  }
}
