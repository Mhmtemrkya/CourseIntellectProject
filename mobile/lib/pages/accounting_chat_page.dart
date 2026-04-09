import 'package:flutter/material.dart';

import '../widgets/app_header.dart';
import '../widgets/chat_conversation_view.dart';

class AccountingChatPage extends StatefulWidget {
  final String user;
  final String? threadId;
  final String contactRole;
  final String? contactKey;

  const AccountingChatPage({
    super.key,
    required this.user,
    this.threadId,
    this.contactRole = 'Parent',
    this.contactKey,
  });

  @override
  State<AccountingChatPage> createState() => _AccountingChatPageState();
}

class _AccountingChatPageState extends State<AccountingChatPage> {
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
