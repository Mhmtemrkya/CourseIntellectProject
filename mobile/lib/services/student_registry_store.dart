import 'package:flutter/material.dart';

import 'admin_directory_api_service.dart';
import 'registration_api_service.dart';

class StudentRegistryRecord {
  final String id;
  final String fullName;
  final String tcNo;
  final String className;
  final String currentSchool;
  final String schoolNumber;
  final String birthDate;
  final String programType;
  final String parentName;
  final String parentPhone;
  final String parentEmail;
  final String address;
  final String note;
  final String username;
  final String password;
  final String status;

  const StudentRegistryRecord({
    required this.id,
    required this.fullName,
    required this.tcNo,
    required this.className,
    required this.currentSchool,
    required this.schoolNumber,
    required this.birthDate,
    required this.programType,
    required this.parentName,
    required this.parentPhone,
    required this.parentEmail,
    required this.address,
    required this.note,
    required this.username,
    required this.password,
    required this.status,
  });
}

class StudentLoginCredentials {
  final String username;
  final String password;

  const StudentLoginCredentials({
    required this.username,
    required this.password,
  });
}

class StudentRegistryStore extends ChangeNotifier {
  StudentRegistryStore._() : _restoreFuture = Future<void>.value() {
    _restoreFuture = _restore();
  }

  static final StudentRegistryStore instance = StudentRegistryStore._();

  final List<StudentRegistryRecord> _students = [];
  Future<void> _restoreFuture;

  bool isLoaded = false;

  List<StudentRegistryRecord> get students => List.unmodifiable(_students);

  Future<void> ensureLoaded() => _restoreFuture;

  Future<void> refresh() async {
    await _restore();
  }

  Future<void> _restore() async {
    final items = await AdminDirectoryApiService.instance.fetchStudents();
    _students
      ..clear()
      ..addAll(
        items.map(
          (item) => StudentRegistryRecord(
            id: item.id,
            fullName: item.fullName,
            tcNo: item.tcNo,
            className: item.className,
            currentSchool: item.currentSchool,
            schoolNumber: item.schoolNumber,
            birthDate: item.birthDate,
            programType: item.programType,
            parentName: item.parentName,
            parentPhone: item.parentPhone,
            parentEmail: item.parentEmail,
            address: item.address,
            note: item.note,
            username: item.username,
            password: '',
            status: item.status,
          ),
        ),
      );
    isLoaded = true;
    notifyListeners();
  }

  Future<StudentLoginCredentials> addStudent({
    required String fullName,
    required String tcNo,
    required String className,
    required String currentSchool,
    required String schoolNumber,
    required String birthDate,
    required String programType,
    required String parentName,
    required String parentPhone,
    required String parentEmail,
    required String address,
    required String note,
  }) async {
    final credentials = await RegistrationApiService.instance.createStudent(
      fullName: fullName,
      tcNo: tcNo,
      className: className,
      currentSchool: currentSchool,
      schoolNumber: schoolNumber,
      birthDate: birthDate,
      programType: programType,
      parentName: parentName,
      parentPhone: parentPhone,
      parentEmail: parentEmail,
      address: address,
      note: note,
    );
    await _restore();
    return StudentLoginCredentials(
      username: credentials.username,
      password: credentials.password,
    );
  }

  Future<void> updateStudent({
    required String id,
    required String fullName,
    required String tcNo,
    required String className,
    required String currentSchool,
    required String schoolNumber,
    required String birthDate,
    required String programType,
    required String parentName,
    required String parentPhone,
    required String parentEmail,
    required String address,
    required String note,
  }) async {
    await AdminDirectoryApiService.instance.updateStudent(
      id: id,
      fullName: fullName,
      tcNo: tcNo,
      className: className,
      currentSchool: currentSchool,
      schoolNumber: schoolNumber,
      birthDate: birthDate,
      programType: programType,
      parentName: parentName,
      parentPhone: parentPhone,
      parentEmail: parentEmail,
      address: address,
      note: note,
    );
    await _restore();
  }

  Future<void> deleteStudent(String id) async {
    await AdminDirectoryApiService.instance.deleteStudent(id);
    await _restore();
  }

  bool validateStudentLogin(String username, String password) => false;

  StudentRegistryRecord? findByCredentials(String username, String password) {
    try {
      return _students.firstWhere((student) => student.username == username);
    } catch (_) {
      return null;
    }
  }
}
