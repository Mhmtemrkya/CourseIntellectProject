import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../pages/account_deletion_page.dart';

/// Profil/Ayarlar ekranlarında "Hesabımı Sil" girişi. Tüm rollerde gösterilir
/// (App Store 5.1.1(v): uygulama içi hesap silme erişilebilir olmalı).
class AccountDeletionTile extends StatelessWidget {
  const AccountDeletionTile({super.key, this.contentPadding});

  final EdgeInsetsGeometry? contentPadding;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: contentPadding,
      leading: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
      title: Text('Hesabımı Sil'.tr),
      subtitle: Text('Hesabınızı ve kişisel verilerinizi kalıcı olarak silin.'.tr),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AccountDeletionPage()),
      ),
    );
  }
}
