import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';

import '../services/message_api_service.dart';

typedef MessageComposerSend =
    Future<void> Function(
      String text,
      List<PendingMessageAttachment> attachments,
    );

class PendingMessageAttachment {
  final File file;
  final String fileName;
  final String fileType;

  const PendingMessageAttachment({
    required this.file,
    required this.fileName,
    required this.fileType,
  });

  MessageAttachmentRecord toLocalRecord() {
    return MessageAttachmentRecord(
      fileName: fileName,
      originalFileName: fileName,
      fileUrl: '',
      fileType: fileType,
      size: file.existsSync() ? file.lengthSync() : 0,
      localFilePath: file.path,
    );
  }
}

class MessageComposer extends StatefulWidget {
  final MessageComposerSend onSend;
  final ValueChanged<String>? onTypingChanged;

  const MessageComposer({
    super.key,
    required this.onSend,
    this.onTypingChanged,
  });

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  final TextEditingController _controller = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  final List<PendingMessageAttachment> _pendingAttachments = [];
  bool _sending = false;

  @override
  void dispose() {
    widget.onTypingChanged?.call('');
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          border: const Border(top: BorderSide(color: Color(0x14000000))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_pendingAttachments.isNotEmpty)
              SizedBox(
                height: 78,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _pendingAttachments.length,
                  separatorBuilder: (_, index) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    final item = _pendingAttachments[index];
                    return _AttachmentChip(
                      item: item,
                      onRemove: () =>
                          setState(() => _pendingAttachments.removeAt(index)),
                    );
                  },
                ),
              ),
            if (_pendingAttachments.isNotEmpty) const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: _sending ? null : _pickFile,
                  icon: const Icon(Icons.attach_file_rounded),
                ),
                IconButton(
                  onPressed: _sending ? null : _pickImage,
                  icon: const Icon(Icons.photo_camera_back_rounded),
                ),
                Expanded(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 120),
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 5,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      textCapitalization: TextCapitalization.sentences,
                      onChanged: widget.onTypingChanged,
                      decoration: InputDecoration(
                        hintText: 'Mesaj yaz...',
                        filled: true,
                        fillColor: const Color(0xFFF5F7FB),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(26),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _sending ? null : _handleSend,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF128C7E),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(84, 48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Gönder',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage() async {
    final image = await _picker.pickImage(source: ImageSource.gallery);
    if (image == null) return;

    final file = File(image.path);
    final mimeType =
        image.mimeType ?? lookupMimeType(image.path) ?? 'image/jpeg';
    setState(() {
      _pendingAttachments.add(
        PendingMessageAttachment(
          file: file,
          fileName: _imageFileName(image, mimeType),
          fileType: mimeType,
        ),
      );
    });
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    if (result == null || result.files.single.path == null) return;

    final file = result.files.single;
    setState(() {
      _pendingAttachments.add(
        PendingMessageAttachment(
          file: File(file.path!),
          fileName: file.name,
          fileType: _resolveFileType(file.extension),
        ),
      );
    });
  }

  Future<void> _handleSend() async {
    final trimmed = _controller.text.trim();
    if (trimmed.isEmpty && _pendingAttachments.isEmpty) {
      return;
    }

    setState(() => _sending = true);
    try {
      final attachments = List<PendingMessageAttachment>.of(
        _pendingAttachments,
      );
      await widget.onSend(trimmed, attachments);
      _controller.clear();
      widget.onTypingChanged?.call('');
      setState(() => _pendingAttachments.clear());
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  String _resolveFileType(String? extension) {
    final value = (extension ?? '').toLowerCase();
    if (value == 'jpg' || value == 'jpeg') return 'image/jpeg';
    if (['png', 'gif', 'webp', 'heic'].contains(value)) return 'image/$value';
    if (['mp3', 'wav', 'm4a'].contains(value)) return 'audio';
    if (['mp4', 'mov', 'webm'].contains(value)) return 'video';
    if (value == 'pdf') return 'pdf';
    return 'file';
  }

  String _imageFileName(XFile image, String mimeType) {
    final name = image.name.trim();
    if (_hasFileExtension(name)) return name;

    final pathName = image.path.split(Platform.pathSeparator).last.trim();
    if (_hasFileExtension(pathName)) return pathName;

    final extension = _extensionForMime(mimeType);
    final fallbackName = name.isEmpty ? 'image' : name;
    return '$fallbackName.$extension';
  }

  bool _hasFileExtension(String value) {
    final lastSegment = value.split(Platform.pathSeparator).last;
    final dotIndex = lastSegment.lastIndexOf('.');
    return dotIndex > 0 && dotIndex < lastSegment.length - 1;
  }

  String _extensionForMime(String mimeType) {
    switch (mimeType.toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      case 'image/heic':
      case 'image/heif':
        return 'heic';
      default:
        return 'jpg';
    }
  }
}

class _AttachmentChip extends StatelessWidget {
  final PendingMessageAttachment item;
  final VoidCallback onRemove;

  const _AttachmentChip({required this.item, required this.onRemove});

  String _attachmentLabel() {
    if (_isImage) return 'Görsel eklendi';
    switch (item.fileType) {
      case 'pdf':
      case 'application/pdf':
        return 'PDF eklendi';
      case 'video':
        return 'Video eklendi';
      case 'audio':
        return 'Ses dosyası eklendi';
      default:
        return 'Ek dosya eklendi';
    }
  }

  String _attachmentTag() {
    if (_isImage) return 'IMG';
    switch (item.fileType) {
      case 'pdf':
      case 'application/pdf':
        return 'PDF';
      case 'video':
        return 'VID';
      case 'audio':
        return 'SES';
      default:
        return 'DOS';
    }
  }

  bool get _isImage {
    final type = item.fileType.toLowerCase();
    return type == 'image' || type.startsWith('image/');
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: 176,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F7FB),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFE6FFFA),
                  borderRadius: BorderRadius.circular(12),
                ),
                clipBehavior: Clip.antiAlias,
                child: _isImage
                    ? Image.file(item.file, fit: BoxFit.cover)
                    : const Icon(
                        Icons.insert_drive_file_rounded,
                        color: Color(0xFF128C7E),
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _attachmentLabel(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _attachmentTag(),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF128C7E),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Positioned(
          right: 0,
          top: 0,
          child: IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.close_rounded, size: 18),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white,
              minimumSize: const Size(28, 28),
              padding: EdgeInsets.zero,
            ),
          ),
        ),
      ],
    );
  }
}
