import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/notification_preferences_service.dart';

class NotificationPreferencesPage extends StatefulWidget {
  const NotificationPreferencesPage({super.key});

  @override
  State<NotificationPreferencesPage> createState() => _NotificationPreferencesPageState();
}

class _NotificationPreferencesPageState extends State<NotificationPreferencesPage> {
  AuthSession? _session;
  NotificationPreferences? _preferences;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || !mounted) return;
    final preferences = await NotificationPreferencesService.instance.load(session);
    if (!mounted) return;
    setState(() {
      _session = session;
      _preferences = preferences;
    });
  }

  Future<void> _update(NotificationPreferences next) async {
    final session = _session;
    if (session == null) return;
    setState(() {
      _preferences = next;
      _saving = true;
    });
    await NotificationPreferencesService.instance.save(session, next);
    if (!mounted) return;
    setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final prefs = _preferences;
    final session = _session;
    final theme = Theme.of(context);

    if (prefs == null || session == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final showFinance = session.primaryRole == 'Parent' || session.primaryRole == 'Accounting' || session.primaryRole == 'Admin';
    final showMeetings = session.primaryRole == 'Teacher' || session.primaryRole == 'Parent' || session.primaryRole == 'Admin' || session.primaryRole == 'Administrative';
    final showReports = session.primaryRole == 'Teacher' || session.primaryRole == 'Parent' || session.primaryRole == 'Admin' || session.primaryRole == 'Administrative';
    final showAcademic = session.primaryRole != 'Accounting';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirim Tercihleri'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF123456), Color(0xFF1D4ED8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Canlı Bildirim Merkezi',
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  'Internet açıkken hangi banner bildirimlerin görüneceğini ve hangilerinin sessiz kalacağını buradan yönetebilirsin.',
                  style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.88)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _section(
            context,
            title: 'Genel Kontrol',
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Canlı bildirimler açık'),
                  subtitle: const Text('Tüm banner akışını tek hamlede aç veya kapat.'),
                  value: prefs.allEnabled,
                  onChanged: (value) => _update(prefs.copyWith(allEnabled: value)),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Mesaj önizlemesi göster'),
                  subtitle: const Text('Bildirim içinde kısa mesaj ve içerik özeti göster.'),
                  value: prefs.previewEnabled,
                  onChanged: (value) => _update(prefs.copyWith(previewEnabled: value)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _section(
            context,
            title: 'Bildirim Türleri',
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Duyuru ve mesajlar'),
                  subtitle: const Text('Duyuru, sohbet ve genel iletişim akışları.'),
                  value: prefs.socialEnabled,
                  onChanged: (value) => _update(prefs.copyWith(socialEnabled: value)),
                ),
                if (showAcademic)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Akademik akışlar'),
                    subtitle: const Text('Ödev, içerik, planlı sınav ve sınav sonucu bildirimleri.'),
                    value: prefs.academicEnabled,
                    onChanged: (value) => _update(prefs.copyWith(academicEnabled: value)),
                  ),
                if (showMeetings)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Görüşme hareketleri'),
                    subtitle: const Text('Veli-öğretmen görüşme talepleri ve durum güncellemeleri.'),
                    value: prefs.meetingEnabled,
                    onChanged: (value) => _update(prefs.copyWith(meetingEnabled: value)),
                  ),
                if (showReports)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Rapor akışları'),
                    subtitle: const Text('Haftalık rapor ve geri bildirim kayıtları.'),
                    value: prefs.reportEnabled,
                    onChanged: (value) => _update(prefs.copyWith(reportEnabled: value)),
                  ),
                if (showFinance)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Finans uyarıları'),
                    subtitle: const Text('Ödeme, tahsilat ve makbuz hareketleri.'),
                    value: prefs.financeEnabled,
                    onChanged: (value) => _update(prefs.copyWith(financeEnabled: value)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _section(
            context,
            title: 'Sessiz Modlar',
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Mesajları sessiz göster'),
                  subtitle: const Text('Banner görünsün ama ses çalmasın.'),
                  value: prefs.silentMessages,
                  onChanged: (value) => _update(prefs.copyWith(silentMessages: value)),
                ),
                if (showFinance)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Finans bildirimlerini sessiz göster'),
                    subtitle: const Text('Ödeme uyarıları ses olmadan düşsün.'),
                    value: prefs.silentFinance,
                    onChanged: (value) => _update(prefs.copyWith(silentFinance: value)),
                  ),
                if (showReports)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Rapor bildirimlerini sessiz göster'),
                    subtitle: const Text('Haftalık rapor güncellemeleri sessiz kalsın.'),
                    value: prefs.silentReports,
                    onChanged: (value) => _update(prefs.copyWith(silentReports: value)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AnimatedOpacity(
            duration: const Duration(milliseconds: 180),
            opacity: _saving ? 1 : 0,
            child: const Center(
              child: Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text('Tercihler kaydediliyor...'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, {required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}
