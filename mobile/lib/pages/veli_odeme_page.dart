import 'package:flutter/material.dart';
import 'package:student/pages/veli_online_odeme_page.dart';
import 'package:student/services/accounting_finance_store.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/linked_children_service.dart';
import 'package:student/widgets/adaptive_scaffold.dart';
import 'package:student/widgets/app_header.dart';
import 'package:student/widgets/responsive_layout.dart';

class VeliOdemePage extends StatefulWidget {
  const VeliOdemePage({super.key});

  @override
  State<VeliOdemePage> createState() => _VeliOdemePageState();
}

class _VeliOdemePageState extends State<VeliOdemePage> {
  String _studentName = 'Ali Yilmaz';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    await AccountingFinanceStore.instance.loadDashboard();
    final session = await AuthSessionStore.instance.load();
    final linkedChildren = await LinkedChildrenService.instance.loadLinkedChildren();
    if (!mounted) return;
    setState(() {
      if (linkedChildren.isNotEmpty) {
        _studentName = linkedChildren.first.fullName;
      } else if (session != null) {
        _studentName = session.fullName;
      }
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final installments = store.installments.where((item) => item.student == _studentName).toList();
    final paid = installments.where((item) => item.status == 'Alınan').fold<int>(0, (sum, item) => sum + store.parseAmount(item.amount));
    final total = installments.fold<int>(0, (sum, item) => sum + store.parseAmount(item.amount));
    final remaining = (total - paid).clamp(0, total);
    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: hasSidebar ? null : const AppHeader(title: "Ödemeler"),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ResponsiveContent(
          child: Column(
            children: [
              _summaryCards(context, total, paid, remaining),
              const SizedBox(height: 16),
              _paymentProgress(context, total, paid, remaining),
              const SizedBox(height: 16),
              _installmentPlan(context, installments),
              const SizedBox(height: 16),
              _paymentHistory(context, store, _studentName),
              const SizedBox(height: 20),
              _payButton(context),
            ],
          ),
        ),
      ),
    );
  }

  // ================= SUMMARY =================
  Widget _summaryCards(BuildContext context, int total, int paid, int remaining) {
    final store = AccountingFinanceStore.instance;
    final cards = [
      _SummaryCard(
        title: "Toplam",
        value: store.formatAmount(total),
        icon: Icons.account_balance_wallet,
        color: Colors.blue,
      ),
      _SummaryCard(
        title: "Ödenen",
        value: store.formatAmount(paid),
        icon: Icons.check_circle,
        color: Colors.green,
      ),
      _SummaryCard(
        title: "Kalan",
        value: store.formatAmount(remaining),
        icon: Icons.schedule,
        color: Colors.orange,
      ),
    ];

    if (ResponsiveLayout.isTablet(context)) {
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: cards
            .map(
              (card) => SizedBox(
                width: ResponsiveLayout.itemWidth(
                  context,
                  spacing: 8,
                  phone: 1,
                  tablet: 3,
                  largeTablet: 3,
                ),
                child: card,
              ),
            )
            .toList(),
      );
    }

    return Row(
        children: [
        Expanded(child: _SummaryCard(title: "Toplam", value: store.formatAmount(total), icon: Icons.account_balance_wallet, color: Colors.blue)),
        SizedBox(width: 8),
        Expanded(child: _SummaryCard(title: "Ödenen", value: store.formatAmount(paid), icon: Icons.check_circle, color: Colors.green)),
        SizedBox(width: 8),
        Expanded(child: _SummaryCard(title: "Kalan", value: store.formatAmount(remaining), icon: Icons.schedule, color: Colors.orange)),
      ],
    );
  }

  // ================= PROGRESS =================
  Widget _paymentProgress(BuildContext context, int total, int paid, int remaining) {
    final store = AccountingFinanceStore.instance;
    final ratio = total == 0 ? 0.0 : paid / total;
    return _cardWrapper(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text("Ödeme İlerlemesi",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              Text('%${(ratio * 100).round()}'),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: ratio,
            minHeight: 10,
            borderRadius: BorderRadius.circular(8),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Ödenen: ${store.formatAmount(paid)}"),
              Text("Kalan: ${store.formatAmount(remaining)}"),
            ],
          )
        ],
      ),
    );
  }

  // ================= INSTALLMENT PLAN =================
  Widget _installmentPlan(BuildContext context, List<InstallmentRecord> installments) {
    return _cardWrapper(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Taksit Planı (2024-2025)",
              style: TextStyle(fontWeight: FontWeight.bold)),
          SizedBox(height: 12),
          if (installments.isEmpty)
            const Text('Bagli ogrenci icin henuz taksit plani bulunmuyor.')
          else
          ...installments.map(
            (item) => _InstallmentRow(month: item.due, amount: item.amount, status: item.status),
          ),
        ],
      ),
    );
  }

  // ================= PAYMENT HISTORY =================
  Widget _paymentHistory(BuildContext context, AccountingFinanceStore store, String studentName) {
    return _cardWrapper(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Ödeme Geçmişi",
              style: TextStyle(fontWeight: FontWeight.bold)),
          SizedBox(height: 12),
          if (store.collections.where((item) => item.name == studentName).isEmpty)
            const Text('Bagli ogrenci icin henuz tahsilat kaydi bulunmuyor.')
          else
          ...store.collections.where((item) => item.name == studentName).map(
                (item) => _PaymentHistoryItem(
                  amount: item.amount,
                  method: item.method,
                  date: item.time,
                ),
              ),
        ],
      ),
    );
  }

  // ================= PAY BUTTON =================
  Widget _payButton(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton.icon(
        onPressed: _loading ? null : () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const VeliOnlineOdemePage(),
            ),
          );
        },
        icon: const Icon(Icons.credit_card),
        label: const Text("Online Ödeme Yap"),
      ),
    );
  }

  // ================= CARD WRAPPER =================
  Widget _cardWrapper(BuildContext context, Widget child) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 6),
        ],
      ),
      child: child,
    );
  }
}

// ================= COMPONENTS =================

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {

    final theme = Theme.of(context);

    return Card(
      color: theme.cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(title),
          ],
        ),
      ),
    );
  }
}

class _InstallmentRow extends StatelessWidget {
  final String month;
  final String amount;
  final String status;

  const _InstallmentRow({
    required this.month,
    required this.amount,
    required this.status,
  });

  Color _statusColor() {
    if (status == "Ödendi") return Colors.green;
    if (status == "Bekliyor") return Colors.orange;
    return Colors.grey;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(child: Text(month)),
          Text(amount),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor().withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              status,
              style: TextStyle(color: _statusColor()),
            ),
          )
        ],
      ),
    );
  }
}

class _PaymentHistoryItem extends StatelessWidget {
  final String amount;
  final String method;
  final String date;

  const _PaymentHistoryItem({
    required this.amount,
    required this.method,
    required this.date,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(Icons.receipt_long, color: Colors.green),
      title: Text(amount),
      subtitle: Text(method),
      trailing: Text(date),
    );
  }
}
