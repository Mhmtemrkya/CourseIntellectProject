import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
class TypingIndicator extends StatelessWidget {
  final bool typing;

  const TypingIndicator({super.key, required this.typing});

  @override
  Widget build(BuildContext context) {
    if (!typing) return const SizedBox();

    return Padding(
      padding: EdgeInsets.all(8),
      child: Text("Yazıyor...".tr, style: TextStyle(color: Colors.grey)),
    );
  }
}
