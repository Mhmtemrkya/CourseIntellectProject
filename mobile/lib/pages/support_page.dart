// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/support_tickets_api_service.dart';

const _navy = Color(0xFF021622);
const _navyDeep = Color(0xFF0A2535);
const _orange = Color(0xFFFF7A1A);
const _orangeWarm = Color(0xFFFBB971);

/// Destek ekranının yüzey paleti.
///
/// Koyu lacivert tonlar bu ekranın kimliği, AMA açık temada koyu kalmaz:
/// her değer temanın parlaklığına göre çözülür. Yeni renk eklerken açık
/// karşılığını da yaz — sabit koyu değer yazılırsa ekran açık temada tek
/// başına koyu kalır.
class _SupportPalette {
  const _SupportPalette({
    required this.dark,
    required this.page,
    required this.surface,
    required this.text,
  });

  factory _SupportPalette.of(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return _SupportPalette(
      dark: dark,
      page: dark ? _navy : theme.scaffoldBackgroundColor,
      surface: dark ? _navyDeep : Colors.white,
      text: dark ? Colors.white : const Color(0xFF0F172A),
    );
  }

  final bool dark;
  final Color page;
  final Color surface;
  final Color text;

  /// Yüzey üstü dolgu/kenarlık tonlaması.
  Color tint(double opacity) => dark
      ? Colors.white.withValues(alpha: opacity)
      : Colors.black.withValues(alpha: opacity * 0.8);

  /// İkincil metin. Açık temada okunurluk tabanı korunur; koyu temada verilen
  /// saydamlık aynen uygulanır.
  Color subtle(double opacity) => dark
      ? Colors.white.withValues(alpha: opacity)
      : const Color(0xFF0F172A).withValues(
          alpha: (opacity + 0.35).clamp(0.55, 1.0),
        );
}


class SupportPage extends StatefulWidget {
  const SupportPage({super.key});

  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  final _formKey = GlobalKey<FormState>();
  final _subjectCtrl = TextEditingController();
  final _summaryCtrl = TextEditingController();

  String _category = 'Genel';
  String _priority = 'normal';
  bool _submitting = false;
  bool _loadingTickets = true;
  bool _isTenantAdmin = false;
  AuthSession? _session;
  List<SupportTicketRecord> _tickets = [];
  String? _error;

  static const List<MapEntry<String, String>> _categories = [
    MapEntry('Genel', 'Genel'),
    MapEntry('Teknik', 'Teknik destek'),
    MapEntry('Faturalama', 'Faturalama'),
    MapEntry('Hesap', 'Hesap & Erişim'),
    MapEntry('Öneri', 'Öneri / Geri bildirim'),
  ];

  static const List<MapEntry<String, String>> _priorities = [
    MapEntry('low', 'Düşük'),
    MapEntry('normal', 'Normal'),
    MapEntry('high', 'Yüksek'),
    MapEntry('urgent', 'Acil'),
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = await AuthSessionStore.instance.load();
    setState(() {
      _session = session;
      _isTenantAdmin =
          session != null &&
          session.primaryRole.toLowerCase() == 'admin' &&
          !session.isPlatformAdmin;
    });
    if (_isTenantAdmin) {
      await _loadTickets();
    } else {
      setState(() => _loadingTickets = false);
    }
  }

