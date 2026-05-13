import 'dart:async';

import 'package:flutter/material.dart';
import 'package:student/pages/change_password_page.dart';
import 'package:student/services/auth_api_service.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/branding_service.dart';
import 'package:student/services/live_notification_bridge.dart';
import 'package:student/services/pkce_login_service.dart';
import 'package:student/services/remote_push_service.dart';
import 'package:student/services/role_router.dart';
import 'package:student/theme_provider.dart';
import 'package:student/widgets/course_intellect_logo.dart';
import 'package:student/widgets/notification_primer_sheet.dart';
import 'package:provider/provider.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();

  bool isLoading = false;

  void login() async {
    final username = usernameController.text.trim();
    final password = passwordController.text.trim();

    setState(() {
      isLoading = true;
    });

    try {
      final session = await AuthApiService.instance.login(
        username: username,
        password: password,
      );
      await _handleSuccessfulSession(session);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().isNotEmpty
                ? error.toString().replaceFirst('Exception: ', '')
                : 'Backend bağlantısı kurulamadı. Sunucunun açık olduğundan emin ol.',
          ),
        ),
      );
    }

    if (!mounted) return;
    setState(() {
      isLoading = false;
    });
  }

  Future<void> loginWithBrowser() async {
    setState(() {
      isLoading = true;
    });

    try {
      final session = await PkceLoginService.instance.loginWithBrowser();
      await _handleSuccessfulSession(session);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }

    if (!mounted) return;
    setState(() {
      isLoading = false;
    });
  }

  Future<void> _handleSuccessfulSession(AuthSession session) async {
    if (!mounted) return;

    final themeProvider = context.read<ThemeProvider>();
    await BrandingService.instance.applyBranding(themeProvider);
    if (!mounted) return;
    await NotificationPrimer.showIfFirstTime(context);
    if (!mounted) return;
    _openRolePanel(session);
    unawaited(LiveNotificationBridge.instance.startForCurrentSession());
    unawaited(RemotePushService.instance.refreshRegistration());
  }

  void _openRolePanel(AuthSession session) {
    if (session.mustChangePassword) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ChangePasswordPage(
            forceMode: true,
            onSuccess: () {
              final page = RoleRouter.panelFor(session);
              if (page == null) {
                _showUnsupportedRole(session);
                return;
              }
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => page),
              );
            },
          ),
        ),
      );
      return;
    }
    final page = RoleRouter.panelFor(session);
    if (page == null) {
      _showUnsupportedRole(session);
      return;
    }
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => page));
  }

  void _showUnsupportedRole(AuthSession session) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${RoleRouter.displayLabel(session.primaryRole)} rolü için mobil panel bulunamadı.',
        ),
      ),
    );
  }

  void _quickLogin(_QuickLoginAccount account) {
    if (isLoading) return;
    usernameController.text = account.username;
    passwordController.text = account.password;
    login();
  }

  @override
  void dispose() {
    usernameController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isDark
                ? const [Color(0xFF0A1017), Color(0xFF0F172A)]
                : const [Color(0xFFF7FBFF), Color(0xFFEAF3FA)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 16),
                const Center(
                  child: CourseIntellectLogo(scale: 0.86, compact: true),
                ),
                const SizedBox(height: 24),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(
                          alpha: isDark ? 0.22 : 0.06,
                        ),
                        blurRadius: 22,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Giriş Yap",
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'CourseIntellect hesabınla giriş yap; panelin rolüne göre otomatik açılır.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.textTheme.bodyMedium?.color?.withValues(
                            alpha: 0.72,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _quickLoginAccounts
                            .map(
                              (account) => ActionChip(
                                avatar: Icon(account.icon, size: 18),
                                label: Text(account.label),
                                onPressed: isLoading
                                    ? null
                                    : () => _quickLogin(account),
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 22),
                      const Text("Kullanıcı Adı"),
                      const SizedBox(height: 8),
                      TextField(
                        controller: usernameController,
                        keyboardType: TextInputType.visiblePassword,
                        textCapitalization: TextCapitalization.none,
                        autocorrect: false,
                        enableSuggestions: false,
                        smartDashesType: SmartDashesType.disabled,
                        smartQuotesType: SmartQuotesType.disabled,
                        autofillHints: const [AutofillHints.username],
                        decoration: InputDecoration(
                          hintText: "Kullanıcı adınızı girin",
                          filled: true,
                          fillColor: theme.scaffoldBackgroundColor.withValues(
                            alpha: 0.65,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text("Şifre"),
                      const SizedBox(height: 8),
                      TextField(
                        controller: passwordController,
                        obscureText: true,
                        textCapitalization: TextCapitalization.none,
                        autocorrect: false,
                        enableSuggestions: false,
                        smartDashesType: SmartDashesType.disabled,
                        smartQuotesType: SmartQuotesType.disabled,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => login(),
                        decoration: InputDecoration(
                          hintText: "Şifrenizi girin",
                          filled: true,
                          fillColor: theme.scaffoldBackgroundColor.withValues(
                            alpha: 0.65,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 30),
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton(
                          onPressed: isLoading ? null : login,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0B4768),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                          ),
                          child: isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.2,
                                  ),
                                )
                              : const Text("Giriş Yap"),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: OutlinedButton.icon(
                          onPressed: isLoading ? null : loginWithBrowser,
                          icon: const Icon(Icons.open_in_browser_rounded),
                          label: const Text('Tarayıcı ile Giriş Yap'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF0B4768),
                            side: const BorderSide(
                              color: Color(0xFF0B4768),
                              width: 1.4,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickLoginAccount {
  final String label;
  final String username;
  final String password;
  final IconData icon;

  const _QuickLoginAccount({
    required this.label,
    required this.username,
    required this.password,
    required this.icon,
  });
}

const _quickLoginAccounts = <_QuickLoginAccount>[
  _QuickLoginAccount(
    label: 'Öğrenci',
    username: 'ali10a241',
    password: 'ALI2026A',
    icon: Icons.school_outlined,
  ),
  _QuickLoginAccount(
    label: 'Veli',
    username: 'veli.ayse',
    password: 'VLI2026A',
    icon: Icons.family_restroom_outlined,
  ),
  _QuickLoginAccount(
    label: 'Öğretmen',
    username: 'ogrt.hasan',
    password: 'HYN2026A',
    icon: Icons.menu_book_outlined,
  ),
  _QuickLoginAccount(
    label: 'Muhasebe',
    username: 'muhasebe.selim',
    password: 'MHS2026A',
    icon: Icons.calculate_outlined,
  ),
  _QuickLoginAccount(
    label: 'İdari',
    username: 'idari.ceren',
    password: 'CRN2026B',
    icon: Icons.apartment_outlined,
  ),
  _QuickLoginAccount(
    label: 'Yönetici',
    username: 'kurum.admin',
    password: 'KRM2026A',
    icon: Icons.admin_panel_settings_outlined,
  ),
];
