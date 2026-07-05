import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/duty_api_service.dart';

const List<String> _trMonths = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

String _fmtDate(DateTime? d) => d == null ? '—' : '${d.day} ${_trMonths[d.month - 1]} ${d.year}';

const Map<String, Color> _typeColors = {
  'Sabah Nöbeti': Color(0xFFF97316),
  'Öğle Arası': Color(0xFF3B82F6),
  'İdari Nöbet': Color(0xFFA855F7),
};
Color _typeColor(String t) => _typeColors[t] ?? const Color(0xFF94A3B8);

(String, Color) _statusInfo(String status) {
  final s = status.toLowerCase();
  if (s.contains('iptal')) return ('İptal Edildi', const Color(0xFFEF4444));
  if (s.contains('tamam')) return ('Tamamlandı', const Color(0xFF22C55E));
  return ('Planlandı', const Color(0xFF3B82F6));
}

class DutiesBoardPage extends StatefulWidget {
  const DutiesBoardPage({super.key});

  @override
  State<DutiesBoardPage> createState() => _DutiesBoardPageState();
}

class _DutiesBoardPageState extends State<DutiesBoardPage> {
  final DutyApiService _api = DutyApiService();
  bool _loading = true;
  String? _error;
  List<DutyRecord> _duties = [];
  List<TeacherDutyLoad> _load = [];

  @override
  void initState() {
    super.initState();
    _load_();
  }

  Future<void> _load_() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final now = DateTime.now();
      final duties = await _api.fetchAllDuties(
        from: DateTime(now.year, now.month, now.day),
        to: DateTime(now.year, now.month, now.day).add(const Duration(days: 30)),
      );
      List<TeacherDutyLoad> load = [];
      try {
        load = await _api.fetchLoad();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _duties = duties;
        _load = load;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _action(Future<void> Function() fn, String msg) async {
    try {
      await fn();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      await _load_();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('İşlem başarısız: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('Tüm Nöbetler'.tr)),
      body: RefreshIndicator(
        onRefresh: _load_,
        child: _loading
            ? const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
                    ),
                  if (_load.isNotEmpty) ...[
                    Text('Öğretmen Yükü (bu ay)'.tr, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _load
                          .map((l) => Chip(
                                label: Text('${l.teacherName} · ${l.count}'),
                                backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
                              ))
                          .toList(),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Text('Nöbet Çizelgesi (30 gün)'.tr, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  if (_duties.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Center(child: Text('Bu aralıkta nöbet yok.'.tr, style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)))),
                    )
                  else
                    ..._duties.map((d) => _dutyCard(theme, d)),
                ],
              ),
      ),
    );
  }

  Widget _dutyCard(ThemeData theme, DutyRecord d) {
    final (label, color) = _statusInfo(d.status);
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.6);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 9, height: 9, decoration: BoxDecoration(color: _typeColor(d.dutyType), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Expanded(child: Text('${d.teacherName} · ${d.dutyType}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
                child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('${_fmtDate(d.dutyDate)} · ${d.location} · ${d.startTime}-${d.endTime}', style: TextStyle(fontSize: 12, color: muted)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _action(() => _api.setStatus(d.id, 'Tamamlandı'), 'Tamamlandı'),
                icon: const Icon(Icons.check_circle_outline, size: 18, color: Color(0xFF22C55E)),
                label: const Text('Tamamla', style: TextStyle(color: Color(0xFF22C55E))),
              ),
              TextButton.icon(
                onPressed: () => _action(() => _api.setStatus(d.id, 'İptal Edildi'), 'İptal edildi'),
                icon: const Icon(Icons.cancel_outlined, size: 18, color: Color(0xFFF59E0B)),
                label: Text('İptal'.tr, style: TextStyle(color: Color(0xFFF59E0B))),
              ),
              TextButton.icon(
                onPressed: () => _action(() => _api.deleteDuty(d.id), 'Silindi'),
                icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)),
                label: const Text('Sil', style: TextStyle(color: Color(0xFFEF4444))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
