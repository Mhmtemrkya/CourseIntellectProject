import 'package:flutter/material.dart';

import 'admin_directory_api_service.dart';
import 'registration_api_service.dart';

class StaffRegistryRecord {
  final String id;
  final String fullName;
  final String roleType;
  final String branchOrDepartment;
  final String tcNo;
  final String phone;
  final String email;
  final String education;
  final String startDate;
  final String campus;
  final String homeroomClass;
  final List<String> assignedClasses;
  final String maritalStatus;
  final int childCount;
  final String note;
  final String username;
  final String password;
  final String status;
  final List<String> extraRoles;
  final List<Map<String, String>> roleHistory;

  const StaffRegistryRecord({
    required this.id,
    required this.fullName,
    required this.roleType,
    required this.branchOrDepartment,
    required this.tcNo,
    required this.phone,
    required this.email,
    required this.education,
    required this.startDate,
    required this.campus,
    required this.homeroomClass,
    required this.assignedClasses,
    required this.maritalStatus,
    required this.childCount,
    required this.note,
    required this.username,
    required this.password,
    required this.status,
    this.extraRoles = const [],
    this.roleHistory = const [],
  });
}

class StaffLoginCredentials {
  final String username;
  final String password;

  const StaffLoginCredentials({required this.username, required this.password});
}

class StaffRegistryStore extends ChangeNotifier {
  StaffRegistryStore._() : _restoreFuture = Future<void>.value() {
    _restoreFuture = _restore();
  }

  static final StaffRegistryStore instance = StaffRegistryStore._();

  final List<StaffRegistryRecord> _staff = [];
  Future<void> _restoreFuture;

  bool isLoaded = false;

  List<StaffRegistryRecord> get staff => List.unmodifiable(_staff);
  List<StaffRegistryRecord> get teachers =>
      staff.where((item) => item.roleType == 'Öğretmen').toList();
  List<StaffRegistryRecord> get personnel =>
      staff.where((item) => item.roleType != 'Öğretmen').toList();

  Future<void> ensureLoaded() => _restoreFuture;

  Future<void> refresh() async {
    await _restore();
  }

  Future<void> _restore() async {
    final items = await AdminDirectoryApiService.instance.fetchStaff();
    _staff
      ..clear()
      ..addAll(items.map(_fromRemote));
    isLoaded = true;
    notifyListeners();
  }

  StaffRegistryRecord _fromRemote(AdminStaffRecord item) {
    return StaffRegistryRecord(
      id: item.id,
      fullName: item.fullName,
      roleType: _mapRole(item.role),
      branchOrDepartment: item.departmentOrBranch,
      tcNo: item.tcNo,
      phone: item.phone,
      email: item.email,
      education: item.education,
      startDate: item.startDate,
      campus: item.campus,
      homeroomClass: item.homeroomClass.isEmpty
          ? 'Sınıf öğretmenliği yok'
          : item.homeroomClass,
      assignedClasses: item.assignedClasses,
      maritalStatus: item.maritalStatus.isEmpty
          ? 'Belirtilmedi'
          : item.maritalStatus,
      childCount: item.childCount,
      note: item.note,
      username: item.username,
      password: '',
      status: item.status,
      extraRoles: item.extraRoles,
      roleHistory: const [],
    );
  }

  Future<StaffLoginCredentials> addStaff({
    required String fullName,
    required String roleType,
    required String branchOrDepartment,
    required String tcNo,
    required String phone,
    required String email,
    required String education,
    required String startDate,
    required String campus,
    required String homeroomClass,
    required List<String> assignedClasses,
    required String maritalStatus,
    required int childCount,
    required String note,
  }) async {
    final credentials = await RegistrationApiService.instance.createStaff(
      fullName: fullName,
      role: _mapRoleToApi(roleType),
      departmentOrBranch: branchOrDepartment,
      tcNo: tcNo,
      phone: phone,
      email: email,
      education: education,
      startDate: startDate,
      campus: campus,
      homeroomClass: homeroomClass,
      assignedClasses: assignedClasses,
      maritalStatus: maritalStatus,
      childCount: childCount,
      note: note,
    );
    await _restore();
    return StaffLoginCredentials(
      username: credentials.username,
      password: credentials.password,
    );
  }

  Future<void> updateStaff({
    required String id,
    required String fullName,
    required String branchOrDepartment,
    required String phone,
    required String email,
    required String education,
    required String campus,
    required String homeroomClass,
    required List<String> assignedClasses,
    required String maritalStatus,
    required int childCount,
    required String note,
  }) async {
    await AdminDirectoryApiService.instance.updateStaff(
      id: id,
      fullName: fullName,
      departmentOrBranch: branchOrDepartment,
      phone: phone,
      email: email,
      education: education,
      campus: campus,
      homeroomClass: homeroomClass,
      assignedClasses: assignedClasses,
      maritalStatus: maritalStatus,
      childCount: childCount,
      note: note,
    );
    await _restore();
  }

  Future<void> updateStatus({
    required String username,
    required String status,
  }) async {
    await AdminDirectoryApiService.instance.updateUserStatus(
      username: username,
      isActive: status == 'Aktif' || status == 'Active',
    );
    await _restore();
  }

  Future<void> updateRoleAssignment({
    required String username,
    required String roleType,
    required String branchOrDepartment,
  }) async {
    await AdminDirectoryApiService.instance.assignPrimaryRole(
      username: username,
      primaryRole: _mapRoleToApi(roleType),
      departmentOrBranch: branchOrDepartment,
    );
    await _restore();
  }

  Future<void> addExtraRole({
    required String username,
    required String roleName,
  }) async {
    await AdminDirectoryApiService.instance.addExtraRole(
      username: username,
      roleName: _mapRoleToApi(roleName),
    );
    await _restore();
  }

  Future<bool> undoLastRoleAssignment({required String username}) async {
    final success = await AdminDirectoryApiService.instance
        .undoLastRoleAssignment(username: username);
    await _restore();
    return success;
  }

  String _mapRole(String role) {
    switch (role) {
      case 'Teacher':
        return 'Öğretmen';
      case 'Administrative':
        return 'Personel';
      case 'Cafeteria':
        return 'Yemekhaneci';
      case 'Accounting':
        return 'Muhasebeci';
      default:
        return role;
    }
  }

  String _mapRoleToApi(String role) {
    switch (role) {
      case 'Öğretmen':
        return 'Teacher';
      case 'Personel':
      case 'İdari Birimler':
        return 'Administrative';
      case 'Muhasebeci':
        return 'Accounting';
      case 'Yemekhaneci':
        return 'Cafeteria';
      default:
        return role;
    }
  }
}
