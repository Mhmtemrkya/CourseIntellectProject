import 'package:flutter/material.dart';

import '../navigation/accounting_bottom_nav.dart';
import '../navigation/administrative_bottom_nav.dart';
import '../navigation/bottom_nav.dart';
import '../navigation/cafeteria_bottom_nav.dart';
import '../navigation/counselor_bottom_nav.dart';
import '../navigation/teacher_bottom_nav.dart';
import '../navigation/veli_bottom_nav.dart';
import '../pages/branch_select_page.dart';
import '../pages/driver_route_students_page.dart';
import 'auth_session_store.dart';
import 'service_tracking_api_service.dart';

class RoleRouter {
  RoleRouter._();

  static bool isCounselor(AuthSession session) {
    if (_normalizeRole(session.primaryRole) != 'Teacher') return false;
    final branch = session.departmentOrBranch
        .toLowerCase()
        .replaceAll('İ', 'i')
        .replaceAll('ı', 'i');
    return branch.contains('rehberlik');
  }

  static Widget? panelFor(AuthSession session) {
    // Rehberlik branşlı öğretmen kendi paneline yönlenir.
    if (isCounselor(session)) return const CounselorBottomNav();
    final candidates = <String>[session.primaryRole, ...session.extraRoles];
    for (final role in candidates) {
      final page = _pageFor(role);
      if (page != null) return page;
    }
    return null;
  }

  static String displayLabel(String role) {
    switch (_normalizeRole(role)) {
      case 'Student':
        return 'Öğrenci';
      case 'Parent':
        return 'Veli';
      case 'Teacher':
        return 'Öğretmen';
      case 'Accounting':
        return 'Muhasebeci';
      case 'Admin':
        return 'Yönetici';
      case 'Administrative':
        return 'İdari Birimler';
      case 'Cafeteria':
        return 'Yemekhaneci';
      default:
        return role;
    }
  }

  static Widget? _pageFor(String role) {
    switch (_normalizeRole(role)) {
      case 'Student':
        return const BottomNav();
      case 'Parent':
        return const VeliBottomNav();
      case 'Teacher':
        return const TeacherBottomNav();
      case 'Accounting':
        return const AccountingBottomNav();
      case 'Admin':
        return const BranchSelectPage();
      case 'Administrative':
        // Servis şoförleri Administrative rolüyle açılır; aktif şoför
        // kaydı olan kullanıcı yalnızca kendi şoför ekranını görür.
        return const _AdministrativeOrDriverGate();
      case 'Cafeteria':
        return const CafeteriaBottomNav();
      default:
        return null;
    }
  }

  static String _normalizeRole(String role) {
    final value = role.trim().toLowerCase().replaceAll(RegExp(r'[\s_-]+'), '');
    switch (value) {
      case 'admin':
      case 'institutionadmin':
      case 'institutionadministrator':
        return 'Admin';
      case 'administrative':
      case 'idare':
      case 'idari':
      case 'idaripersonel':
      case 'idarîpersonel':
        return 'Administrative';
      case 'teacher':
        return 'Teacher';
      case 'student':
        return 'Student';
      case 'parent':
        return 'Parent';
      case 'accounting':
      case 'accountant':
        return 'Accounting';
      case 'cafeteria':
        return 'Cafeteria';
      default:
        return role;
    }
  }
}

/// Girişte şoför kontrolü: aktif şoför kaydı varsa kullanıcıyı yalnızca
/// şoför ekranına kilitler; yoksa normal idari panel açılır.
class _AdministrativeOrDriverGate extends StatelessWidget {
  const _AdministrativeOrDriverGate();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: ServiceTrackingApiService.instance
          .fetchIsCurrentUserDriver()
          .catchError((_) => false),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return snapshot.data == true
            ? const DriverRouteStudentsPage(standalone: true)
            : const AdministrativeBottomNav();
      },
    );
  }
}
