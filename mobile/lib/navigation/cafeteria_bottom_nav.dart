import 'package:flutter/material.dart';

import '../pages/cafeteria_weekly_menu_page.dart';

class CafeteriaBottomNav extends StatelessWidget {
  const CafeteriaBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return const CafeteriaWeeklyMenuPage(canEdit: true);
  }
}
