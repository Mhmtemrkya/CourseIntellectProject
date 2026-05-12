import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import 'accounting_approval_detail_page.dart';
import '../widgets/accounting_ui.dart';

class AccountingApprovalsPage extends StatefulWidget {
  final bool canApprove;
  final String pageTitle;

  const AccountingApprovalsPage({
    super.key,
    this.canApprove = false,
    this.pageTitle = 'Onay Takibi',
  });

  @override
  State<AccountingApprovalsPage> createState() =>
      _AccountingApprovalsPageState();
}

class _AccountingApprovalsPageState extends State<AccountingApprovalsPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    if (!_store.isLoaded) {
      _store.loadDashboard();
    }
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: AppBar(
        title: Text(
          widget.pageTitle,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: widget.canApprove ? 'Yönetici onay akışı' : 'Onay izleme',
            title: widget.canApprove
                ? 'İndirim, maaş ve gider taleplerini tek merkezden onaylayın.'
                : 'Muhasebe birimi onay bekleyen talepleri izler, karar yönetiçi tarafında verilir.',
            description: widget.canApprove
                ? 'Onay verildiğinde ilgili kişilere bildirim düşer ve finans akışı güncellenir.'
                : 'Bu görünüm yalnızca takip içindir. Onay ve ret yetkisi yönetiçi panelindedir.',
            colors: [Color(0xFF0F172A), Color(0xFF475569)],
            metrics: [
              AccountingHeroMetric(
                label: 'Bekleyen',
                value:
                    '${_store.approvals.where((item) => item.status == 'Bekliyor').length} talep',
              ),
              AccountingHeroMetric(
                label: 'Onaylanan',
                value:
                    '${_store.approvals.where((item) => item.status == 'Onaylandı').length} talep',
              ),
            ],
          ),
          const SizedBox(height: 16),
          ..._store.approvals.map((item) => _approvalCard(context, item)),
        ],
      ),
    );
  }

  Widget _approvalCard(BuildContext context, ApprovalRecord item) {
    final isPending = item.status == 'Bekliyor';
    final color = isPending ? const Color(0xFFB45309) : const Color(0xFF0F766E);

    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => AccountingApprovalDetailPage(approval: item),
        ),
      ),
      child: AccountingPanel(
        margin: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Chip(
                  label: Text(item.status),
                  side: BorderSide.none,
                  backgroundColor: color.withValues(alpha: 0.12),
                  labelStyle: TextStyle(color: color),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(item.category, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 10),
            Text(
              item.reason,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(height: 1.4),
            ),
            const SizedBox(height: 12),
            if (isPending && widget.canApprove)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton(
                    onPressed: () => _updateStatus(
                      item,
                      'Onaylandı',
                      'Talep onaylandı ve gerekli kişilere bildirim gitti.',
                    ),
                    child: const Text('Onay Ver'),
                  ),
                  OutlinedButton(
                    onPressed: () => _updateStatus(
                      item,
                      'Reddedildi',
                      'Talep reddedildi ve ilgili kişilere bildirim gitti.',
                    ),
                    child: const Text('Reddet'),
                  ),
                ],
              ),
            if (isPending && !widget.canApprove)
              Text(
                'Bu talep yönetiçi onayı bekliyor.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: const Color(0xFFB45309),
                  fontWeight: FontWeight.w700,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _updateStatus(
    ApprovalRecord item,
    String status,
    String message,
  ) async {
    try {
      await _store.updateApprovalStatus(item, status);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}
