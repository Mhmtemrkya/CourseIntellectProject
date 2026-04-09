import 'package:flutter/material.dart';

import '../widgets/app_header.dart';
import '../widgets/chat_conversation_view.dart';
import '../widgets/responsive_layout.dart';

class AdminChatPage extends StatefulWidget {
  final String user;
  final String role;
  final String? initialDraft;
  final String? threadId;
  final String? contactKey;

  const AdminChatPage({
    super.key,
    required this.user,
    required this.role,
    this.initialDraft,
    this.threadId,
    this.contactKey,
  });

  @override
  State<AdminChatPage> createState() => _AdminChatPageState();
}

class _AdminChatPageState extends State<AdminChatPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: widget.user),
      body: ResponsiveContent(
        child: ChatConversationView(
          contactName: widget.user,
          contactRole: _apiRole(widget.role),
          contactKey: widget.contactKey,
          threadId: widget.threadId,
          initialDraft: widget.initialDraft,
        ),
      ),
    );
  }

  String _apiRole(String role) {
    switch (role) {
      case 'Öğretmen':
        return 'Teacher';
      case 'Muhasebe':
        return 'Accounting';
      default:
        return 'Administrative';
    }
  }
}
