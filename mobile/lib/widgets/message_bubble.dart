import 'dart:io';

import 'package:flutter/material.dart';

import '../services/message_api_service.dart';

class MessageBubble extends StatelessWidget {
  final MessageItemRecord message;
  final bool isMe;
  final String timeLabel;
  final ValueChanged<MessageAttachmentRecord> onAttachmentTap;
  final VoidCallback onDeleteForMe;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.timeLabel,
    required this.onAttachmentTap,
    required this.onDeleteForMe,
  });

  @override
  Widget build(BuildContext context) {
    final bubbleColor = isMe ? const Color(0xFF0F766E) : Colors.white;
    final textColor = isMe ? Colors.white : const Color(0xFF0F172A);
    final statusColor = _statusColor(message.status, isMe);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: isMe
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFFE2E8F0),
              child: Text(
                message.senderName.trim().isEmpty
                    ? '?'
                    : message.senderName.trim()[0].toUpperCase(),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ] else
            const SizedBox(width: 44),
          Flexible(
            child: Align(
              alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onLongPress: onDeleteForMe,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 320),
                  margin: EdgeInsets.only(
                    left: isMe ? 48 : 0,
                    right: isMe ? 0 : 48,
                  ),
                  padding: const EdgeInsets.fromLTRB(14, 10, 12, 8),
                  decoration: BoxDecoration(
                    color: bubbleColor,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(20),
                      topRight: const Radius.circular(20),
                      bottomLeft: Radius.circular(isMe ? 20 : 6),
                      bottomRight: Radius.circular(isMe ? 6 : 20),
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x12000000),
                        blurRadius: 12,
                        offset: Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!isMe)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            message.senderName,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ),
                      if (message.text.trim().isNotEmpty)
                        Padding(
                          padding: EdgeInsets.only(
                            bottom: message.attachments.isEmpty ? 2 : 10,
                          ),
                          child: Text(
                            message.text,
                            style: TextStyle(
                              color: textColor,
                              fontSize: 15.5,
                              height: 1.35,
                            ),
                          ),
                        ),
                      if (message.attachments.isNotEmpty)
                        ...message.attachments.map(
                          (attachment) => _AttachmentTile(
                            attachment: attachment,
                            onTap: () => onAttachmentTap(attachment),
                          ),
                        ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text(
                            timeLabel,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: isMe
                                  ? Colors.white70
                                  : const Color(0xFF64748B),
                            ),
                          ),
                          if (isMe) ...[
                            const SizedBox(width: 6),
                            Icon(
                              _statusIcon(message.status),
                              size: 16,
                              color: statusColor,
                            ),
                          ],
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: onDeleteForMe,
                            borderRadius: BorderRadius.circular(999),
                            child: Padding(
                              padding: const EdgeInsets.all(3),
                              child: Icon(
                                Icons.delete_outline_rounded,
                                size: 16,
                                color: isMe
                                    ? Colors.white70
                                    : const Color(0xFF94A3B8),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _statusIcon(String status) {
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

  Color _statusColor(String status, bool isOwnMessage) {
    switch (status) {
      case 'read':
        return const Color(0xFF38BDF8);
      case 'delivered':
        return isOwnMessage ? const Color(0xFFE2E8F0) : const Color(0xFF94A3B8);
      case 'failed':
        return const Color(0xFFFCA5A5);
      default:
        return isOwnMessage ? const Color(0xFFF8FAFC) : const Color(0xFF94A3B8);
    }
  }
}

class _AttachmentTile extends StatelessWidget {
  final MessageAttachmentRecord attachment;
  final VoidCallback onTap;

  const _AttachmentTile({required this.attachment, required this.onTap});

  @override
  Widget build(BuildContext context) {
    if (attachment.isImage) {
      final localPath = attachment.localFilePath;
      final localFile = localPath == null || localPath.isEmpty
          ? null
          : File(localPath);
      final hasLocalImage = localFile != null && localFile.existsSync();

      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: GestureDetector(
          onTap: onTap,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: hasLocalImage
                  ? Image.file(
                      localFile,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    )
                  : Image.network(
                      attachment.absoluteUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) return child;
                        return Container(
                          height: 120,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        return _fileTile();
                      },
                    ),
            ),
          ),
        ),
      );
    }

    return _fileTile();
  }

  Widget _fileTile() {
    final type = attachment.fileType.toLowerCase();
    final icon = switch (type) {
      'image' || String() when type.startsWith('image/') => Icons.image_rounded,
      'video' ||
      String() when type.startsWith('video/') => Icons.videocam_rounded,
      'audio' || String() when type.startsWith('audio/') => Icons.mic_rounded,
      'pdf' || 'application/pdf' => Icons.picture_as_pdf_rounded,
      _ => Icons.insert_drive_file_rounded,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0x14000000)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: const Color(0xFF0369A1)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      attachment.originalFileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      attachment.fileType.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.arrow_outward_rounded,
                size: 18,
                color: Color(0xFF64748B),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
