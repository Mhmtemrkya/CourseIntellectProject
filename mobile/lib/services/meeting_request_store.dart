import 'package:flutter/material.dart';

import 'meeting_request_api_service.dart';

class MeetingRequestRecord {
  final String id;
  final String parentName;
  final String studentName;
  final String advisor;
  final String topic;
  final String slot;
  final bool onlineMeeting;
  final String note;
  String status;

  MeetingRequestRecord({
    required this.id,
    required this.parentName,
    required this.studentName,
    required this.advisor,
    required this.topic,
    required this.slot,
    required this.onlineMeeting,
    required this.note,
    required this.status,
  });

  factory MeetingRequestRecord.fromApi(MeetingRequestApiRecord item) {
    return MeetingRequestRecord(
      id: item.id,
      parentName: item.parentName,
      studentName: item.studentName,
      advisor: item.advisor,
      topic: item.topic,
      slot: item.slot,
      onlineMeeting: item.onlineMeeting,
      note: item.note,
      status: item.status,
    );
  }
}

class ParentMeetingNotification {
  final String parentName;
  final String title;
  final String detail;
  final String time;

  const ParentMeetingNotification({
    required this.parentName,
    required this.title,
    required this.detail,
    required this.time,
  });
}

class MeetingRequestStore extends ChangeNotifier {
  MeetingRequestStore._() : _restoreFuture = Future<void>.value() {
    _restoreFuture = _restore();
  }

  static final MeetingRequestStore instance = MeetingRequestStore._();

  Future<void> _restoreFuture;
  bool isLoaded = false;
  List<MeetingRequestRecord> requests = [];
  List<ParentMeetingNotification> parentNotifications = [];

  Future<void> ensureLoaded() => _restoreFuture;

  Future<void> refresh({String? advisor, String? parentName}) async {
    await _restore(advisor: advisor, parentName: parentName);
  }

  Future<void> _restore({String? advisor, String? parentName}) async {
    final items = await MeetingRequestApiService.instance.fetchRequests(
      advisor: advisor,
      parentName: parentName,
    );
    requests = items.map(MeetingRequestRecord.fromApi).toList();
    parentNotifications = requests
        .where((item) => item.status != 'Bekliyor')
        .map(
          (item) => ParentMeetingNotification(
            parentName: item.parentName,
            title: item.status == 'Onaylandı'
                ? 'Görüşme talebi onaylandı'
                : 'Görüşme talebi güncellendi',
            detail: item.status == 'Onaylandı'
                ? '${item.advisor} ile ${item.slot} için ${item.onlineMeeting ? 'online' : 'yüz yüze'} görüşme onaylandı.'
                : '${item.advisor} için seçilen slot uygun bulunmadı. Lütfen yeni zaman seçin.',
            time: 'Bugün',
          ),
        )
        .toList();
    isLoaded = true;
    notifyListeners();
  }

  List<MeetingRequestRecord> requestsForAdvisor(String advisor) {
    return requests.where((item) => item.advisor == advisor).toList();
  }

  List<ParentMeetingNotification> notificationsForParent(String parentName) {
    return parentNotifications
        .where((item) => item.parentName == parentName)
        .toList();
  }

  Future<void> createRequest({
    required String parentName,
    required String studentName,
    required String advisor,
    required String topic,
    required String slot,
    required bool onlineMeeting,
    required String note,
  }) async {
    await MeetingRequestApiService.instance.createRequest(
      parentName: parentName,
      studentName: studentName,
      advisor: advisor,
      topic: topic,
      slot: slot,
      onlineMeeting: onlineMeeting,
      note: note,
    );
    await _restore(parentName: parentName);
  }

  Future<void> approveRequest(MeetingRequestRecord request) async {
    await MeetingRequestApiService.instance.updateStatus(
      id: request.id,
      status: 'Onaylandı',
    );
    await _restore(advisor: request.advisor);
  }

  Future<void> rejectRequest(MeetingRequestRecord request) async {
    await MeetingRequestApiService.instance.updateStatus(
      id: request.id,
      status: 'Reddedildi',
    );
    await _restore(advisor: request.advisor);
  }
}
