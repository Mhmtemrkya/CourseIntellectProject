import 'auth_session_store.dart';
import 'admin_directory_api_service.dart';

class LinkedChildRecord {
  final String fullName;
  final String username;
  final String className;
  final String parentName;
  final String parentEmail;

  const LinkedChildRecord({
    required this.fullName,
    required this.username,
    required this.className,
    required this.parentName,
    required this.parentEmail,
  });

  String get displayLabel => '$fullName • $className';
}

class LinkedChildrenService {
  LinkedChildrenService._();

  static final LinkedChildrenService instance = LinkedChildrenService._();

  Future<List<LinkedChildRecord>> loadLinkedChildren() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.primaryRole != 'Parent') {
      return const [];
    }
    // The server restricts /api/students to the authenticated parent's children.
    // Never reuse the administrator's in-memory directory or guess by surname.
    final students = await AdminDirectoryApiService.instance.fetchStudents();
    final current = await AuthSessionStore.instance.load();
    if (current == null ||
        current.username != session.username ||
        current.tenantId != session.tenantId ||
        current.primaryRole != session.primaryRole) {
      return const [];
    }
    return _mapRecords(students);
  }

  List<LinkedChildRecord> _mapRecords(Iterable<AdminStudentRecord> students) {
    return students
        .map(
          (student) => LinkedChildRecord(
            fullName: student.fullName,
            username: student.username,
            className: student.className,
            parentName: student.parentName,
            parentEmail: student.parentEmail,
          ),
        )
        .toList();
  }
}
