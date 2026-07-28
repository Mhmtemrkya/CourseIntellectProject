import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/consent_api_service.dart';
import '../widgets/consent_signature_pad.dart';

const _stationStorageKey = 'consent-station-name';
const _pollInterval = Duration(milliseconds: 2500);
const _thanksDuration = Duration(seconds: 6);

const _signerHint = {
  'Student': 'Öğrenci / kursiyer imzası',
  'Parent': 'Veli veya yasal temsilci imzası',
  'StudentOrParent':
      '18 yaş altındaysa veli, değilse öğrencinin kendisi imzalar',
};

/// Tablet İmza İstasyonu.
///
/// Tablet, sisteme giriş yapmış İKİNCİ BİR EKRANDIR; fiziksel eşleştirme
/// (QR/Bluetooth/kod) yoktur — eşleşme isimle olur ve iletişim sunucu üzerinden
/// yürür. Ad cihazda kalıcı saklanır; personel bilgisayarda bu adı seçer.
///
/// Soket yerine kısa yoklama kullanılır: kurum içi birkaç tablet için kalıcı
/// soket altyapısı gereksiz karmaşıklıktır; kısa yoklama hem anında hissettirir
/// hem ağ kesintisinden kendiliğinden toparlar.
///
/// Tabletin bu ekranda kalması için cihazın rehberli erişim / kiosk modu önerilir.
class ConsentStationPage extends StatefulWidget {
  const ConsentStationPage({super.key});

  @override
  State<ConsentStationPage> createState() => _ConsentStationPageState();
}

class _ConsentStationPageState extends State<ConsentStationPage> {
  final _padKey = GlobalKey<ConsentSignaturePadState>();
  final _signerNameController = TextEditingController();
  final _signerRelationController = TextEditingController();

  Timer? _timer;
  String _stationName = '';
  bool _loadingName = true;
  bool _renaming = false;
  bool _connected = false;
  bool _submitting = false;
  bool _thanks = false;
  bool _hasInk = false;
  String _error = '';

  Map<String, dynamic>? _form;
  String? _formId;
  final Set<int> _checked = {};

  @override
  void initState() {
    super.initState();
    _restoreName();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _signerNameController.dispose();
    _signerRelationController.dispose();
    super.dispose();
  }

