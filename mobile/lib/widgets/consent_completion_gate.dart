import 'package:flutter/material.dart';

import '../pages/consent_center_page.dart';
import '../services/consent_api_service.dart';

/// "Tamamlandı" akışının ilk adımındaki onam kapısı.
///
/// Kapı bilerek YUMUŞAKTIR: eksik form varsa uyarır, formları açma imkânı verir,
/// ama "İmzasız devam et" seçeneğini bırakır. Sert engel kurumun işini durdurur;
/// imzasız işlem yapıldığını görünür kılmak yeterlidir (aynı uyarı öğrenci
/// kartında ve cari hesapta da durur).
///
/// Durum okunamazsa (yetki yok / modül kapalı) kapı hiç kurulmaz — iş akışı
/// asla onam yüzünden kilitlenmez.
class ConsentGate {
  const ConsentGate._();

  /// [proceed] yalnızca kullanıcı devam ederse çalışır. Formlar bu ekranda
  /// imzalanırsa kapı kendini yeniden değerlendirip kendiliğinden geçer.
  static Future<void> run(
    BuildContext context, {
    required Future<void> Function() proceed,
    String? appointmentId,
    String? studentProfileId,
    String? contextKind,
    String? contextKey,
    String? contextRefId,
  }) async {
    // Randevu kapısında yeni açılacak formlar o randevuya bağlanmalı; aksi hâlde
    // bir sonraki derste aynı form yeniden "imzalı" sayılır.
    final kind = appointmentId != null ? (contextKind ?? 'DrivingLesson') : contextKind;
    final refId = appointmentId != null ? (contextRefId ?? appointmentId) : contextRefId;

    final status = await _read(
      appointmentId: appointmentId,
      studentProfileId: studentProfileId,
      contextKind: kind,
      contextKey: contextKey,
      contextRefId: refId,
    );

    final required = (status?['requiredCount'] as num?)?.toInt() ?? 0;
    if (status == null || required == 0 || status['complete'] == true) {
      await proceed();
      return;
    }

    if (!context.mounted) return;
    final decision = await showDialog<_GateDecision>(
      context: context,
      builder: (context) => _GateDialog(status: status),
    );

    switch (decision) {
      case _GateDecision.proceed:
        await proceed();
      case _GateDecision.openCenter:
        if (!context.mounted) return;
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ConsentCenterPage(
              studentProfileId:
                  studentProfileId ?? status['studentProfileId'].toString(),
              studentName: status['studentName']?.toString(),
              contextKind: kind,
              contextKey: contextKey,
              contextRefId: refId,
              contextLabel: status['contextLabel']?.toString(),
            ),
          ),
        );
        // Formlar imzalandıysa kapı kendini yeniden değerlendirsin.
        if (!context.mounted) return;
        await run(
          context,
          proceed: proceed,
          appointmentId: appointmentId,
          studentProfileId: studentProfileId,
          contextKind: contextKind,
          contextKey: contextKey,
          contextRefId: contextRefId,
        );
      case null:
        return; // Kullanıcı vazgeçti.
    }
  }

  static Future<Map<String, dynamic>?> _read({
    String? appointmentId,
    String? studentProfileId,
    String? contextKind,
    String? contextKey,
    String? contextRefId,
  }) async {
    try {
      if (appointmentId != null) {
        return await ConsentApiService.instance.appointmentStatus(appointmentId);
      }
      if (studentProfileId != null && studentProfileId.isNotEmpty) {
        return await ConsentApiService.instance.status(
          studentProfileId,
          contextKind: contextKind,
          contextKey: contextKey,
          contextRefId: contextRefId,
        );
      }
    } catch (_) {
      // Sessizce geç: kapı yoksa iş akışı normal işler.
    }
    return null;
  }
}

enum _GateDecision { proceed, openCenter }

class _GateDialog extends StatelessWidget {
  final Map<String, dynamic> status;

  const _GateDialog({required this.status});

  @override
  Widget build(BuildContext context) {
    final required = (status['requiredCount'] as num?)?.toInt() ?? 0;
    final signed = (status['signedCount'] as num?)?.toInt() ?? 0;
    final pending = (status['requirements'] as List?)
            ?.map((e) => Map<String, dynamic>.from(e as Map))
            .where((row) => row['status'] != 'Signed')
            .toList() ??
        const <Map<String, dynamic>>[];

    return AlertDialog(
      title: const Text('Eksik onam formu var'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bu işlem için gereken ${required - signed} form henüz imzalanmadı.'),
          const SizedBox(height: 12),
          ...pending.map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('• ${row['title'] ?? ''}'),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, _GateDecision.proceed),
          child: const Text('İmzasız devam et'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _GateDecision.openCenter),
          child: const Text('Onam formlarını görüntüle'),
        ),
      ],
    );
  }
}
