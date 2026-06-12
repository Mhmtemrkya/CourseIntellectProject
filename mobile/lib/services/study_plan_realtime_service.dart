import 'dart:async';
import 'dart:convert';

import 'package:signalr_netcore/signalr_client.dart';

import 'api_config.dart';
import 'auth_session_store.dart';
import 'study_plan_api_service.dart';

/// Çalışma planı canlı senkronizasyonu. Backend her plan mutasyonunda
/// "studyPlanUpdated" olayını öğrencinin grubuna yayınlar; desktop'ta yapılan
/// değişiklikler mobil ekrana anında düşer (ve tersi).
class StudyPlanRealtimeService {
  StudyPlanRealtimeService._();

  static final StudyPlanRealtimeService instance = StudyPlanRealtimeService._();

  HubConnection? _connection;
  final _updateController = StreamController<StudyPlanStateRecord>.broadcast();

  Stream<StudyPlanStateRecord> get planUpdatedStream =>
      _updateController.stream;

  Future<void> ensureConnected() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) return;

    if (_connection != null &&
        _connection!.state == HubConnectionState.Connected) {
      return;
    }

    _connection ??= HubConnectionBuilder()
        .withUrl(
          '${ApiConfig.baseUrl}/hubs/study-plan',
          options: HttpConnectionOptions(
            accessTokenFactory: () async =>
                (await AuthSessionStore.instance.load())?.accessToken ?? '',
          ),
        )
        .withAutomaticReconnect()
        .build();

    _connection!.on('studyPlanUpdated', (arguments) {
      final payload = arguments?.firstOrNull;
      if (payload is! Map) return;
      try {
        final map = Map<String, dynamic>.from(payload);
        final raw = map['planItemsSerialized'] as String? ?? '[]';
        _updateController.add(
          StudyPlanStateRecord(
            planItems: (jsonDecode(raw) as List<dynamic>)
                .map((item) => Map<String, dynamic>.from(item as Map))
                .toList(),
            streakCount: (map['streakCount'] as num?)?.toInt() ?? 0,
            xpPoints: (map['xpPoints'] as num?)?.toInt() ?? 0,
            lastCompletedAt: DateTime.tryParse(
              map['lastCompletedAt'] as String? ?? '',
            ),
          ),
        );
      } catch (_) {
        // Bozuk yük tek bir güncellemeyi atlar; bağlantı sürer.
      }
    });

    if (_connection!.state != HubConnectionState.Connected) {
      try {
        await _connection!.start();
      } catch (_) {
        // Bağlantı kurulamazsa sayfa açılış/yenilemedeki fetch devrede kalır.
      }
    }
  }

  Future<void> disconnect() async {
    try {
      await _connection?.stop();
    } catch (_) {
      // Kapanış hatası yok sayılır.
    }
  }
}
