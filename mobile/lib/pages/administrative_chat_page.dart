import 'package:flutter/material.dart';

import '../widgets/admin_ui.dart';
import '../widgets/chat_conversation_view.dart';

class AdministrativeChatPage extends StatefulWidget {
  final String user;
  final String role;
  final String? initialDraft;
  final String? threadId;
  final String? contactKey;

  const AdministrativeChatPage({
    super.key,
    required this.user,
    required this.role,
    this.initialDraft,
    this.threadId,
    this.contactKey,
  });

  @override
  State<AdministrativeChatPage> createState() => _AdministrativeChatPageState();
}

class _AdministrativeChatPageState extends State<AdministrativeChatPage> {
  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(title: Text(widget.user)),
      child: ChatConversationView(
        contactName: widget.user,
        contactRole: _apiRole(widget.role),
        contactKey: widget.contactKey,
        threadId: widget.threadId,
        initialDraft: widget.initialDraft,
      ),
    );
  }

  String _apiRole(String role) {
    switch (role) {
      case 'Finans':
        return 'Accounting';
      case 'Veli İletişimi':
        return 'Parent';
      case 'Merkez':
        return 'Admin';
      default:
        return 'Admin';
    }
  }
}
