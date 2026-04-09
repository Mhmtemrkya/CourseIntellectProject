import 'dart:async';

import 'package:signalr_netcore/signalr_client.dart';

import 'api_config.dart';
import 'auth_session_store.dart';

class MessageRealtimeService {
  MessageRealtimeService._();

  static final MessageRealtimeService instance = MessageRealtimeService._();

  HubConnection? _connection;
  final _threadController = StreamController<Map<String, dynamic>>.broadcast();
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _messageStatusController = StreamController<Map<String, dynamic>>.broadcast();
  final _presenceController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final Set<String> _joinedThreads = <String>{};
  final Set<String> _presenceKeys = <String>{};

  Stream<Map<String, dynamic>> get threadUpdatedStream => _threadController.stream;
  Stream<Map<String, dynamic>> get messageReceivedStream => _messageController.stream;
  Stream<Map<String, dynamic>> get messageStatusChangedStream => _messageStatusController.stream;
  Stream<Map<String, dynamic>> get presenceChangedStream => _presenceController.stream;
  Stream<Map<String, dynamic>> get typingChangedStream => _typingController.stream;

  bool get isConnected => _connection?.state == HubConnectionState.Connected;

  Future<void> ensureConnected() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) return;

    if (_connection != null && _connection!.state == HubConnectionState.Connected) {
      return;
    }

    _connection ??= HubConnectionBuilder()
        .withUrl(
          '${ApiConfig.baseUrl}/hubs/messages',
          options: HttpConnectionOptions(
            accessTokenFactory: () async => (await AuthSessionStore.instance.load())?.accessToken ?? '',
          ),
        )
        .withAutomaticReconnect()
        .build();

    _connection!.onreconnected(({String? connectionId}) {
      for (final threadId in _joinedThreads) {
        _connection!.invoke('JoinThread', args: [threadId]).catchError((_) => null);
      }
      for (final actorKey in _presenceKeys) {
        _connection!.invoke('SubscribePresence', args: [actorKey]).catchError((_) => null);
      }
    });

    _connection!.on('threadUpdated', (arguments) {
      final payload = _firstMap(arguments);
      if (payload != null) {
        _threadController.add(payload);
      }
    });

    _connection!.on('messageReceived', (arguments) {
      final payload = _firstMap(arguments);
      if (payload != null) {
        _messageController.add(payload);
      }
    });

    _connection!.on('messageStatusChanged', (arguments) {
      final payload = _firstMap(arguments);
      if (payload != null) {
        _messageStatusController.add(payload);
      }
    });

    _connection!.on('presenceChanged', (arguments) {
      final payload = _firstMap(arguments);
      if (payload != null) {
        _presenceController.add(payload);
      }
    });

    _connection!.on('typingChanged', (arguments) {
      final payload = _firstMap(arguments);
      if (payload != null) {
        _typingController.add(payload);
      }
    });

    if (_connection!.state == HubConnectionState.Disconnected) {
      await _connection!.start();
    }
  }

  Future<void> joinThread(String? threadId) async {
    if (threadId == null || threadId.isEmpty) return;
    await ensureConnected();
    _joinedThreads.add(threadId);
    if (_connection?.state == HubConnectionState.Connected) {
      try {
        await _connection!.invoke('JoinThread', args: [threadId]);
      } catch (_) {}
    }
  }

  Future<void> leaveThread(String? threadId) async {
    if (threadId == null || threadId.isEmpty) return;
    _joinedThreads.remove(threadId);
    if (_connection?.state == HubConnectionState.Connected) {
      try {
        await _connection!.invoke('LeaveThread', args: [threadId]);
      } catch (_) {}
    }
  }

  Future<void> subscribePresence(String? actorKey) async {
    if (actorKey == null || actorKey.trim().isEmpty) return;
    final normalized = actorKey.trim().toLowerCase();
    await ensureConnected();
    _presenceKeys.add(normalized);
    if (_connection?.state == HubConnectionState.Connected) {
      try {
        await _connection!.invoke('SubscribePresence', args: [normalized]);
      } catch (_) {}
    }
  }

  Future<void> unsubscribePresence(String? actorKey) async {
    if (actorKey == null || actorKey.trim().isEmpty) return;
    final normalized = actorKey.trim().toLowerCase();
    _presenceKeys.remove(normalized);
    if (_connection?.state == HubConnectionState.Connected) {
      try {
        await _connection!.invoke('UnsubscribePresence', args: [normalized]);
      } catch (_) {}
    }
  }

  Future<void> setTyping({
    required String? threadId,
    required String actorName,
    required bool isTyping,
  }) async {
    if (threadId == null || threadId.isEmpty) return;
    await ensureConnected();
    if (_connection?.state != HubConnectionState.Connected) return;
    try {
      await _connection!.invoke(isTyping ? 'TypingStart' : 'TypingStop', args: [threadId, actorName]);
    } catch (_) {}
  }

  Map<String, dynamic>? _firstMap(List<Object?>? arguments) {
    if (arguments == null || arguments.isEmpty) return null;
    final first = arguments.first;
    if (first is Map) {
      return Map<String, dynamic>.from(first);
    }
    return null;
  }
}