  Future<void> _restoreName() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_stationStorageKey) ?? '';
    if (!mounted) return;
    setState(() {
      _stationName = stored;
      _renaming = stored.isEmpty;
      _loadingName = false;
    });
    if (stored.isNotEmpty) _startPolling();
  }

  void _startPolling() {
    _timer?.cancel();
    _poll();
    _timer = Timer.periodic(_pollInterval, (_) => _poll());
  }

  Future<void> _poll() async {
    if (_stationName.trim().isEmpty || _renaming || _submitting) return;
    try {
      final next = await ConsentApiService.instance.pollStation(_stationName.trim());
      if (!mounted) return;
      setState(() => _connected = true);

      if (next == null) {
        // Personel gönderimi geri aldıysa bekleme hâline dön.
        if (_formId != null) setState(_resetForm);
        return;
      }

      // AYNI form tekrar yoklandığında ekran SIFIRLANMAZ — kullanıcı o sırada
      // imza atıyor olabilir; işaretlediği maddeler ve çizdiği imza durmalı.
      if (_formId == next['id']?.toString()) return;

      setState(() {
        _resetForm();
        _form = next;
        _formId = next['id']?.toString();
        _signerNameController.text = next['studentName']?.toString() ?? '';
      });
    } catch (_) {
      if (mounted) setState(() => _connected = false);
    }
  }

  /// setState içinden çağrılır.
  void _resetForm() {
    _form = null;
    _formId = null;
    _checked.clear();
    _hasInk = false;
    _error = '';
    _signerNameController.clear();
    _signerRelationController.clear();
    _padKey.currentState?.clear();
  }

  List<String> get _checkItems =>
      (_form?['checkItems'] as List?)?.map((e) => e.toString()).toList() ?? const [];

  bool get _requiresSignature => _form?['requiresSignature'] == true;
  bool get _allChecked =>
      _checkItems.isEmpty || _checked.length == _checkItems.length;
  bool get _signatureReady => !_requiresSignature || _hasInk;
  bool get _canSubmit => _form != null && _allChecked && _signatureReady && !_submitting;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _submitting = true;
      _error = '';
    });
    try {
      final signature = await _padKey.currentState?.toDataUrl();
      await ConsentApiService.instance.sign(
        _form!['sessionToken'].toString(),
        checkedItems: _checked.toList()..sort(),
        signatureImage: signature,
        signerName: _signerNameController.text.trim().isEmpty
            ? _form!['studentName']?.toString()
            : _signerNameController.text.trim(),
        signerRelation: _signerRelationController.text.trim().isEmpty
            ? null
            : _signerRelationController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _resetForm();
        _thanks = true;
      });
      Future.delayed(_thanksDuration, () {
        if (mounted) setState(() => _thanks = false);
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Bad state: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _startRename() async {
    // Ekranda imza bekleyen form varken onay sor — yarım imza gitmesin.
    if (_form != null) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Tablet adı değiştirilsin mi?'),
          content: const Text(
            'Ekranda imza bekleyen bir form var. Adı değiştirirseniz bu form kapanır.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Devam et'),
            ),
          ],
        ),
      );
      if (proceed != true) return;
    }
    if (mounted) setState(() => _renaming = true);
  }

  Future<void> _applyName(String name) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_stationStorageKey, trimmed);
    if (!mounted) return;
    setState(() {
      _stationName = trimmed;
      _renaming = false;
      _resetForm();
    });
    _startPolling();
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingName) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_renaming) return _buildRename(context);
    if (_thanks) return _buildThanks(context);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(Icons.circle, size: 10, color: _connected ? Colors.green : Colors.amber),
            const SizedBox(width: 8),
            Text(_connected ? 'Bağlı' : 'Bekleniyor'),
          ],
        ),
        actions: [
          Center(
            child: Text(
              _stationName,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          TextButton(onPressed: _startRename, child: const Text('Değiştir')),
          const SizedBox(width: 8),
        ],
      ),
      body: _form == null ? _buildIdle(context) : _buildForm(context),
    );
  }

  // ─── Ad verme ──────────────────────────────────────────────────────────────
  Widget _buildRename(BuildContext context) {
    final controller = TextEditingController(text: _stationName);
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Bu tablete bir ad verin',
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Personel, formu gönderirken bu adı seçecek. Ad cihazda kalıcı '
                  'saklanır; bir kez girilir.',
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: controller,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Tablet adı',
                    hintText: 'Örn. Ofis 1',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: _applyName,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    if (_stationName.isNotEmpty)
                      Expanded(
                        child: TextButton(
                          onPressed: () => setState(() => _renaming = false),
                          child: const Text('Vazgeç'),
                        ),
                      ),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => _applyName(controller.text),
                        child: const Text('Kaydet'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ─── Teşekkür ──────────────────────────────────────────────────────────────
  Widget _buildThanks(BuildContext context) => Scaffold(
        backgroundColor: Colors.green.shade50,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 48,
                backgroundColor: Colors.green.shade600,
                child: const Icon(Icons.check, size: 52, color: Colors.white),
              ),
              const SizedBox(height: 24),
              Text(
                'Formunuz imzalandı',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Colors.green.shade800,
                    ),
              ),
              const SizedBox(height: 8),
              Text('Teşekkür ederiz.', style: TextStyle(color: Colors.green.shade700)),
            ],
          ),
        ),
      );

  // ─── Bekleme ───────────────────────────────────────────────────────────────
  Widget _buildIdle(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _PulsingIcon(),
              const SizedBox(height: 28),
              Text(
                'Form bekleniyor',
                style: Theme.of(context).textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Personel formu bu tablete gönderdiğinde ekranda görünecek.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Text(
                        'BU TABLETİN ADI',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _stationName,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _startRename,
                        child: const Text('Değiştir'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  // ─── Form ──────────────────────────────────────────────────────────────────
  Widget _buildForm(BuildContext context) {
    final form = _form!;
    final theme = Theme.of(context);

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                form['title']?.toString() ?? '',
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if ((form['studentName']?.toString() ?? '').isNotEmpty)
                    Chip(label: Text(form['studentName'].toString())),
                  if ((form['contextLabel']?.toString() ?? '').isNotEmpty)
                    Chip(label: Text(form['contextLabel'].toString())),
                  if ((form['staffName']?.toString() ?? '').isNotEmpty)
                    Chip(label: Text('Uygulayan: ${form['staffName']}')),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                constraints: const BoxConstraints(maxHeight: 300),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  border: Border.all(color: theme.dividerColor),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: SingleChildScrollView(
                  child: Text(form['body']?.toString() ?? '', style: const TextStyle(height: 1.5)),
                ),
              ),
              if ((form['staffNotes']?.toString() ?? '').isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('UYGULAMA NOTU', style: theme.textTheme.labelSmall),
                      const SizedBox(height: 4),
                      Text(form['staffNotes'].toString()),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              ...List.generate(_checkItems.length, (index) {
                final selected = _checked.contains(index);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() {
                      if (selected) {
                        _checked.remove(index);
                      } else {
                        _checked.add(index);
                      }
                    }),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: selected ? theme.colorScheme.primary : theme.dividerColor,
                          width: selected ? 2 : 1,
                        ),
                        color: selected
                            ? theme.colorScheme.primary.withValues(alpha: 0.08)
                            : null,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            selected ? Icons.check_box : Icons.check_box_outline_blank,
                            color: selected ? theme.colorScheme.primary : null,
                            size: 28,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _checkItems[index],
                              style: const TextStyle(fontSize: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
              if (_requiresSignature) ...[
                const SizedBox(height: 12),
                Text(
                  _signerHint[form['signerRole']?.toString()] ?? 'İmza',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                ConsentSignaturePad(
                  key: _padKey,
                  onChanged: (value) => setState(() => _hasInk = value),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: _signerNameController,
                decoration: const InputDecoration(
                  labelText: 'İmzalayan ad soyad',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _signerRelationController,
                decoration: const InputDecoration(
                  labelText: 'Yakınlık (veli imzalıyorsa)',
                  hintText: 'Anne / Baba / Vasi',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _error,
                    style: TextStyle(color: theme.colorScheme.onErrorContainer),
                  ),
                ),
              ],
            ],
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SizedBox(
                  height: 56,
                  child: FilledButton(
                    onPressed: _canSubmit ? _submit : null,
                    child: Text(
                      _submitting ? 'Gönderiliyor...' : 'Onaylıyorum ve İmzalıyorum',
                      style: const TextStyle(fontSize: 17),
                    ),
                  ),
                ),
                if (!_canSubmit && !_submitting) ...[
                  const SizedBox(height: 8),
                  Text(
                    !_allChecked
                        ? 'Devam etmek için tüm onay maddelerini işaretleyin.'
                        : 'Devam etmek için imza alanına imzanızı atın.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PulsingIcon extends StatefulWidget {
  const _PulsingIcon();

  @override
  State<_PulsingIcon> createState() => _PulsingIconState();
}

class _PulsingIconState extends State<_PulsingIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return SizedBox(
      width: 120,
      height: 120,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) => Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: 60 + 60 * _controller.value,
              height: 60 + 60 * _controller.value,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: 0.22 * (1 - _controller.value)),
              ),
            ),
            child!,
          ],
        ),
        child: CircleAvatar(
          radius: 34,
          backgroundColor: color.withValues(alpha: 0.15),
          child: Icon(Icons.draw_outlined, size: 34, color: color),
        ),
      ),
    );
  }
}
