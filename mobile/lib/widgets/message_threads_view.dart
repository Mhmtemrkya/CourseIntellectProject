import 'package:flutter/material.dart';

import '../services/message_api_service.dart';

class ChatRecipientOption {
  final String name;
  final String role;
  final String? contactKey;
  final String? subtitle;

  const ChatRecipientOption({
    required this.name,
    required this.role,
    this.contactKey,
    this.subtitle,
  });
}

class MessageThreadsView extends StatelessWidget {
  final String title;
  final List<MessageThreadRecord> threads;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;
  final void Function(MessageThreadRecord thread) onOpenThread;
  final VoidCallback onCompose;
  final String composeLabel;
  final String? highlightedContact;

  const MessageThreadsView({
    super.key,
    required this.title,
    required this.threads,
    required this.loading,
    required this.error,
    required this.onRetry,
    required this.onOpenThread,
    required this.onCompose,
    this.composeLabel = 'Yeni Mesaj',
    this.highlightedContact,
  });

  @override
  Widget build(BuildContext context) {
    final sortedThreads = [...threads];
    if (highlightedContact != null && highlightedContact!.trim().isNotEmpty) {
      sortedThreads.sort((a, b) {
        if (a.contactName == highlightedContact) return -1;
        if (b.contactName == highlightedContact) return 1;
        return b.lastMessageAt.compareTo(a.lastMessageAt);
      });
    } else {
      sortedThreads.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
    }

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: onCompose,
        icon: const Icon(Icons.add_comment_outlined),
        label: Text(composeLabel),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: onRetry,
                    child: const Text('Tekrar Dene'),
                  ),
                ],
              ),
            )
          : sortedThreads.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.chat_bubble_outline_rounded,
                      size: 48,
                      color: Theme.of(
                        context,
                      ).colorScheme.primary.withValues(alpha: 0.7),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Henüz sohbet yok',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Yeni mesaj başlatarak konuşmaları burada görebilirsiniz.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
              itemCount: sortedThreads.length,
              separatorBuilder: (_, _) => const SizedBox(height: 6),
              itemBuilder: (context, index) {
                final thread = sortedThreads[index];
                final isHighlighted = highlightedContact == thread.contactName;
                return Material(
                  color: isHighlighted
                      ? Theme.of(
                          context,
                        ).colorScheme.primary.withValues(alpha: 0.08)
                      : Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(22),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(22),
                    onTap: () => onOpenThread(thread),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: _roleColor(
                              thread.contactRole,
                            ).withValues(alpha: 0.14),
                            foregroundColor: _roleColor(thread.contactRole),
                            child: Icon(_roleIcon(thread.contactRole)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  thread.contactName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    if (thread.lastMessageFromMe) ...[
                                      Icon(
                                        _statusIcon(thread.lastMessageStatus),
                                        size: 16,
                                        color: _statusColor(
                                          thread.lastMessageStatus,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                    ],
                                    Expanded(
                                      child: Text(
                                        thread.lastMessagePreview,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium
                                            ?.copyWith(
                                              color: Theme.of(
                                                context,
                                              ).colorScheme.onSurfaceVariant,
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _timeLabel(thread.lastMessageAt),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.onSurfaceVariant,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              if (thread.unreadCount > 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 9,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    '${thread.unreadCount}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }

  static Future<ChatRecipientOption?> showRecipientPicker({
    required BuildContext context,
    required String title,
    String? description,
    required List<ChatRecipientOption> recipients,
  }) {
    return showModalBottomSheet<ChatRecipientOption>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            if (description != null && description.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(description),
            ],
            const SizedBox(height: 16),
            ...recipients.map(
              (recipient) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: _roleColor(
                    recipient.role,
                  ).withValues(alpha: 0.14),
                  foregroundColor: _roleColor(recipient.role),
                  child: Icon(_roleIcon(recipient.role)),
                ),
                title: Text(recipient.name),
                subtitle: recipient.subtitle == null
                    ? null
                    : Text(recipient.subtitle!),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.pop(context, recipient),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static IconData _roleIcon(String role) {
    switch (role) {
      case 'Teacher':
        return Icons.school_outlined;
      case 'Student':
        return Icons.badge_outlined;
      case 'Parent':
        return Icons.family_restroom_outlined;
      case 'Accounting':
        return Icons.account_balance_wallet_outlined;
      case 'Administrative':
      case 'Admin':
        return Icons.apartment_outlined;
      default:
        return Icons.person_outline_rounded;
    }
  }

  static Color _roleColor(String role) {
    switch (role) {
      case 'Teacher':
        return const Color(0xFF0F766E);
      case 'Student':
        return const Color(0xFF2563EB);
      case 'Parent':
        return const Color(0xFF7C3AED);
      case 'Accounting':
        return const Color(0xFF15803D);
      case 'Administrative':
      case 'Admin':
        return const Color(0xFFB45309);
      default:
        return const Color(0xFF475467);
    }
  }

  static IconData _statusIcon(String status) {
    switch (status) {
      case 'read':
        return Icons.done_all_rounded;
      case 'delivered':
        return Icons.done_all_rounded;
      case 'failed':
        return Icons.error_outline_rounded;
      default:
        return Icons.done_rounded;
    }
  }

  static Color _statusColor(String status) {
    switch (status) {
      case 'read':
        return const Color(0xFF2563EB);
      case 'delivered':
        return const Color(0xFF64748B);
      case 'failed':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFF64748B);
    }
  }

  static String _timeLabel(DateTime value) {
    final local = value.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}
