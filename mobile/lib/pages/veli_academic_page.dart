import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/parent_request_api_service.dart';

class VeliAcademicPage extends StatefulWidget {
  const VeliAcademicPage({super.key});

  @override
  State<VeliAcademicPage> createState() => _VeliAcademicPageState();
}

class _VeliAcademicPageState extends State<VeliAcademicPage> {
  List<Map<String, dynamic>> _children = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try { _children = await ParentRequestApiService.instance.getChildrenAcademic(); }
    catch (e) { _error = e.toString(); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Akademik Özet'.tr)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _children.isEmpty
                  ? Center(child: Text('Görüntülenecek öğrenci yok.'.tr))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(padding: const EdgeInsets.all(16), children: _children.map(_childCard).toList()),
                    ),
    );
  }

  Widget _metric(String label, String value, {Color? color}) => Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: color)),
        ]),
      );

  Widget _childCard(Map<String, dynamic> child) {
    final trend = (child['netTrend'] as num? ?? 0).toInt();
    final trendColor = trend > 0 ? Colors.green : trend < 0 ? Colors.red : Colors.grey;
    final exams = (child['recentExams'] as List<dynamic>? ?? const []);
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${child['studentName']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          Row(children: [
            _metric('Sınav Ort.', '${child['averageScore']}'),
            _metric('Net Ort.', '${child['averageNet']}'),
            _metric('Devam', '%${child['attendanceRate']}'),
            _metric('Net Trend', '${trend > 0 ? '+' : ''}$trend', color: trendColor),
          ]),
          const Divider(height: 20),
          Text('Son Sınavlar'.tr, style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          if (exams.isEmpty)
            Text('Sınav kaydı yok.'.tr, style: TextStyle(color: Colors.grey, fontSize: 12))
          else
            ...exams.map((raw) {
              final e = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Expanded(child: Text('${e['title'] ?? e['subject']} • ${e['date']}', style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
                  Text('${e['score']} • ${e['net']} net', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              );
            }),
        ]),
      ),
    );
  }
}
