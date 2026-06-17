import 'package:flutter/material.dart';

import '../services/parent_request_api_service.dart';

const _types = ['Erken Çıkış', 'İzin', 'Gezi Onamı', 'KVKK / Fotoğraf Onamı', 'Kayıt Yenileme', 'Diğer'];

class VeliRequestsPage extends StatefulWidget {
  const VeliRequestsPage({super.key});

  @override
  State<VeliRequestsPage> createState() => _VeliRequestsPageState();
}

class _VeliRequestsPageState extends State<VeliRequestsPage> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try { _items = await ParentRequestApiService.instance.getMyRequests(); }
    catch (e) { _error = e.toString(); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  String _statusLabel(String s) => switch (s) {
        'Approved' => 'Onaylandı',
        'Rejected' => 'Reddedildi',
        _ => 'İncelemede',
      };
  Color _statusColor(String s) => switch (s) {
        'Approved' => Colors.green,
        'Rejected' => Colors.red,
        _ => Colors.orange,
      };

  Future<void> _newRequest() async {
    final created = await showDialog<bool>(context: context, builder: (_) => const _RequestDialog());
    if (created == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Taleplerim')),
      floatingActionButton: FloatingActionButton.extended(onPressed: _newRequest, icon: const Icon(Icons.add), label: const Text('Talep')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _items.isEmpty
                      ? ListView(children: const [SizedBox(height: 200), Center(child: Text('Henüz talebiniz yok.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _items.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final it = _items[i];
                            final st = '${it['status']}';
                            return Card(child: ListTile(
                              title: Text('${it['title']}'),
                              subtitle: Text('${it['category']}${(it['description'] ?? '').toString().isNotEmpty ? ' • ${it['description']}' : ''}'),
                              trailing: Text(_statusLabel(st), style: TextStyle(color: _statusColor(st), fontWeight: FontWeight.w700)),
                            ));
                          },
                        ),
                ),
    );
  }
}

class _RequestDialog extends StatefulWidget {
  const _RequestDialog();
  @override
  State<_RequestDialog> createState() => _RequestDialogState();
}

class _RequestDialogState extends State<_RequestDialog> {
  String _type = _types.first;
  final _child = TextEditingController();
  final _desc = TextEditingController();
  bool _busy = false;

  Future<void> _submit() async {
    if (_child.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Öğrenci adı zorunlu.')));
      return;
    }
    setState(() => _busy = true);
    try {
      await ParentRequestApiService.instance.createRequest(
        category: _type,
        title: '$_type • ${_child.text.trim()}',
        description: _desc.text.trim().isEmpty ? null : _desc.text.trim(),
        priority: _type == 'Erken Çıkış' ? 'Yüksek' : 'Normal',
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) { setState(() => _busy = false); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'))); }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Yeni Talep'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(
          initialValue: _type,
          items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
          onChanged: (v) => setState(() => _type = v ?? _types.first),
        ),
        TextField(controller: _child, decoration: const InputDecoration(labelText: 'Öğrenci adı')),
        TextField(controller: _desc, decoration: const InputDecoration(labelText: 'Açıklama')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
        ElevatedButton(onPressed: _busy ? null : _submit, child: const Text('Gönder')),
      ],
    );
  }
}
