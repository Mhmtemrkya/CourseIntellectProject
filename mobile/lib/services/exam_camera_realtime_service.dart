import 'dart:async';

import 'package:signalr_netcore/signalr_client.dart';

import 'api_config.dart';
import 'auth_session_store.dart';

/// Öğretmenin canlı izleme ekranına düşen tek bir kamera karesi.
class ExamCameraFrame {
  final String examId;
  final String studentUsername;
  final String studentName;
  final String frame; // "data:image/jpeg;base64,...."
  final DateTime at;

  ExamCameraFrame({
    required this.examId,
    required this.studentUsername,
    required this.studentName,
    required this.frame,
    required this.at,
  });
}

/// Sınav canlı kamera izleme: öğrenci sınav ekranından periyodik kamera karesi
/// (küçük JPEG) gönderir; aynı planlı sınavı izleyen öğretmen "cameraFrame"
/// olayıyla anında alır. Kareler sunucuda saklanmaz; /hubs/exam-solving
/// üzerinden gerçek zamanlı iletilir.
class ExamCameraRealtimeService {
  ExamCameraRealtimeService._();

  static final ExamCameraRealtimeService instance =
      ExamCameraRealtimeService._();

  HubConnection? _connection;
  bool _handlerBound = false;
  final _frameController = StreamController<ExamCameraFrame>.broadcast();

  Stream<ExamCameraFrame> get frameStream => _frameController.stream;

  Future<HubConnection?> _ensureConnected() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) return null;

    if (_connection != null &&
        _connection!.state == HubConnectionState.Connected) {
      return _connection;
    }

    _connection ??= HubConnectionBuilder()
        .withUrl(
          '${ApiConfig.baseUrl}/hubs/exam-solving',
          options: HttpConnectionOptions(
            accessTokenFactory: () async =>
                (await AuthSessionStore.instance.load())?.accessToken ?? '',
          ),
        )
        .withAutomaticReconnect()
        .build();

    if (!_handlerBound) {
      _handlerBound = true;
      _connection!.on('cameraFrame', (arguments) {
        final payload = arguments?.firstOrNull;
        if (payload is! Map) return;
        try {
          final map = Map<String, dynamic>.from(payload);
          final frame = map['frame']?.toString() ?? '';
          if (frame.isEmpty) return;
          _frameController.add(
            ExamCameraFrame(
              examId: map['examId']?.toString() ?? '',
              studentUsername: map['studentUsername']?.toString() ?? '',
              studentName: map['studentName']?.toString() ?? '',
              frame: frame,
              at:
                  DateTime.tryParse(map['atUtc']?.toString() ?? '')?.toLocal() ??
                  DateTime.now(),
            ),
          );
        } catch (_) {
          // Bozuk kare tek bir güncellemeyi atlar; bağlantı sürer.
        }
      });
    }

    if (_connection!.state != HubConnectionState.Connected) {
      try {
        await _connection!.start();
      } catch (_) {
        return null;
      }
    }
    return _connection;
  }

  /// Öğrenci: tek bir kamera karesini yayınlar.
  Future<void> publishFrame(
    String examId,
    String username,
    String name,
    String frame,
  ) async {
    if (examId.isEmpty || frame.isEmpty) return;
    final connection = await _ensureConnected();
    if (connection == null) return;
    try {
      await connection.invoke(
        'PublishCameraFrame',
        args: [examId, username, name, frame],
      );
    } catch (_) {
      // Kare gönderilemezse bir sonraki denemede tekrar gönderilir.
    }
  }

  /// Öğretmen: bir planlı sınavın canlı kamera akışına katılır.
  Future<void> joinMonitor(String examId) async {
    final connection = await _ensureConnected();
    if (connection == null || examId.isEmpty) return;
    try {
      await connection.invoke('JoinExamMonitor', args: [examId]);
    } catch (_) {
      // bağlantı kurulamazsa abonelik yerelde kalır
    }
  }

  Future<void> leaveMonitor(String examId) async {
    if (_connection?.state != HubConnectionState.Connected || examId.isEmpty) {
      return;
    }
    try {
      await _connection!.invoke('LeaveExamMonitor', args: [examId]);
    } catch (_) {
      // yoksay
    }
  }
}
