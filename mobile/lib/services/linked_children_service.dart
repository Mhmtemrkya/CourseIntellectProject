import 'auth_session_store.dart';
import 'student_registry_store.dart';

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
    await StudentRegistryStore.instance.ensureLoaded();

    final students = StudentRegistryStore.instance.students;
    if (students.isEmpty) {
      return const [];
    }

    if (session == null) {
      return _mapRecords(students.take(2));
    }

    final sessionTokens = _tokens(session.fullName);
    final sessionUsername = session.username.toLowerCase();
    final sessionSurname = _surname(session.fullName);

    final linked = students.where((student) {
      final parentTokens = _tokens(student.parentName);
      final tokenMatch = sessionTokens.any(parentTokens.contains);
      final usernameMatch = student.parentEmail.toLowerCase().contains(
        sessionUsername,
      );
      final surnameMatch =
          sessionSurname.isNotEmpty &&
          _surname(student.parentName).toLowerCase() ==
              sessionSurname.toLowerCase();
      return tokenMatch || usernameMatch || surnameMatch;
    }).toList();

    final resolved = linked.isNotEmpty
        ? linked
        : _fallbackStudents(session, students);

    return _mapRecords(resolved);
  }

  List<StudentRegistryRecord> _fallbackStudents(
    AuthSession session,
    List<StudentRegistryRecord> students,
  ) {
    final sessionSurname = _surname(session.fullName);
    if (sessionSurname.isNotEmpty) {
      final surnameMatches = students
          .where(
            (student) =>
                _surname(student.parentName).toLowerCase() ==
                sessionSurname.toLowerCase(),
          )
          .toList();
      if (surnameMatches.isNotEmpty) {
        return surnameMatches;
      }
    }

    if (session.username.isNotEmpty) {
      final usernameMatches = students
          .where(
            (student) => student.parentEmail.toLowerCase().contains(
              session.username.toLowerCase(),
            ),
          )
          .toList();
      if (usernameMatches.isNotEmpty) {
        return usernameMatches;
      }
    }

    return students.take(2).toList();
  }

  List<LinkedChildRecord> _mapRecords(
    Iterable<StudentRegistryRecord> students,
  ) {
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

  String _surname(String value) {
    final parts = value
        .trim()
        .split(RegExp(r'\s+'))
        .where((item) => item.isNotEmpty)
        .toList();
    return parts.isEmpty ? '' : parts.last;
  }

  List<String> _tokens(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9çğıöşü\\s]'), ' ')
        .split(RegExp(r'\\s+'))
        .where((item) => item.isNotEmpty)
        .toList();
  }
}
