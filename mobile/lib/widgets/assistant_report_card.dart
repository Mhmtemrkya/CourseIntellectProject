import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../i18n/app_locale.dart';
import '../services/module_api_client.dart';

String _str(Object? value) => value == null ? '' : '$value';
Map<String, dynamic> _map(Object? value) => value is Map ? value.map((key, item) => MapEntry('$key', item)) : const {};
List<Map<String, dynamic>> _maps(Object? value) => value is List ? value.map(_map).toList() : const [];

/// Asistanın analiz/rapor kartı (masaüstündeki AssistantReportCard ile aynı veri): metrikler,
/// çubuk grafik, tablo, bölümler, notlar ve sunucuda üretilen PDF/Excel. Değerler sunucuda hesaplanır.
class AssistantReportCard extends StatefulWidget {
  const AssistantReportCard({super.key, required this.messageId, required this.data, required this.english});

  final String messageId;
  final Map<String, dynamic> data;
  final bool english;

  @override
  State<AssistantReportCard> createState() => _AssistantReportCardState();
}

class _AssistantReportCardState extends State<AssistantReportCard> {
  static const _brand = Color(0xFF4F46E5);
  /// İndirilen dosya türü (pdf / xlsx); boşsa indirme yok.
  String _busy = '';
  String _error = '';

  String _cell(Object? value) {
    if (value == null || _str(value).isEmpty) return '–';
    if (value is num) {
      final text = value == value.roundToDouble() ? value.toInt().toString() : value.toStringAsFixed(1);
      return widget.english ? text : text.replaceAll('.', ',');
    }
    return _str(value);
  }

  /// PDF ya da Excel dökümünü indirip telefonun uygun uygulamasıyla açar (aynı rapor verisinden).
  Future<void> _open(String kind) async {
    setState(() {
      _busy = kind;
      _error = '';
    });
    try {
      final bytes = await ModuleApiClient.instance.getBytes('/api/assistant/messages/${widget.messageId}/$kind');
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/asistan-rapor-${widget.messageId}.$kind');
      await file.writeAsBytes(bytes);
      final result = await OpenFilex.open(file.path);
      if (!mounted) return;
      setState(() {
        _busy = '';
        if (result.type != ResultType.done) _error = result.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = '';
        _error = '$error';
      });
    }
  }

  Widget _spinner() => const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2));

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 11);
    final metrics = _maps(data['metrics']);
    final columns = _maps(data['columns']);
    final rows = _maps(data['rows']);
    final sections = _maps(data['sections']);
    final notes = data['notes'] is List ? (data['notes'] as List).map(_str).toList() : const <String>[];
    final chart = _map(data['chart']);
    final series = _maps(chart['series']);
    final barKey = series.isEmpty ? '' : _str(series.first['key']);
    final barValues = rows.map((row) => row[barKey]).whereType<num>().toList();
    final maxBar = barValues.isEmpty ? 0 : barValues.reduce(max);
    final showBars = chart['kind'] == 'bar' && barKey.isNotEmpty && rows.length > 1 && maxBar > 0;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_str(data['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
          if (_str(data['subtitle']).isNotEmpty) Text(_str(data['subtitle']), style: hint),
          if (metrics.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: metrics
                  .map((metric) => Container(
                        constraints: const BoxConstraints(minWidth: 100),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(color: Theme.of(context).dividerColor.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_str(metric['label']), style: hint),
                            Text(_str(metric['value']),
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: metric['tone'] == 'warn' ? const Color(0xFFD97706) : metric['tone'] == 'good' ? const Color(0xFF059669) : null,
                                )),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ],
          if (showBars) ...[
            const SizedBox(height: 10),
            for (final row in rows.take(10))
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    SizedBox(width: 96, child: Text(_str(row[_str(chart['x'])]), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11))),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, constraints) => Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            height: 10,
                            width: constraints.maxWidth * ((row[barKey] is num ? row[barKey] as num : 0) / maxBar).clamp(0.02, 1.0),
                            decoration: BoxDecoration(color: _brand, borderRadius: BorderRadius.circular(5)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(_cell(row[barKey]), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
          ],
          if (columns.isNotEmpty && rows.isNotEmpty) ...[
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 30,
                dataRowMinHeight: 28,
                dataRowMaxHeight: 44,
                columnSpacing: 14,
                horizontalMargin: 6,
                headingTextStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                dataTextStyle: TextStyle(fontSize: 11, color: Theme.of(context).textTheme.bodyMedium?.color),
                columns: columns.map((column) => DataColumn(label: Text(_str(column['label'])), numeric: column['align'] == 'right')).toList(),
                rows: rows
                    .take(30)
                    .map((row) => DataRow(cells: columns.map((column) => DataCell(ConstrainedBox(constraints: const BoxConstraints(maxWidth: 220), child: Text(_cell(row[_str(column['key'])]))))).toList()))
                    .toList(),
              ),
            ),
          ],
          for (final section in sections) ...[
            const SizedBox(height: 8),
            Text(_str(section['title']), style: const TextStyle(fontWeight: FontWeight.w700, color: _brand, fontSize: 13)),
            if (section['lines'] is List)
              for (final line in section['lines'] as List) Text('• ${_str(line)}', style: const TextStyle(fontSize: 12)),
          ],
          for (final note in notes) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note, style: hint)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                onPressed: _busy.isNotEmpty ? null : () => _open('pdf'),
                icon: _busy == 'pdf' ? _spinner() : const Icon(Icons.picture_as_pdf_rounded, size: 16),
                label: Text(widget.english ? 'Open PDF' : 'PDF aç'.tr),
              ),
              if (rows.isNotEmpty)
                OutlinedButton.icon(
                  key: const ValueKey('assistant-report-xlsx'),
                  style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                  onPressed: _busy.isNotEmpty ? null : () => _open('xlsx'),
                  icon: _busy == 'xlsx' ? _spinner() : const Icon(Icons.table_view_rounded, size: 16),
                  label: Text(widget.english ? 'Open Excel' : 'Excel aç'.tr),
                ),
              if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Colors.red, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
