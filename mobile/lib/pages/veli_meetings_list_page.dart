import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/auth_session_store.dart';
import '../services/meeting_request_api_service.dart';

class VeliMeetingsListPage extends StatefulWidget {
  const VeliMeetingsListPage({super.key});

  @override
  State<VeliMeetingsListPage> createState() => _VeliMeetingsListPageState();
}

class _VeliMeetingsListPageState extends State<VeliMeetingsListPage> {
  List<MeetingRequestApiRecord> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final session = await AuthSessionStore.instance.load();
      _items = await MeetingRequestApiService.instance.fetchRequests(parentName: session?.fullName);
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _join(String link) async {
    final uri = Uri.tryParse(link);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Görüşmelerim')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _items.isEmpty
                  ? const Center(child: Text('Görüşme talebiniz yok.'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final m = _items[i];
                          final canJoin = m.onlineMeeting && m.meetingLink.isNotEmpty;
                          return Card(child: ListTile(
                            title: Text('${m.advisor} • ${m.topic}'),
                            subtitle: Text('${m.studentName} • ${m.slot} • ${m.onlineMeeting ? 'Online' : 'Yüz yüze'} • ${m.status}'),
                            trailing: canJoin
                                ? FilledButton.icon(
                                    onPressed: () => _join(m.meetingLink),
                                    icon: const Icon(Icons.videocam, size: 16),
                                    label: const Text('Katıl'),
                                  )
                                : null,
                          ));
                        },
                      ),
                    ),
    );
  }
}
