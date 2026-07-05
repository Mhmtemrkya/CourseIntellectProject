import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../pages/legal_documents_page.dart';

class LegalProfileTile extends StatelessWidget {
  const LegalProfileTile({super.key, this.contentPadding});

  final EdgeInsetsGeometry? contentPadding;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: contentPadding,
      leading: const Icon(Icons.privacy_tip_outlined),
      title: Text('KVKK ve Yasal Metinler'.tr),
      subtitle: Text(
        'Aydınlatma metni, açık rıza, kullanım koşulları ve gizlilik politikası.'.tr,
      ),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LegalDocumentsPage()),
      ),
    );
  }
}
