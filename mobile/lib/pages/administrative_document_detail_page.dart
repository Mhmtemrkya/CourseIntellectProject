import 'package:flutter/material.dart';

import '../widgets/admin_ui.dart';
import 'administrative_chat_page.dart';

class AdministrativeDocumentDetailPage extends StatelessWidget {
  final String studentName;
  final String className;
  final String parentName;
  final String status;
  final bool identityReady;
  final bool schoolReady;
  final bool contractReady;
  final bool contactReady;

  const AdministrativeDocumentDetailPage({
    super.key,
    required this.studentName,
    required this.className,
    required this.parentName,
    required this.status,
    required this.identityReady,
    required this.schoolReady,
    required this.contractReady,
    required this.contactReady,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = status == 'Tamamlandı'
        ? const Color(0xFF14532D)
        : status == 'Eksik Evrak'
        ? const Color(0xFFB45309)
        : const Color(0xFF2563EB);

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Evrak Detayı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Kayıt dosyası',
            title: '$studentName için idari evrak özetini görüntüleyin.',
            description:
                '$className öğrencisi için veli, sözleşme ve temel kayıt evrak durumu tek ekranda.',
            colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
            metrics: [
              AdminHeroMetric(label: 'Durum', value: status),
              AdminHeroMetric(label: 'Veli', value: parentName),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Belge Kontrolü',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                _row('TC / Kimlik Belgesi', identityReady),
                _row('Okul ve sınıf bilgisi', schoolReady),
                _row('Veli sözleşmesi', contractReady),
                _row('İletişim evrakı', contactReady),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'İdari Aksiyonlar',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.mark_email_unread_outlined,
                    color: statusColor,
                  ),
                  title: const Text('Veliye belge hatırlatması hazırla'),
                  subtitle: const Text(
                    'Eksik belge varsa standart bilgilendirme mesajı oluşturulur.',
                  ),
                  onTap: () => _openReminderModal(context, statusColor),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(
                    Icons.description_outlined,
                    color: Color(0xFF2563EB),
                  ),
                  title: const Text('Evrak özetini oluştur'),
                  subtitle: const Text(
                    'Kayıt dosyasının idari özet çıktısı hazırlanır.',
                  ),
                  onTap: () => _openSummaryModal(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, bool isReady) {
    final color = isReady ? const Color(0xFF14532D) : const Color(0xFFB45309);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(
            isReady
                ? Icons.check_circle_rounded
                : Icons.pending_actions_rounded,
            color: color,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
          Text(
            isReady ? 'Hazır' : 'Bekliyor',
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  void _openReminderModal(BuildContext context, Color statusColor) {
    final draft =
        'Merhaba $parentName, $studentName için kayıt dosyasında eksik evrak görünüyor. En kısa sürede belge teslimini tamamlamanızı rica ederiz.';

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        return Container(
          margin: const EdgeInsets.all(12),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          decoration: BoxDecoration(
            color: theme.cardColor,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  Icons.mark_email_unread_outlined,
                  color: statusColor,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Belge Hatırlatması',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '$parentName için eksik evrak hatırlatma metni hazır. İstersen bunu doğrudan veli sohbetine aktarabilirsin.',
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: theme.scaffoldBackgroundColor,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  draft,
                  style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      child: const Text('Kapat'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => AdministrativeChatPage(
                              user: parentName,
                              role: 'Veli İletişimi',
                              initialDraft: draft,
                            ),
                          ),
                        );
                      },
                      child: const Text('Mesaja Aktar'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  void _openSummaryModal(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.description_outlined,
                    color: Color(0xFF2563EB),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Evrak Özeti',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '$studentName için idari özet hazırlandı. Bu görünüm çıktı veya paylaşım önizlemesi gibi kullanılabilir.',
                  style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: theme.scaffoldBackgroundColor,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                      color: theme.dividerColor.withValues(alpha: 0.28),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'KAYIT DOSYASI ÖZETİ',
                              style: theme.textTheme.labelLarge?.copyWith(
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                          Text(
                            '14.03.2026',
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _summaryRow(theme, 'Öğrenci', studentName),
                      _summaryRow(theme, 'Sınıf', className),
                      _summaryRow(theme, 'Veli', parentName),
                      _summaryRow(theme, 'Durum', status),
                      const SizedBox(height: 14),
                      const Divider(),
                      const SizedBox(height: 10),
                      _summaryCheck(
                        theme,
                        'TC / Kimlik Belgesi',
                        identityReady,
                      ),
                      _summaryCheck(
                        theme,
                        'Okul ve sınıf bilgisi',
                        schoolReady,
                      ),
                      _summaryCheck(theme, 'Veli sözleşmesi', contractReady),
                      _summaryCheck(theme, 'İletişim evrakı', contactReady),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(dialogContext),
                        child: const Text('Kapat'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.pop(dialogContext);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Evrak özeti belge görünümünde hazırlandı.',
                              ),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: const Text('Belgeyi Hazırla'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _summaryRow(ThemeData theme, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 70,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.textTheme.bodySmall?.color?.withValues(
                  alpha: 0.72,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryCheck(ThemeData theme, String title, bool isReady) {
    final color = isReady ? const Color(0xFF14532D) : const Color(0xFFB45309);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            isReady
                ? Icons.check_circle_rounded
                : Icons.pending_actions_rounded,
            size: 18,
            color: color,
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(title, style: theme.textTheme.bodyMedium)),
          Text(
            isReady ? 'Hazır' : 'Bekliyor',
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
