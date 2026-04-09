import 'package:flutter/material.dart';

import '../services/meeting_request_api_service.dart';
import '../services/message_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminParentContactPage extends StatefulWidget {
  final StudentRegistryRecord student;

  const AdminParentContactPage({
    super.key,
    required this.student,
  });

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
        '${widget.student.parentName} merhaba, ${widget.student.fullName} icin guncel kurum bilgilendirmesi paylasilmistir.';
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
        title: const Text('Veli Iletisimi', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Veli iletisim merkezi',
            title: widget.student.parentName,
            description: '${widget.student.fullName} ogrencisinin velisi ile kurum ici iletisim ve bilgilendirme akislarini yonetin.',
            colors: const [Color(0xFF0F172A), Color(0xFF14532D)],
            metrics: [
              AdminHeroMetric(label: 'Ogrenci', value: widget.student.fullName),
              AdminHeroMetric(label: 'Kanal', value: _selectedChannel),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Veli Kayit Bilgileri'),
                const SizedBox(height: 12),
                _contactRow(Icons.phone_outlined, widget.student.parentPhone),
                const SizedBox(height: 10),
                _contactRow(Icons.alternate_email_outlined, widget.student.parentEmail.isEmpty ? 'E-posta kayitli degil' : widget.student.parentEmail),
                const SizedBox(height: 10),
                _contactRow(Icons.school_outlined, '${widget.student.className} • ${widget.student.currentSchool}'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Iletisim Akisi'),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedChannel,
                  decoration: const InputDecoration(
                    labelText: 'Iletisim Kanali',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Telefon', child: Text('Telefon')),
                    DropdownMenuItem(value: 'SMS', child: Text('SMS')),
                    DropdownMenuItem(value: 'E-Posta', child: Text('E-Posta')),
                    DropdownMenuItem(value: 'Kurumsal Mesaj', child: Text('Kurumsal Mesaj')),
                  ],
                  onChanged: (value) => setState(() => _selectedChannel = value ?? _selectedChannel),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedTemplate,
                  decoration: const InputDecoration(
                    labelText: 'Hazir Mesaj',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Genel Bilgilendirme', child: Text('Genel Bilgilendirme')),
                    DropdownMenuItem(value: 'Odeme Hatirlatma', child: Text('Odeme Hatirlatma')),
                    DropdownMenuItem(value: 'Gorusme Daveti', child: Text('Gorusme Daveti')),
                    DropdownMenuItem(value: 'Akademik Bilgilendirme', child: Text('Akademik Bilgilendirme')),
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
                const AdminSectionTitle(title: 'Hizli Aksiyonlar'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.tonalIcon(
                      onPressed: () => _showSnack('Telefon gorusmesi icin veli bilgileri hazirlandi.'),
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Ara'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _sendMessage,
                      icon: const Icon(Icons.send_outlined),
                      label: const Text('Mesaji Gonder'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _createMeetingRequest,
                      icon: const Icon(Icons.event_available_outlined),
                      label: const Text('Gorusme Planla'),
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
      case 'Odeme Hatirlatma':
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} icin bekleyen odeme kalemi bulunmaktadir. Uygun oldugunuzda muhasebe birimiyle iletisime gecmenizi rica ederiz.';
      case 'Gorusme Daveti':
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} ogrencimizin son durumunu gorusmek uzere kurumumuzda bir veli gorusmesi planlamak istiyoruz.';
      case 'Akademik Bilgilendirme':
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} icin guncel akademik takip ve ders sureci hakkinda bilgilendirme paylasilmaktadir.';
      default:
        return '${widget.student.parentName} merhaba, ${widget.student.fullName} icin guncel kurum bilgilendirmesi paylasilmistir.';
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
      _showSnack('Mesaj veli iletisim akisina kaydedildi.');
    } catch (error) {
      if (!mounted) return;
      _showSnack('Mesaj gonderilemedi: $error');
    }
  }

  Future<void> _createMeetingRequest() async {
    try {
      await MeetingRequestApiService.instance.createRequest(
        parentName: widget.student.parentName,
        studentName: widget.student.fullName,
        advisor: 'Idari Birim',
        topic: _selectedTemplate,
        slot: 'Ilk uygun zaman',
        onlineMeeting: true,
        note: _messageController.text.trim(),
      );
      if (!mounted) return;
      _showSnack('Gorusme talebi backendde olusturuldu.');
    } catch (error) {
      if (!mounted) return;
      _showSnack('Gorusme talebi olusturulamadi: $error');
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
