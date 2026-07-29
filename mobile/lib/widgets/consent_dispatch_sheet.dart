import 'dart:io';

import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/consent_api_service.dart';

const consentLastStationKey = 'consent-last-station';

/// Formu imza tabletine gönderme bölmesi.
///
/// Onam Merkezi ve Sözleşme & Formlar ekranları AYNI bölmeyi kullanır: gönderim
/// kuralları (not kaydedilir, tablet adı boş geçilemez, son kullanılan tablet
/// hatırlanır) tek yerde durur.
class ConsentDispatchSheet extends StatefulWidget {
  final Map<String, dynamic> form;
  final List<Map<String, dynamic>> stations;

  const ConsentDispatchSheet({
    super.key,
    required this.form,
    required this.stations,
  });

  @override
  State<ConsentDispatchSheet> createState() => _ConsentDispatchSheetState();
}

class _ConsentDispatchSheetState extends State<ConsentDispatchSheet> {
  final _notesController = TextEditingController();
  final _stationController = TextEditingController();
  bool _sending = false;
  bool _openingDocument = false;

  bool get _isPdf => widget.form['sourceKind']?.toString() == 'Pdf';

  @override
  void initState() {
    super.initState();
    _notesController.text = widget.form['staffNotes']?.toString() ?? '';
    _restoreLastStation();
  }

  Future<void> _restoreLastStation() async {
    final prefs = await SharedPreferences.getInstance();
    final last = prefs.getString(consentLastStationKey) ?? '';
    if (mounted && last.isNotEmpty) _stationController.text = last;
  }

  @override
  void dispose() {
    _notesController.dispose();
    _stationController.dispose();
    super.dispose();
  }

  void _snack(Object error) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error.toString().replaceFirst('Bad state: ', ''))),
    );
  }

  /// Personel de göndermeden önce belgeyi görebilmeli.
  Future<void> _openDocument() async {
    setState(() => _openingDocument = true);
    try {
      final id = widget.form['id'].toString();
      final bytes = await ConsentApiService.instance.formDocument(id);
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/onam-onizleme-$id.pdf');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } catch (error) {
      _snack(error);
    } finally {
      if (mounted) setState(() => _openingDocument = false);
    }
  }

  Future<void> _dispatch() async {
    final station = _stationController.text.trim();
    if (station.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Formun gideceği tabletin adını yazın veya seçin.'),
        ),
      );
      return;
    }
    setState(() => _sending = true);
    try {
      final id = widget.form['id'].toString();
      await ConsentApiService.instance.updateForm(id, _notesController.text.trim());
      await ConsentApiService.instance.dispatchToStation(id, station);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(consentLastStationKey, station);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() => _sending = false);
        _snack(error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final checkItems =
        (widget.form['checkItems'] as List?)?.map((e) => e.toString()).toList() ??
            const <String>[];

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.form['title']?.toString() ?? '',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            if (_isPdf)
              // Yüklenmiş belgede metin kutusu yerine belgenin kendisi açılır.
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: theme.dividerColor),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.picture_as_pdf_outlined),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${widget.form['documentFileName'] ?? 'Yüklenen belge'} · '
                        '${widget.form['documentPageCount'] ?? 0} sayfa',
                      ),
                    ),
                    TextButton(
                      onPressed: _openingDocument ? null : _openDocument,
                      child: Text(_openingDocument ? 'Açılıyor…' : 'Aç'),
                    ),
                  ],
                ),
              )
            else
              Container(
                constraints: const BoxConstraints(maxHeight: 200),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: theme.dividerColor),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: SingleChildScrollView(
                  child: Text(widget.form['body']?.toString() ?? ''),
                ),
              ),
            if (checkItems.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('TABLETTE İŞARETLENECEK MADDELER', style: theme.textTheme.labelSmall),
              const SizedBox(height: 4),
              ...checkItems.map((item) => Text('☐  $item')),
            ],
            const SizedBox(height: 16),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Uygulama notu (isteğe bağlı)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _stationController,
              decoration: const InputDecoration(
                labelText: 'Tablet adı',
                hintText: 'Örn. Ofis 1',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            if (widget.stations.isEmpty)
              Text(
                'Henüz kayıtlı tablet yok. Tablette İmza İstasyonu ekranını açıp bir ad verin.',
                style: theme.textTheme.bodySmall,
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: widget.stations.map((station) {
                  final online = station['online'] == true;
                  return ActionChip(
                    avatar: Icon(
                      Icons.circle,
                      size: 10,
                      color: online ? Colors.green : Colors.grey,
                    ),
                    label: Text(
                      '${station['name']} ${online ? '· çevrimiçi' : '· çevrimdışı'}',
                    ),
                    onPressed: () => _stationController.text = station['name'].toString(),
                  );
                }).toList(),
              ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _sending ? null : _dispatch,
                child: Text(_sending ? 'Gönderiliyor...' : 'Tablete Aktar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
