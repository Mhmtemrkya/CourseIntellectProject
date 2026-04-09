import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';

import '../services/content_api_service.dart';
import '../widgets/app_header.dart';

class VeliExcuseRequestPage extends StatefulWidget {
  const VeliExcuseRequestPage({super.key});

  @override
  State<VeliExcuseRequestPage> createState() => _VeliExcuseRequestPageState();
}

class _VeliExcuseRequestPageState extends State<VeliExcuseRequestPage> {
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _noteController = TextEditingController(
    text: 'Öğrencinin devamsızlık nedeni ve dönüş planı aşağıda paylaşılmıştır.',
  );

  String _selectedType = 'Sağlık';
  String _selectedDate = '14 Mart 2026';
  bool _documentAttached = false;
  bool _uploadingAttachment = false;
  String _attachmentLabel = '';

  final List<String> _types = const [
    'Sağlık',
    'Ailevi durum',
    'Resmi işlem',
    'Ulaşım sorunu',
  ];

  final List<String> _dates = const [
    '14 Mart 2026',
    '15 Mart 2026',
    '16 Mart 2026',
    '17 Mart 2026',
  ];

  @override
  void dispose() {
    _reasonController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Mazeret Bildirimi'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _heroCard(context),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Bildirim tipi',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _types
                        .map(
                          (type) => ChoiceChip(
                            label: Text(type),
                            selected: _selectedType == type,
                            onSelected: (_) {
                              setState(() {
                                _selectedType = type;
                              });
                            },
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedDate,
                    decoration: const InputDecoration(
                      labelText: 'Tarih',
                      border: OutlineInputBorder(),
                    ),
                    items: _dates
                        .map(
                          (date) => DropdownMenuItem<String>(
                            value: date,
                            child: Text(date),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedDate = value;
                      });
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Açıklama',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _reasonController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Mazeret nedenini kısa ve net şekilde yazın',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _noteController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Okul notu',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Belge ve teslim bilgisi',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.attach_file_rounded, color: Color(0xFF4F46E5)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _attachmentLabel.isEmpty ? 'PDF, görsel veya video ekleyebilirsiniz.' : _attachmentLabel,
                          ),
                        ),
                        TextButton.icon(
                          onPressed: _uploadingAttachment ? null : _pickAttachment,
                          icon: Icon(_uploadingAttachment ? Icons.hourglass_top_rounded : Icons.upload_file_rounded),
                          label: Text(_uploadingAttachment ? 'Yükleniyor' : 'Dosya Seç'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Bildirim özeti',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _summaryLine('Tür', _selectedType),
                  _summaryLine('Tarih', _selectedDate),
                  _summaryLine('Belge', _documentAttached ? 'Eklendi' : 'Yok'),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _submitRequest,
                      icon: const Icon(Icons.send_rounded),
                      label: const Text('Bildirimi Gönder'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _heroCard(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E293B), Color(0xFFB45309)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              'Resmi bildirim akışı',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Mazeret bildirimini düzenli ve eksiksiz iletin',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Tarih, neden ve not alanlarını tamamlayın. Kayıt okul yönetimi ve ilgili öğretmene aynı akışta iletilir.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.86),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  Widget _surface(BuildContext context, {required Widget child}) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: theme.brightness == Brightness.dark ? 0.22 : 0.06),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }

  void _submitRequest() {
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) {
        Future<void>.delayed(const Duration(milliseconds: 2200), () {
          if (dialogContext.mounted) {
            Navigator.of(dialogContext).pop();
          }
        });

        return Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 320),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Theme.of(dialogContext).cardColor,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.14),
                    blurRadius: 28,
                    offset: const Offset(0, 16),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFEDD5),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Icon(
                      Icons.mark_email_read_rounded,
                      color: Color(0xFFB45309),
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Bildirim gönderildi',
                    style: Theme.of(dialogContext).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Mazeret kaydı okul yönetimine ve ilgili öğretmene iletildi.',
                    style: Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(
                          height: 1.4,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Theme.of(dialogContext)
                          .colorScheme
                          .surfaceContainerHighest
                          .withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      _documentAttached && _attachmentLabel.isNotEmpty ? '$_selectedDate • $_attachmentLabel' : _selectedDate,
                      style: Theme.of(dialogContext).textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickAttachment() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'mp4', 'mov', 'doc', 'docx'],
      withData: true,
    );
    final file = result?.files.firstOrNull;
    if (file == null) return;

    setState(() {
      _uploadingAttachment = true;
    });

    try {
      await ContentApiService.instance.uploadContentAsset(
        file: file,
        folder: 'excuse-documents',
      );
      if (!mounted) return;
      final ext = (file.extension ?? '').toLowerCase();
      final label = file.extension == 'pdf'
          ? 'PDF eklendi'
          : ['jpg', 'jpeg', 'png'].contains(ext)
              ? 'Görsel eklendi'
              : ['mp4', 'mov'].contains(ext)
                  ? 'Video eklendi'
                  : 'Belge eklendi';
      setState(() {
        _documentAttached = true;
        _attachmentLabel = label;
      });
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAttachment = false;
        });
      }
    }
  }
}
