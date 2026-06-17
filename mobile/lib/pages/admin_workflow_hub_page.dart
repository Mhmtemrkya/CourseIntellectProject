import 'package:flutter/material.dart';

import '../services/admin_workflow_api_service.dart';

const _statusTr = {
  'Pending': 'İncelemede', 'Approved': 'Onaylandı', 'Rejected': 'Reddedildi',
  'Open': 'Açık', 'InProgress': 'Devam', 'Done': 'Tamamlandı',
};

String _tr(String? s) => _statusTr[s] ?? (s ?? '');

class AdminWorkflowHubPage extends StatefulWidget {
  const AdminWorkflowHubPage({super.key});

  @override
  State<AdminWorkflowHubPage> createState() => _AdminWorkflowHubPageState();
}

class _AdminWorkflowHubPageState extends State<AdminWorkflowHubPage> {
  final _api = AdminWorkflowApiService.instance;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('İdari Yönetim'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Onaylar'),
              Tab(text: 'İzinler'),
              Tab(text: 'Görevler'),
              Tab(text: 'Evrak'),
              Tab(text: 'Denetim'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ApprovalsTab(api: _api),
            _LeavesTab(api: _api),
            _TasksTab(api: _api),
            _DocumentsTab(api: _api),
            _AuditTab(api: _api),
          ],
        ),
      ),
    );
  }
}

void _snack(BuildContext c, String m) =>
    ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

// ---------------- Onaylar ----------------
class _ApprovalsTab extends StatefulWidget {
  final AdminWorkflowApiService api;
  const _ApprovalsTab({required this.api});
  @override
  State<_ApprovalsTab> createState() => _ApprovalsTabState();
}

class _ApprovalsTabState extends State<_ApprovalsTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try { _items = await widget.api.getApprovals(); } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _decide(Map<String, dynamic> it, String status) async {
    try { await widget.api.decideApproval('${it['id']}', status); await _load(); }
    catch (e) { if (mounted) _snack(context, '$e'); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) return const Center(child: Text('Bekleyen onay yok.'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        separatorBuilder: (_, _) =>const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final it = _items[i];
          final pending = it['status'] == 'Pending';
          return Card(child: ListTile(
            title: Text('${it['title']}'),
            subtitle: Text('${it['category']} • ${it['requesterName'] ?? ''} • ${_tr('${it['status']}')}'),
            trailing: pending ? Wrap(spacing: 4, children: [
              IconButton(icon: const Icon(Icons.check_circle, color: Colors.green), onPressed: () => _decide(it, 'Approved')),
              IconButton(icon: const Icon(Icons.cancel, color: Colors.red), onPressed: () => _decide(it, 'Rejected')),
            ]) : null,
          ));
        },
      ),
    );
  }
}

// ---------------- İzinler ----------------
class _LeavesTab extends StatefulWidget {
  final AdminWorkflowApiService api;
  const _LeavesTab({required this.api});
  @override
  State<_LeavesTab> createState() => _LeavesTabState();
}

class _LeavesTabState extends State<_LeavesTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try { _items = await widget.api.getLeaves(); } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _decide(Map<String, dynamic> it, String status) async {
    try { await widget.api.decideLeave('${it['id']}', status); await _load(); }
    catch (e) { if (mounted) _snack(context, '$e'); }
  }

  Future<void> _create() async {
    final result = await showDialog<bool>(context: context, builder: (_) => _LeaveDialog(api: widget.api));
    if (result == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(onPressed: _create, icon: const Icon(Icons.add), label: const Text('İzin')),
      body: _loading ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: _items.isEmpty
              ? ListView(children: const [SizedBox(height: 200), Center(child: Text('İzin talebi yok.'))])
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: _items.length,
                  separatorBuilder: (_, _) =>const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final it = _items[i];
                    final pending = it['status'] == 'Pending';
                    return Card(child: ListTile(
                      title: Text('${it['staffName']} • ${it['leaveType']}'),
                      subtitle: Text('${'${it['startDateUtc']}'.split('T').first} → ${'${it['endDateUtc']}'.split('T').first} • ${it['days']} gün • ${_tr('${it['status']}')}'),
                      trailing: pending ? Wrap(spacing: 4, children: [
                        IconButton(icon: const Icon(Icons.check_circle, color: Colors.green), onPressed: () => _decide(it, 'Approved')),
                        IconButton(icon: const Icon(Icons.cancel, color: Colors.red), onPressed: () => _decide(it, 'Rejected')),
                      ]) : null,
                    ));
                  },
                ),
          ),
    );
  }
}

class _LeaveDialog extends StatefulWidget {
  final AdminWorkflowApiService api;
  const _LeaveDialog({required this.api});
  @override
  State<_LeaveDialog> createState() => _LeaveDialogState();
}

class _LeaveDialogState extends State<_LeaveDialog> {
  final _name = TextEditingController();
  String _type = 'Yıllık';
  DateTime? _start, _end;
  bool _busy = false;

