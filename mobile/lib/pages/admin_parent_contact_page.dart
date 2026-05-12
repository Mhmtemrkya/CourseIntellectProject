import 'package:flutter/material.dart';

import '../services/meeting_request_api_service.dart';
import '../services/message_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminParentContactPage extends StatefulWidget {
  final StudentRegistryRecord student;

  const AdminParentContactPage({super.key, required this.student});

  @override
  State<AdminParentContactPage> createState() => _AdminParentContactPageState();
}

class _AdminParentContactPageState extends State<AdminParentContactPage> {
  final TextEditingController _messageController = TextEditingController();
  String _selectedChannel = 'Telefon';
  String _selectedTemplate = 'Genel Bilgilendirme';

  @override
  void initState() {
    super.initState();
    _messageController.text =
        '${widget.student.parentName} merhaba, ${widget.student.fullName} için güncel kurum bilgilendirmesi paylaşılmıştır.';
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Veli İletişimi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Veli iletişim merkezi',
            title: widget.student.parentName,
            description:
                '${widget.student.fullName} öğrencisinin velisi ile kurum içi iletişim ve bilgilendirme akışlarını yönetin.',
            colors: const [Color(0xFF0F172A), Color(0xFF14532D)],
            metrics: [
              AdminHeroMetric(label: 'Öğrenci', value: widget.student.fullName),
              AdminHeroMetric(label: 'Kanal', value: _selectedChannel),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Veli Kayıt Bilgileri'),
                const SizedBox(height: 12),
                _contactRow(Icons.phone_outlined, widget.student.parentPhone),
                const SizedBox(height: 10),
                _contactRow(
                  Icons.alternate_email_outlined,
                  widget.student.parentEmail.isEmpty
                      ? 'E-posta kayıtlı değil'
                      : widget.student.parentEmail,
                ),
                const SizedBox(height: 10),
                _contactRow(
                  Icons.school_outlined,
                  '${widget.student.className} • ${widget.student.currentSchool}',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'İletişim Akışı'),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedChannel,
                  decoration: const InputDecoration(
                    labelText: 'İletişim Kanali',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Telefon', child: Text('Telefon')),
                    DropdownMenuItem(value: 'SMS', child: Text('SMS')),
                    DropdownMenuItem(value: 'E-Posta', child: Text('E-Posta')),
                    DropdownMenuItem(
                      value: 'Kurumsal Mesaj',
                      child: Text('Kurumsal Mesaj'),
                    ),
                  ],
                  onChanged: (value) => setState(
                    () => _selectedChannel = value ?? _selectedChannel,
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedTemplate,
                  decoration: const InputDecoration(
                    labelText: 'Hazır Mesaj',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'Genel Bilgilendirme',
                      child: Text('Genel Bilgilendirme'),
                    ),
                    DropdownMenuItem(
                      value: 'Ödeme Hatırlatma',
                      child: Text('Ödeme Hatırlatma'),
                    ),
                    DropdownMenuItem(
                      value: 'Görüşme Daveti',
                      child: Text('Görüşme Daveti'),
                    ),
                    DropdownMenuItem(
                      value: 'Akademik Bilgilendirme',
                      child: Text('Akademik Bilgilendirme'),
                    ),
                  ],
                  onChanged: (value) {
                    final template = value ?? _selectedTemplate;
                    setState(() {
                      _selectedTemplate = template;
                      _messageController.text = _templateMessage(template);
                    });
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _messageController,
                  maxLines: 6,
                  decoration: const InputDecoration(
                    labelText: 'Mesaj Icerigi',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Hızlı Aksiyonlar'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.tonalIcon(
                      onPressed: () => _showSnack(
                        'Telefon görüşmesi için veli bilgileri hazırlandi.',
                      ),
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Ara'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _sendMessage,
                      icon: const Icon(Icons.send_outlined),
                      label: const Text('Mesaji Gönder'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _createMeetingRequest,
                      icon: const Icon(Icons.event_available_outlined),
                      label: const Text('Görüşme Planla'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _contactRow(IconData icon, String value) {
    return Row(
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(value)),
      ],
    );
  }

  String _templateMessage(String template) {
    switch (template) {
      case 'Ödeme Hatırlatma':
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} için bekleyen ödeme kalemi bulunmaktadır. Uygün olduğunuzda muhasebe birimiyle iletişime geçmenizi rica ederiz.';
      case 'Görüşme Daveti':
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} öğrencimizin son durumunu görüşmek üzere kurumumuzda bir veli görüşmesi planlamak istiyoruz.';
      case 'Akademik Bilgilendirme':
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} için güncel akademik takip ve ders süreci hakkında bilgilendirme paylaşılmaktadır.';
      default:
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} için güncel kurum bilgilendirmesi paylaşılmıştır.';
    }
  }

  Future<void> _sendMessage() async {
    try {
      final thread = await MessageApiService.instance.createOrGetThread(
        contactName: widget.student.parentName,
        contactRole: 'Parent',
      );
      await MessageApiService.instance.sendMessage(
        threadId: thread.id,
        text: _messageController.text.trim(),
      );
      if (!mounted) return;
      _showSnack('Mesaj veli iletişim akışına kaydedildi.');
    } catch (error) {
      if (!mounted) return;
      _showSnack('Mesaj gönderilemedi: $error');
    }
  }

  Future<void> _createMeetingRequest() async {
    try {
      await MeetingRequestApiService.instance.createRequest(
        parentName: widget.student.parentName,
        studentName: widget.student.fullName,
        advisor: 'İdari Birim',
        topic: _selectedTemplate,
        slot: 'İlk uygun zaman',
        onlineMeeting: true,
        note: _messageController.text.trim(),
      );
      if (!mounted) return;
      _showSnack('Görüşme talebi oluşturuldu.');
    } catch (error) {
      if (!mounted) return;
      _showSnack('Görüşme talebi oluşturulamadı: $error');
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }
}
