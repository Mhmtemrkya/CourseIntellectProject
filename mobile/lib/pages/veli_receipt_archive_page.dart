import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';

class VeliReceiptArchivePage extends StatelessWidget {
  const VeliReceiptArchivePage({super.key});

  @override
  Widget build(BuildContext context) {
    final receipts = AccountingFinanceStore.instance.collections;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Makbuz Arsivi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: receipts
            .map(
              (item) => InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => _showReceiptDetail(context, item),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${item.className} • ${item.method} • ${item.time}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        item.amount,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  void _showReceiptDetail(BuildContext context, CollectionRecord item) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _line('Sınıf', item.className),
            _line('Ödeme Yöntemi', item.method),
            _line('Tutar', item.amount),
            _line('Tarih', item.time),
            _line(
              'Not',
              item.note.isEmpty ? 'Makbuz açıklamasi yok.' : item.note,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  Widget _line(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Colors.black87, height: 1.45),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }
}
