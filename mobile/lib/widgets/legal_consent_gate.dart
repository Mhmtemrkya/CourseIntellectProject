import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../legal/legal_content.dart';
import '../pages/legal_documents_page.dart';

class LegalConsentGate extends StatefulWidget {
  final Widget child;

  const LegalConsentGate({super.key, required this.child});

  @override
  State<LegalConsentGate> createState() => _LegalConsentGateState();
}

class _LegalConsentGateState extends State<LegalConsentGate> {
  static const _statusKey = 'legal_consent_status';
  static const _versionKey = 'legal_consent_version';
  static const _decidedAtKey = 'legal_consent_decided_at';
  static const _marketingKey = 'legal_consent_marketing';
  static const _pushKey = 'legal_consent_push';
  static const _analyticsKey = 'legal_consent_analytics';

  bool _loaded = false;
  bool _accepted = false;
  bool _declined = false;
  bool _showingConsent = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final status = prefs.getString(_statusKey);
    final version = prefs.getString(_versionKey);
    if (!mounted) return;
    setState(() {
      _accepted = status == 'accepted' && version == legalConsentVersion;
      _declined = status == 'declined' && version == legalConsentVersion;
      _loaded = true;
    });
    if (!_accepted && !_declined) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _showConsentSheet());
    }
  }

  Future<void> _save({
    required String status,
    bool marketing = false,
    bool push = false,
    bool analytics = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_statusKey, status);
    await prefs.setString(_versionKey, legalConsentVersion);
    await prefs.setString(_decidedAtKey, DateTime.now().toIso8601String());
    await prefs.setBool(_marketingKey, marketing);
    await prefs.setBool(_pushKey, push);
    await prefs.setBool(_analyticsKey, analytics);
    if (!mounted) return;
    setState(() {
      _accepted = status == 'accepted';
      _declined = status == 'declined';
    });
  }

  Future<void> _showConsentSheet() async {
    if (!mounted || _showingConsent || _accepted) return;
    _showingConsent = true;
    await showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      builder: (context) => _LegalConsentSheet(
        onAccept: (choices) async {
          await _save(
            status: 'accepted',
            marketing: choices.marketing,
            push: choices.push,
            analytics: choices.analytics,
          );
          if (context.mounted) Navigator.pop(context);
        },
        onDecline: () async {
          await _save(status: 'declined');
          if (context.mounted) Navigator.pop(context);
        },
      ),
    );
    _showingConsent = false;
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_accepted && !_declined) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_declined) {
      return _LegalDeclinedScreen(onReview: _showConsentSheet);
    }
    return widget.child;
  }
}

class _LegalConsentChoices {
  final bool marketing;
  final bool push;
  final bool analytics;

  const _LegalConsentChoices({
    required this.marketing,
    required this.push,
    required this.analytics,
  });
}

class _LegalConsentSheet extends StatefulWidget {
  final ValueChanged<_LegalConsentChoices> onAccept;
  final VoidCallback onDecline;

  const _LegalConsentSheet({required this.onAccept, required this.onDecline});

  @override
  State<_LegalConsentSheet> createState() => _LegalConsentSheetState();
}

class _LegalConsentSheetState extends State<_LegalConsentSheet> {
  bool _understoodKvkk = false;
  bool _acceptedTerms = false;
  bool _marketing = false;
  bool _push = false;
  bool _analytics = false;

  bool get _canContinue => _understoodKvkk && _acceptedTerms;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.92,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.dividerColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'KVKK ve Yasal Bilgilendirme',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Devam etmeden önce aydınlatma metnini okuyup anladığınızı ve kullanım koşullarını kabul ettiğinizi onaylayın. Açık rızalar isteğe bağlıdır.',
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const LegalDocumentsPage(),
                        ),
                      ),
                      icon: const Icon(Icons.article_outlined),
                      label: const Text('Tüm yasal metinleri oku'),
                    ),
                    const SizedBox(height: 12),
                    CheckboxListTile(
                      value: _understoodKvkk,
                      onChanged: (value) =>
                          setState(() => _understoodKvkk = value ?? false),
                      title: const Text(
                        'KVKK aydınlatma metnini okudum ve anladım.',
                      ),
                      subtitle: const Text(
                        'Bu bir açık rıza değildir; veri işleme hakkında bilgilendirme teyididir.',
                      ),
                    ),
                    CheckboxListTile(
                      value: _acceptedTerms,
                      onChanged: (value) =>
                          setState(() => _acceptedTerms = value ?? false),
                      title: const Text('Kullanım koşullarını kabul ediyorum.'),
                      subtitle: const Text(
                        'Hesap güvenliği, yetkili kullanım ve kurum kurallarını kapsar.',
                      ),
                    ),
                    const Divider(height: 24),
                    SwitchListTile(
                      value: _marketing,
                      onChanged: (value) => setState(() => _marketing = value),
                      title: const Text('Ticari/etkinlik ileti izni'),
                      subtitle: const Text(
                        'Kampanya, etkinlik ve tanıtım amaçlı e-posta/SMS gönderimine açık rıza veriyorum.',
                      ),
                    ),
                    SwitchListTile(
                      value: _push,
                      onChanged: (value) => setState(() => _push = value),
                      title: const Text('Anlık bildirim izni'),
                      subtitle: const Text(
                        'Duyuru, sınav, ödev, ödeme ve görüşme hatırlatmalarının cihaz bildirimiyle gönderilmesine izin veriyorum.',
                      ),
                    ),
                    SwitchListTile(
                      value: _analytics,
                      onChanged: (value) => setState(() => _analytics = value),
                      title: const Text('Kullanım analitiği izni'),
                      subtitle: const Text(
                        'Hizmet kalitesini artırmak için kullanım verilerimin toplulaştırılmış analizlerde kullanılmasına izin veriyorum.',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: widget.onDecline,
                      child: const Text('Reddet'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _canContinue
                          ? () => widget.onAccept(
                              _LegalConsentChoices(
                                marketing: _marketing,
                                push: _push,
                                analytics: _analytics,
                              ),
                            )
                          : null,
                      child: const Text('Kabul Et ve Devam Et'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LegalDeclinedScreen extends StatelessWidget {
  final VoidCallback onReview;

  const _LegalDeclinedScreen({required this.onReview});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.gpp_maybe_outlined, size: 54),
              const SizedBox(height: 16),
              Text(
                'Yasal koşullar kabul edilmedi',
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              const Text(
                'Uygulamayı kullanabilmek için KVKK aydınlatmasını okuyup anladığınızı ve kullanım koşullarını kabul ettiğinizi onaylamanız gerekir.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onReview,
                icon: const Icon(Icons.article_outlined),
                label: const Text('Metinleri tekrar incele'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
