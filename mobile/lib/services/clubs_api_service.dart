import 'module_api_client.dart';

/// Öğrenci kulüpleri (/api/clubs). Yetki sunucuda: yönetici kulüp açar,
/// danışman öğretmen üye/etkinlik yönetir, öğrenci katılma isteği gönderir.
class ClubsApiService {
  ClubsApiService._();
  static final ClubsApiService instance = ClubsApiService._();
  final _client = ModuleApiClient.instance;

  Future<Map<String, dynamic>> overview(String academicYear) async =>
      asMap(await _client.get('/api/clubs', {'academicYear': academicYear}));
  Future<List<Map<String, dynamic>>> mine() async => asMapList(await _client.get('/api/clubs/mine'));
  Future<List<Map<String, dynamic>>> upcoming() async => asMapList(await _client.get('/api/clubs/activities/upcoming'));
  Future<Map<String, dynamic>> detail(String id) async => asMap(await _client.get('/api/clubs/$id'));
  Future<List<Map<String, dynamic>>> teacherOptions() async => asMapList(await _client.get('/api/clubs/teachers'));
  Future<List<Map<String, dynamic>>> studentOptions(String id, String search) async =>
      asMapList(await _client.get('/api/clubs/$id/student-options', {'search': search}));

  Future<void> save(String? id, Map<String, dynamic> body) async {
    if (id == null) {
      await _client.post('/api/clubs', body);
    } else {
      await _client.put('/api/clubs/$id', body);
    }
  }

  Future<void> delete(String id) async => _client.delete('/api/clubs/$id');
  Future<void> addMember(String id, String studentUserId) async =>
      _client.post('/api/clubs/$id/members', {'studentUserId': studentUserId, 'role': 'Member'});
  Future<void> updateMember(String id, String memberId, String action, {String? role, String? note}) async =>
      _client.put('/api/clubs/$id/members/$memberId', {'action': action, 'role': role, 'note': note});
  Future<void> join(String id, String note) async => _client.post('/api/clubs/$id/join', {'note': note});
  Future<void> leave(String id) async => _client.delete('/api/clubs/$id/join');

  Future<void> saveActivity(String id, String? activityId, Map<String, dynamic> body) async {
    if (activityId == null) {
      await _client.post('/api/clubs/$id/activities', body);
    } else {
      await _client.put('/api/clubs/$id/activities/$activityId', body);
    }
  }

  Future<void> deleteActivity(String id, String activityId) async =>
      _client.delete('/api/clubs/$id/activities/$activityId');
}
