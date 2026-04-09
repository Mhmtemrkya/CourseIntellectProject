import 'package:flutter/material.dart';

import '../pages/role_select_page.dart';
import '../services/auth_session_store.dart';

Future<void> logoutToRoleSelect(BuildContext context) async {
  await AuthSessionStore.instance.clear();
  if (!context.mounted) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const RoleSelectPage()),
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