  Future<void> _loadTickets() async {
    setState(() {
      _loadingTickets = true;
      _error = null;
    });
    try {
      final list = await SupportTicketsApiService.instance.fetchMine();
      setState(() => _tickets = list);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loadingTickets = false);
    }
  }

  Future<void> _submit() async {
    final supportPalette = _SupportPalette.of(context);
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final created = await SupportTicketsApiService.instance.create(
        subject: _subjectCtrl.text.trim(),
        summary: _summaryCtrl.text.trim(),
        category: _category,
        priority: _priority,
      );
      _subjectCtrl.clear();
      _summaryCtrl.clear();
      setState(() {
        _category = 'Genel';
        _priority = 'normal';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: supportPalette.surface,
            content: Text(
              'Talebiniz oluşturuldu · ${created.ticketNumber}',
              style: TextStyle(color: supportPalette.text),
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      await _loadTickets();
    } on SupportTicketException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red.shade900,
            content: Text(
              e.message,
              style: TextStyle(color: supportPalette.text),
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _summaryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final supportPalette = _SupportPalette.of(context);
    return Scaffold(
      backgroundColor: supportPalette.page,
      appBar: AppBar(
        backgroundColor: supportPalette.page,
        foregroundColor: supportPalette.text,
        elevation: 0,
        title: const Text(
          'Destek',
          style: TextStyle(fontWeight: FontWeight.w600, letterSpacing: -0.3),
        ),
      ),
      body: SafeArea(
        child: _session == null
            ? const _Centered(child: CircularProgressIndicator(color: _orange))
            : !_isTenantAdmin
            ? _NotAdminMessage()
            : RefreshIndicator(
                onRefresh: _loadTickets,
                color: _orange,
                backgroundColor: supportPalette.surface,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 20),
                    _buildForm(),
                    const SizedBox(height: 28),
                    _buildTicketsHeader(),
                    const SizedBox(height: 12),
                    if (_loadingTickets)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 32),
                        child: Center(
                          child: CircularProgressIndicator(color: _orange),
                        ),
                      )
                    else if (_error != null)
                      _ErrorBanner(message: _error!, onRetry: _loadTickets)
                    else if (_tickets.isEmpty)
                      _EmptyTickets()
                    else
                      ..._tickets.map(
                        (t) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _TicketCard(ticket: t),
                        ),
                      ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildHeader() {
    final supportPalette = _SupportPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(width: 32, height: 1, color: _orange),
            const SizedBox(width: 10),
            Text(
              'DESTEK · TICKET',
              style: TextStyle(
                fontSize: 11,
                color: _orangeWarm,
                letterSpacing: 4,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text(
          'Bize ulaşın'.tr,
          style: TextStyle(
            color: supportPalette.text,
            fontSize: 26,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Bir sorun ya da öneriniz mi var? Talebinizi açın, ekibimiz dönsün.'.tr,
          style: TextStyle(
            color: supportPalette.subtle(0.65),
            fontSize: 14,
            height: 1.4,
          ),
        ),
        if (_session?.tenantName.isNotEmpty == true) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _orange.withOpacity(0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: _orange.withOpacity(0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.business, color: _orangeWarm, size: 14),
                const SizedBox(width: 6),
                Text(
                  _session!.tenantName,
                  style: const TextStyle(
                    color: _orangeWarm,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildForm() {
    final supportPalette = _SupportPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: supportPalette.surface.withOpacity(0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: supportPalette.tint(0.06)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Yeni talep',
              style: TextStyle(
                color: supportPalette.text,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),

            _label('Konu'),
            _input(
              controller: _subjectCtrl,
              hint: 'Kısa konu başlığı',
              maxLength: 120,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Konu zorunlu' : null,
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Kategori'),
                      _dropdown(
                        value: _category,
                        items: _categories,
                        onChanged: (v) => setState(() => _category = v),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Öncelik'),
                      _dropdown(
                        value: _priority,
                        items: _priorities,
                        onChanged: (v) => setState(() => _priority = v),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            _label('Açıklama'),
            _input(
              controller: _summaryCtrl,
              hint: 'Sorunu / talebi mümkün olduğunca açık şekilde anlatın...',
              maxLines: 6,
              maxLength: 1800,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Mesaj zorunlu' : null,
            ),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF08111F),
                        ),
                      )
                    : const Icon(Icons.send, size: 18),
                label: Text(_submitting ? 'Gönderiliyor...' : 'Talebi gönder'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _orange,
                  foregroundColor: const Color(0xFF08111F),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketsHeader() {
    final supportPalette = _SupportPalette.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Açtığım talepler'.tr,
          style: TextStyle(
            color: supportPalette.text,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          '${_tickets.length} talep',
          style: TextStyle(
            color: supportPalette.subtle(0.5),
            fontSize: 12,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: TextStyle(
        color: _SupportPalette.of(context).subtle(0.7),
        fontSize: 12,
        fontWeight: FontWeight.w500,
      ),
    ),
  );

  Widget _input({
    required TextEditingController controller,
    String? hint,
    int? maxLength,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    final supportPalette = _SupportPalette.of(context);
    return TextFormField(
      controller: controller,
      maxLength: maxLength,
      maxLines: maxLines,
      validator: validator,
      style: TextStyle(color: supportPalette.text, fontSize: 14),
      cursorColor: _orange,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: supportPalette.subtle(0.3)),
        filled: true,
        fillColor: supportPalette.tint(0.04),
        counterStyle: TextStyle(
          color: supportPalette.subtle(0.4),
          fontSize: 11,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: supportPalette.tint(0.1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: supportPalette.tint(0.1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: _orange.withOpacity(0.6), width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.red.shade400),
        ),
      ),
    );
  }

  Widget _dropdown({
    required String value,
    required List<MapEntry<String, String>> items,
    required ValueChanged<String> onChanged,
  }) {
    final supportPalette = _SupportPalette.of(context);
    return Container(
      decoration: BoxDecoration(
        color: supportPalette.tint(0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: supportPalette.tint(0.1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: DropdownButton<String>(
        value: value,
        isExpanded: true,
        underline: const SizedBox.shrink(),
        dropdownColor: supportPalette.surface,
        style: TextStyle(color: supportPalette.text, fontSize: 14),
        iconEnabledColor: _orangeWarm,
        items: items
            .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
            .toList(),
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});

  final SupportTicketRecord ticket;

  @override
  Widget build(BuildContext context) {
    final supportPalette = _SupportPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: supportPalette.surface.withOpacity(0.6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: supportPalette.tint(0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          ticket.ticketNumber,
                          style: TextStyle(
                            color: supportPalette.subtle(0.5),
                            fontSize: 10,
                            letterSpacing: 1.5,
                            fontFamily: 'monospace',
                          ),
                        ),
                        Text(
                          '  ·  ',
                          style: TextStyle(
                            color: supportPalette.subtle(0.3),
                          ),
                        ),
                        Text(
                          ticket.category,
                          style: TextStyle(
                            color: supportPalette.subtle(0.5),
                            fontSize: 10,
                            letterSpacing: 1.5,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      ticket.subject,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: supportPalette.text,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              _statusBadge(ticket.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            ticket.summary,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: supportPalette.subtle(0.65),
              fontSize: 13,
              height: 1.4,
            ),
          ),
          if (ticket.hasReply) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _orange.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _orange.withOpacity(0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_user_outlined,
                        color: _orangeWarm,
                        size: 12,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'COURSEINTELLECT YANITI',
                        style: TextStyle(
                          color: _orangeWarm,
                          fontSize: 10,
                          letterSpacing: 1.5,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    ticket.lastMessage,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: supportPalette.subtle(0.85),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatDate(ticket.createdAtUtc),
                style: TextStyle(
                  color: supportPalette.subtle(0.4),
                  fontSize: 11,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (ticket.messages > 0) ...[
                    Text(
                      '${ticket.messages} mesaj',
                      style: TextStyle(
                        color: supportPalette.subtle(0.4),
                        fontSize: 11,
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  _priorityChip(ticket.priority, supportPalette),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) {
    final l = d.toLocal();
    return '${l.day.toString().padLeft(2, '0')}.${l.month.toString().padLeft(2, '0')}.${l.year} '
        '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  }

  Widget _statusBadge(String status) {
    final v = status.toLowerCase();
    late final String label;
    late final Color color;
    if (v == 'resolved' || v == 'closed') {
      label = 'Çözüldü';
      color = const Color(0xFF34D399);
    } else if (v == 'in-progress' || v == 'pending') {
      label = 'İşleniyor';
      color = const Color(0xFFFBBF24);
    } else if (v == 'cancelled') {
      label = 'İptal';
      color = const Color(0xFF6B7280);
    } else {
      label = 'Açık';
      color = const Color(0xFF60A5FA);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _priorityChip(String priority, _SupportPalette supportPalette) {
    final p = priority.toLowerCase();
    late final String label;
    late final Color color;
    switch (p) {
      case 'urgent':
        label = 'Acil';
        color = Colors.red.shade300;
        break;
      case 'high':
        label = 'Yüksek';
        color = Colors.amber.shade300;
        break;
      case 'low':
        label = 'Düşük';
        color = supportPalette.subtle(0.4);
        break;
      default:
        label = 'Normal';
        color = supportPalette.subtle(0.5);
    }
    return Text(
      label.toUpperCase(),
      style: TextStyle(
        color: color,
        fontSize: 10,
        letterSpacing: 1.4,
        fontFamily: 'monospace',
      ),
    );
  }
}

class _NotAdminMessage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final supportPalette = _SupportPalette.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _orange.withOpacity(0.15),
                shape: BoxShape.circle,
                border: Border.all(color: _orange.withOpacity(0.35)),
              ),
              child: const Icon(
                Icons.shield_outlined,
                color: _orangeWarm,
                size: 28,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Sadece kurum yöneticisi'.tr,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: supportPalette.text,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Destek talebi yalnızca kurum yöneticisi tarafından oluşturulabilir.\nLütfen kurumunuzun yöneticisine ulaşın.'.tr,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: supportPalette.subtle(0.65),
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyTickets extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final supportPalette = _SupportPalette.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      decoration: BoxDecoration(
        color: supportPalette.surface.withOpacity(0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: supportPalette.tint(0.06)),
      ),
      child: Column(
        children: [
          Icon(
            Icons.support_agent,
            size: 32,
            color: supportPalette.subtle(0.3),
          ),
          const SizedBox(height: 10),
          Text(
            'Henüz talep oluşturmadınız.'.tr,
            style: TextStyle(
              color: supportPalette.subtle(0.55),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.red.shade900.withOpacity(0.2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.red.shade400.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade300, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: Colors.red.shade200, fontSize: 13),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(foregroundColor: _orangeWarm),
            child: const Text('Tekrar dene'),
          ),
        ],
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Center(child: child);
}
