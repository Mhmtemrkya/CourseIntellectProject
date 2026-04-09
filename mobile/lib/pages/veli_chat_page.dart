import 'package:flutter/material.dart';

import '../widgets/app_header.dart';
import '../widgets/chat_conversation_view.dart';

class VeliChatPage extends StatefulWidget {
  final String user;
  final String? threadId;
  final String contactRole;
  final String? contactKey;

  const VeliChatPage({
    super.key,
    required this.user,
    this.threadId,
    this.contactRole = 'Teacher',
    this.contactKey,
  });

  @override
  State<VeliChatPage> createState() => _VeliChatPageState();
}

class _VeliChatPageState extends State<VeliChatPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppHeader(title: widget.user),
      body: ChatConversationView(
        contactName: widget.user,
        contactRole: widget.contactRole,
        contactKey: widget.contactKey,
        threadId: widget.threadId,
      ),
    );
  }
}
