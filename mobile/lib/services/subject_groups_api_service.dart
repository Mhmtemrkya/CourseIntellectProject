import 'module_api_client.dart';

/// Zümreler (/api/subject-groups). Yönetim kurum yöneticisi + şube müdürü;
/// öğretmen yalnız üyesi olduğu zümreleri görür.
class SubjectGroupsApiService {
  SubjectGroupsApiService._();
  static final SubjectGroupsApiService instance = SubjectGroupsApiService._();
  final _client = ModuleApiClient.instance;

  Future<Map<String, dynamic>> overview(String academicYear) async =>
      asMap(await _client.get('/api/subject-groups', {'academicYear': academicYear}));

  Future<List<Map<String, dynamic>>> teachers(String academicYear) async =>
      asMapList(await _client.get('/api/subject-groups/teachers', {'academicYear': academicYear}));

  Future<List<Map<String, dynamic>>> mine() async => asMapList(await _client.get('/api/subject-groups/mine'));

  Future<void> save({
    String? id,
    required String subject,
    required String name,
    required String academicYear,
    required String? headTeacherUserId,
    required List<String> memberUserIds,
    required String description,
    required String color,
  }) async {
    final body = {
      'subject': subject,
      'name': name.isEmpty ? null : name,
      'academicYear': academicYear,
      'headTeacherUserId': headTeacherUserId,
      'memberUserIds': memberUserIds,
      'description': description,
      'color': color,
    };
    if (id == null) {
      await _client.post('/api/subject-groups', body);
    } else {
      await _client.put('/api/subject-groups/$id', body);
    }
  }

  Future<void> delete(String id) async => _client.delete('/api/subject-groups/$id');
}
