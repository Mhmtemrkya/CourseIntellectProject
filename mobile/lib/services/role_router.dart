import 'package:flutter/material.dart';

import '../navigation/accounting_bottom_nav.dart';
import '../navigation/admin_bottom_nav.dart';
import '../navigation/administrative_bottom_nav.dart';
import '../navigation/bottom_nav.dart';
import '../navigation/cafeteria_bottom_nav.dart';
import '../navigation/teacher_bottom_nav.dart';
import '../navigation/veli_bottom_nav.dart';
import 'auth_session_store.dart';

class RoleRouter {
  RoleRouter._();

  static Widget? panelFor(AuthSession session) {
    final candidates = <String>[session.primaryRole, ...session.extraRoles];
    for (final role in candidates) {
      final page = _pageFor(role);
      if (page != null) return page;
    }
    return null;
  }

  static String displayLabel(String role) {
    switch (role) {
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
    switch (role) {
      case 'Student':
        return const BottomNav();
      case 'Parent':
        return const VeliBottomNav();
      case 'Teacher':
        return const TeacherBottomNav();
      case 'Accounting':
        return const AccountingBottomNav();
      case 'Admin':
        return const AdminBottomNav();
      case 'Administrative':
        return const AdministrativeBottomNav();
      case 'Cafeteria':
        return const CafeteriaBottomNav();
      default:
        return null;
    }
  }
}