  Future<void> _pick(bool start) async {
    final d = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2024), lastDate: DateTime(2030));
    if (d != null) {
      setState(() {
        if (start) {
          _start = d;
        } else {
          _end = d;
        }
      });
    }
  }

  String _fmt(DateTime? d) => d == null ? 'Seç' : '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _start == null || _end == null) { _snack(context, 'Personel ve tarih zorunlu.'); return; }
    setState(() => _busy = true);
    try {
      await widget.api.createLeave(staffName: _name.text.trim(), leaveType: _type, startDate: _fmt(_start), endDate: _fmt(_end));
      if (mounted) Navigator.pop(context, true);
    } catch (e) { if (mounted) { setState(() => _busy = false); _snack(context, '$e'); } }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Yeni İzin'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Personel adı')),
        DropdownButtonFormField<String>(
          initialValue: _type,
          items: const ['Yıllık', 'Mazeret', 'Hastalık', 'Ücretsiz'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
          onChanged: (v) => setState(() => _type = v ?? 'Yıllık'),
        ),
        Row(children: [
          Expanded(child: TextButton(onPressed: () => _pick(true), child: Text('Başlangıç: ${_fmt(_start)}'))),
          Expanded(child: TextButton(onPressed: () => _pick(false), child: Text('Bitiş: ${_fmt(_end)}'))),
        ]),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
        ElevatedButton(onPressed: _busy ? null : _submit, child: const Text('Oluştur')),
      ],
    );
  }
}

// ---------------- Görevler ----------------
class _TasksTab extends StatefulWidget {
  final AdminWorkflowApiService api;
  const _TasksTab({required this.api});
  @override
  State<_TasksTab> createState() => _TasksTabState();
}

class _TasksTabState extends State<_TasksTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  final _title = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try { _items = await widget.api.getTasks(); } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _add() async {
    if (_title.text.trim().isEmpty) return;
    try { await widget.api.createTask(title: _title.text.trim()); _title.clear(); await _load(); }
    catch (e) { if (mounted) _snack(context, '$e'); }
  }

  Future<void> _status(Map<String, dynamic> it, String s) async {
    try { await widget.api.updateTaskStatus('${it['id']}', s); await _load(); }
    catch (e) { if (mounted) _snack(context, '$e'); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(child: TextField(controller: _title, decoration: const InputDecoration(hintText: 'Yeni görev başlığı', isDense: true))),
          const SizedBox(width: 8),
          FilledButton(onPressed: _add, child: const Text('Ekle')),
        ]),
      ),
      Expanded(child: RefreshIndicator(
        onRefresh: _load,
        child: _items.isEmpty
          ? ListView(children: const [SizedBox(height: 160), Center(child: Text('Görev yok.'))])
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: _items.length,
              separatorBuilder: (_, _) =>const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final it = _items[i];
                final done = it['status'] == 'Done';
                return Card(child: ListTile(
                  title: Text('${it['title']}'),
                  subtitle: Text('${it['assignedToName'] ?? 'Atanmadı'} • ${_tr('${it['status']}')}'),
                  trailing: done ? const Icon(Icons.check_circle, color: Colors.green) : Wrap(spacing: 4, children: [
                    if (it['status'] != 'InProgress') IconButton(icon: const Icon(Icons.play_arrow), onPressed: () => _status(it, 'InProgress')),
                    IconButton(icon: const Icon(Icons.check, color: Colors.green), onPressed: () => _status(it, 'Done')),
                  ]),
                ));
              },
            ),
      )),
    ]);
  }
}

// ---------------- Evrak ----------------
class _DocumentsTab extends StatefulWidget {
  final AdminWorkflowApiService api;
  const _DocumentsTab({required this.api});
  @override
  State<_DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<_DocumentsTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  final _title = TextEditingController();
  final String _category = 'Gelen Evrak';

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try { _items = await widget.api.getDocuments(); } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _add() async {
    if (_title.text.trim().isEmpty) return;
    try {
      await widget.api.createDocument(title: _title.text.trim(), category: _category, direction: 'Incoming');
      _title.clear(); await _load();
    } catch (e) { if (mounted) _snack(context, '$e'); }
  }

  Future<void> _archive(Map<String, dynamic> it) async {
    try { await widget.api.archiveDocument('${it['id']}'); await _load(); }
    catch (e) { if (mounted) _snack(context, '$e'); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Expanded(child: TextField(controller: _title, decoration: const InputDecoration(hintText: 'Evrak başlığı', isDense: true))),
          const SizedBox(width: 8),
          FilledButton(onPressed: _add, child: const Text('Ekle')),
        ]),
      ),
      Expanded(child: RefreshIndicator(
        onRefresh: _load,
        child: _items.isEmpty
          ? ListView(children: const [SizedBox(height: 160), Center(child: Text('Belge yok.'))])
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: _items.length,
              separatorBuilder: (_, _) =>const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final it = _items[i];
                final archived = it['status'] == 'Archived';
                return Card(child: ListTile(
                  title: Text('${it['title']}'),
                  subtitle: Text('${it['category']}${archived ? ' • Arşiv' : ''}'),
                  trailing: archived ? null : IconButton(icon: const Icon(Icons.archive_outlined), onPressed: () => _archive(it)),
                ));
              },
            ),
      )),
    ]);
  }
}

// ---------------- Denetim ----------------
class _AuditTab extends StatefulWidget {
  final AdminWorkflowApiService api;
  const _AuditTab({required this.api});
  @override
  State<_AuditTab> createState() => _AuditTabState();
}

class _AuditTabState extends State<_AuditTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try { _items = await widget.api.getAuditLogs(); } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) return const Center(child: Text('Denetim kaydı yok.'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        separatorBuilder: (_, _) =>const Divider(height: 1),
        itemBuilder: (context, i) {
          final it = _items[i];
          return ListTile(
            dense: true,
            leading: const Icon(Icons.shield_outlined),
            title: Text('${it['action']}'),
            subtitle: Text('${it['detail'] ?? ''}\n${it['actorName'] ?? ''} • ${'${it['createdAtUtc']}'.replaceFirst('T', ' ').split('.').first}'),
            isThreeLine: true,
          );
        },
      ),
    );
  }
}
