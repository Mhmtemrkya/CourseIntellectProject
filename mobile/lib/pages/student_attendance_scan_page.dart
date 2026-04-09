import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../services/attendance_service.dart';
import '../services/auth_session_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/responsive_layout.dart';

class StudentAttendanceScanPage extends StatefulWidget {
  const StudentAttendanceScanPage({super.key});

  @override
  State<StudentAttendanceScanPage> createState() =>
      _StudentAttendanceScanPageState();
}

class _StudentAttendanceScanPageState extends State<StudentAttendanceScanPage> {
  final MobileScannerController controller = MobileScannerController();
  bool scanned = false;
  String scanStatus = "QR kodu okut ve yoklamani gonder.";
  String? lastPayload;
  String studentName = "Ogrenci";
  String className = "";

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    await StudentRegistryStore.instance.ensureLoaded();
    final session = await AuthSessionStore.instance.load();
    if (!mounted || session == null) return;
    final matchedStudent = StudentRegistryStore.instance.students.where((item) {
      return item.fullName.toLowerCase() == session.fullName.toLowerCase() ||
          item.username.toLowerCase() == session.username.toLowerCase();
    }).cast<StudentRegistryRecord?>().firstOrNull;
    setState(() {
      studentName = session.fullName;
      className = matchedStudent?.className ?? className;
    });
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> _handleDetection(BarcodeCapture capture) async {
    if (scanned) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null || code.isEmpty) return;
    if (!code.startsWith('attendance|')) return;

    setState(() {
      scanned = true;
      lastPayload = code;
      scanStatus = "Yoklama backend'e gonderiliyor...";
    });

    try {
      final payload = _parsePayload(code);
      final lessonClass = payload['class'] ?? className;
      final lesson = payload['lesson'] ?? 'Ders';
      if (lessonClass.isEmpty) {
        throw Exception('QR kaydinda sinif bilgisi bulunamadi.');
      }
      await AttendanceService.instance.saveLessonAttendance(
        className: lessonClass,
        lesson: lesson,
        students: [
          {
            'name': studentName,
            'status': 'present',
          },
        ],
      );
      if (!mounted) return;
      setState(() {
        scanStatus = "$studentName derse katildi. Yoklama basariyla gonderildi.";
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("$studentName derse katildi olarak kaydedildi.")),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        scanned = false;
        scanStatus = "Yoklama kaydedilemedi. QR kodu tekrar okut.";
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Map<String, String> _parsePayload(String payload) {
    final parts = payload.split('|').skip(1);
    final map = <String, String>{};
    for (final part in parts) {
      final separator = part.indexOf(':');
      if (separator <= 0) continue;
      map[part.substring(0, separator)] = part.substring(separator + 1);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text("QR ile Yoklama"),
        actions: [
          IconButton(
            onPressed: () {
              controller.toggleTorch();
            },
            icon: const Icon(Icons.flashlight_on_rounded),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            onDetect: _handleDetection,
          ),
          Positioned.fill(
            child: IgnorePointer(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.26),
                ),
              ),
            ),
          ),
          Builder(builder: (context) {
            final scanSize = ResponsiveLayout.isTablet(context) ? 380.0 : 250.0;
            return Center(
              child: Container(
                width: scanSize,
                height: scanSize,
                decoration: BoxDecoration(
                  border: Border.all(
                    color: scanned ? const Color(0xFF22C55E) : Colors.white,
                    width: 3,
                  ),
                  borderRadius: BorderRadius.circular(28),
                ),
              ),
            );
          }),
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF111827).withValues(alpha: 0.92)
                    : Colors.white.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    scanned ? "Derse Katildiniz" : "Kamera Hazir",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    scanStatus,
                    style: TextStyle(
                      color: isDark ? Colors.white70 : Colors.black87,
                    ),
                  ),
                  if (lastPayload != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      lastPayload!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white54 : Colors.black54,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            setState(() {
                              scanned = false;
                              lastPayload = null;
                              scanStatus =
                                  "QR kodu okut ve yoklamani gonder.";
                            });
                          },
                          child: const Text("Tekrar Tara"),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context);
                          },
                          child: const Text("Tamam"),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
