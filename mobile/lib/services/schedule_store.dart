import 'package:flutter/material.dart';

import 'schedule_api_service.dart';

class ScheduleStore extends ChangeNotifier {
  ScheduleStore._();

  static final ScheduleStore instance = ScheduleStore._();

  bool isLoaded = false;
  bool isLoading = false;
  String? lastError;
  List<ScheduleEntryApiRecord> entries = [];

  Future<void>? _inflight;

  Future<void> ensureLoaded() {
    if (isLoaded) return Future<void>.value();
    return refresh();
  }

  Future<void> refresh() {
    final existing = _inflight;
    if (existing != null) return existing;
    final future = _load();
    _inflight = future;
    future.whenComplete(() => _inflight = null);
    return future;
  }

  Future<void> _load() async {
    isLoading = true;
    lastError = null;
    notifyListeners();
    try {
      entries = await ScheduleApiService.instance.fetchEntries();
      isLoaded = true;
    } catch (error) {
      lastError = error.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<ScheduleEntryApiRecord> createEntry({
    required String className,
    required String day,
    required String time,
    required String subject,
    required String teacher,
    String? room,
  }) async {
    final created = await ScheduleApiService.instance.createEntry(
      className: className,
      day: day,
      time: time,
      subject: subject,
      teacher: teacher,
      room: room,
    );
    await refresh();
    return created;
  }

  Future<ScheduleEntryApiRecord> updateEntry({
    required String id,
    required String className,
    required String day,
    required String time,
    required String subject,
    required String teacher,
    String? room,
  }) async {
    final updated = await ScheduleApiService.instance.updateEntry(
      id: id,
      className: className,
      day: day,
      time: time,
      subject: subject,
      teacher: teacher,
      room: room,
    );
    await refresh();
    return updated;
  }

  Future<void> deleteEntry(String id) async {
    await ScheduleApiService.instance.deleteEntry(id);
    await refresh();
  }

  List<String> get classNames {
    final set = <String>{};
    for (final entry in entries) {
      if (entry.className.isNotEmpty) set.add(entry.className);
    }
    final list = set.toList()..sort();
    return list;
  }

  List<String> get teacherNames {
    final set = <String>{};
    for (final entry in entries) {
      if (entry.teacher.isNotEmpty) set.add(entry.teacher);
    }
    final list = set.toList()..sort();
    return list;
  }

  Map<String, List<ScheduleEntryApiRecord>> groupedByClass({
    String? classFilter,
    String? teacherFilter,
    String? dayFilter,
  }) {
    final filtered = entries.where((entry) {
      if (classFilter != null &&
          classFilter.isNotEmpty &&
          entry.className != classFilter) {
        return false;
      }
      if (teacherFilter != null &&
          teacherFilter.isNotEmpty &&
          entry.teacher != teacherFilter) {
        return false;
      }
      if (dayFilter != null && dayFilter.isNotEmpty && entry.day != dayFilter) {
        return false;
      }
      return true;
    }).toList();

    final map = <String, List<ScheduleEntryApiRecord>>{};
    for (final entry in filtered) {
      map.putIfAbsent(entry.className, () => []).add(entry);
    }
    return map;
  }
}
