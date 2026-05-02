// ignore_for_file: deprecated_member_use
import 'dart:async';

import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/system_status_api_service.dart';

/// Mobil uygulama için bakım gate'i.
/// Login olmuş + platform admin değil → MaintenanceScreen.
/// Public/login ekranı bakımdayken de açılabilir; backend zaten girişi reddediyor.
class MaintenanceGate extends StatefulWidget {
  const MaintenanceGate({super.key, required this.child});

  final Widget child;

  @override
  State<MaintenanceGate> createState() => _MaintenanceGateState();
}

class _MaintenanceGateState extends State<MaintenanceGate> {
  static const Duration _pollInterval = Duration(seconds: 30);

  final SystemStatusApiService _api = SystemStatusApiService();
  SystemStatus _status = SystemStatus.normal;
  AuthSession? _session;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(_pollInterval, (_) => _refresh());
  }

  Future<void> _refresh() async {
    final session = await AuthSessionStore.instance.load();
    final next = await _api.fetchStatus();
    if (mounted) {
      setState(() {
        _session = session;
        _status = next;
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final maintenanceActive = _status.maintenanceMode;
    final isPlatformAdmin = _session?.isPlatformAdmin ?? false;
    final hasSession = _session != null;

    if (maintenanceActive && hasSession && !isPlatformAdmin) {
      return _MaintenanceScreen(
        message: _status.maintenanceMessage,
        since: _status.maintenanceSinceUtc,
        onRetry: _refresh,
        onLogout: () async {
          await AuthSessionStore.instance.clear();
        },
      );
    }
    return widget.child;
  }
}

class _MaintenanceScreen extends StatelessWidget {
  const _MaintenanceScreen({
    required this.message,
    required this.since,
    required this.onRetry,
    required this.onLogout,
  });

  final String? message;
  final DateTime? since;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    final navy = const Color(0xFF021622);
    final orange = const Color(0xFFD9790B);
    final warm = const Color(0xFFFBB971);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: navy,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 1,
                          color: orange,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'SİSTEM · BAKIM',
                          style: TextStyle(
                            fontSize: 11,
                            color: warm,
                            letterSpacing: 4,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: orange.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: orange.withOpacity(0.35)),
                      ),
                      child: Icon(Icons.build_outlined, color: warm, size: 28),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Sistem şu anda bakımda',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.5,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      message?.isNotEmpty == true
                          ? message!
                          : 'CourseIntellect platformu kısa bir süreliğine bakımda. Servis kısa sürede yeniden açılacak.',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.65),
                        fontSize: 15,
                        height: 1.5,
                      ),
                    ),
                    if (since != null) ...[
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.04),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.white.withOpacity(0.1)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.access_time,
                                size: 14, color: Colors.white.withOpacity(0.6)),
                            const SizedBox(width: 6),
                            Text(
                              'Başlangıç: ${since!.toLocal()}',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.6),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 28),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => onRetry(),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Yeniden dene'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: orange,
                              foregroundColor: const Color(0xFF00354F),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => onLogout(),
                            icon: const Icon(Icons.logout, size: 18),
                            label: const Text('Çıkış'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white.withOpacity(0.85),
                              side: BorderSide(color: Colors.white.withOpacity(0.15)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.06),
                        border: Border.all(
                            color: const Color(0xFF10B981).withOpacity(0.2)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.shield_outlined,
                              size: 18, color: Color(0xFF34D399)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Verileriniz güvende. Bakım yalnızca girişleri kapatır; veri kaybı yaşanmaz.',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.7),
                                fontSize: 12,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
