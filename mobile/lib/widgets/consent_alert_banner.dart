import 'package:flutter/material.dart';

import '../pages/consent_center_page.dart';
import '../services/consent_api_service.dart';

/// Eksik onam formu uyarı şeridi.
///
/// SESSİZ olmak zorunda: kurum hiç şablon tanımlamamışsa ya da eksik yoksa
/// hiçbir şey çizmez (SizedBox.shrink). Onam özelliğini kullanmayan kurumun
/// ekranını kirletmez. Dokununca Onam Merkezi açılır.
class ConsentAlertBanner extends StatefulWidget {
  final String? studentProfileId;
  final String? studentName;
  final String? contextKind;
  final String? contextKey;
  final String? contextRefId;
  final String? contextLabel;

  /// Tamam durumunda da yeşil şerit çizilsin mi?
  final bool showWhenComplete;

  const ConsentAlertBanner({
    super.key,
    required this.studentProfileId,
    this.studentName,
    this.contextKind,
    this.contextKey,
    this.contextRefId,
    this.contextLabel,
    this.showWhenComplete = false,
  });

  @override
  State<ConsentAlertBanner> createState() => _ConsentAlertBannerState();
}

class _ConsentAlertBannerState extends State<ConsentAlertBanner> {
  Map<String, dynamic>? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(ConsentAlertBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.studentProfileId != widget.studentProfileId ||
        oldWidget.contextRefId != widget.contextRefId) {
      _load();
    }
  }

  Future<void> _load() async {
    final id = widget.studentProfileId;
    if (id == null || id.isEmpty) return;
    try {
      final next = await ConsentApiService.instance.status(
        id,
        contextKind: widget.contextKind,
        contextKey: widget.contextKey,
        contextRefId: widget.contextRefId,
      );
      if (mounted) setState(() => _status = next);
    } catch (_) {
      // Onam modülü kurulmamış / yetki yok → şerit hiç görünmez.
      if (mounted) setState(() => _status = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final required = (_status?['requiredCount'] as num?)?.toInt() ?? 0;
    final signed = (_status?['signedCount'] as num?)?.toInt() ?? 0;
    final missing = required - signed;

    if (required == 0) return const SizedBox.shrink();
    if (missing <= 0 && !widget.showWhenComplete) return const SizedBox.shrink();

    final color = missing > 0 ? Colors.amber : Colors.green;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () async {
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ConsentCenterPage(
                  studentProfileId: widget.studentProfileId!,
                  studentName: widget.studentName,
                  contextKind: widget.contextKind,
                  contextKey: widget.contextKey,
                  contextRefId: widget.contextRefId,
                  contextLabel: widget.contextLabel,
                ),
              ),
            );
            await _load();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              border: Border.all(color: color.withValues(alpha: 0.35)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  missing > 0 ? Icons.warning_amber_rounded : Icons.verified_outlined,
                  color: color.shade800,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    missing > 0
                        ? '$missing onam formu imzasız — görüntülemek için dokunun'
                        : 'Tüm onam formları imzalı',
                    style: TextStyle(
                      color: color.shade800,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  '$signed/$required',
                  style: TextStyle(color: color.shade800, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
