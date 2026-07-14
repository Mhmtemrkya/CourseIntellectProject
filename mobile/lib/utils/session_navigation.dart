import 'package:flutter/material.dart';

import '../onboarding/onboarding_store.dart';
import '../pages/login_page.dart';
import '../services/auth_session_store.dart';
import '../services/branch_scope_store.dart';
import '../services/driving_permissions_store.dart';
import '../services/tenant_scope_store.dart';

Future<void> logoutToRoleSelect(BuildContext context) async {
  await AuthSessionStore.instance.clear();
  await BranchScopeStore.instance.clear();
  await TenantScopeStore.instance.clear();
  // Sonraki kullanıcı kendi onboarding durumunu ve izinlerini yüklesin.
  OnboardingStore.instance.resetCache();
  DrivingPermissionsStore.instance.reset();
  if (!context.mounted) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const LoginPage()),
    (route) => false,
  );
}

Future<bool> handleBottomNavBack(
  BuildContext context, {
  required int currentIndex,
  required ValueChanged<int> onSelectRoot,
}) async {
  if (currentIndex == 0) {
    await logoutToRoleSelect(context);
    return false;
  }

  onSelectRoot(0);
  return false;
}
