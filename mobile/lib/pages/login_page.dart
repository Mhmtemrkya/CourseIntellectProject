import 'dart:async';

import 'package:flutter/material.dart';
import 'package:student/navigation/admin_bottom_nav.dart';
import 'package:student/navigation/accounting_bottom_nav.dart';
import 'package:student/navigation/administrative_bottom_nav.dart';
import 'package:student/navigation/bottom_nav.dart';
import 'package:student/navigation/teacher_bottom_nav.dart';
import 'package:student/navigation/veli_bottom_nav.dart';
import 'package:student/services/app_env.dart';
import 'package:student/services/auth_api_service.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/branding_service.dart';
import 'package:student/services/live_notification_bridge.dart';
import 'package:student/services/remote_push_service.dart';
import 'package:student/theme_provider.dart';
import 'package:student/widgets/course_intellect_logo.dart';
import 'package:provider/provider.dart';

class LoginPage extends StatefulWidget {
  final String role;

  const LoginPage({super.key, required this.role});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();

  bool isLoading = false;

  Map<String, String>? get _demoCredentials {
    if (!AppEnv.allowDemoCredentials) return null;
    switch (widget.role) {
      case "Öğrenci":
        return const {'username': 'ali10a241', 'password': 'ALI2026A'};
      case "Veli":
        return const {'username': 'veli.ayse', 'password': 'VLI2026A'};
      case "Öğretmen":
        return const {'username': 'ogrt.hasan', 'password': 'HYN2026A'};
      case "Muhasebeci":
        return const {'username': 'muhasebe.selim', 'password': 'MHS2026A'};
      case "Yönetici":
        return const {'username': 'admin.ece', 'password': 'Admin2026!'};
      case "İdari Birimler":
        return const {'username': 'idari.ceren', 'password': 'CRN2026B'};
      default:
        return null;
    }
  }

  void _fillDemoCredentials() {
    final creds = _demoCredentials;
    if (creds == null) return;
    usernameController.text = creds['username']!;
    passwordController.text = creds['password']!;
    setState(() {});
  }

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

      if (!mounted) return;

      if (!_canOpenSelectedRole(session)) {
        await AuthSessionStore.instance.clear();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.role} rolü için uygun bir hesapla giriş yapmalısın.'),
          ),
        );
      } else {
        // Login başarılı — tenant branding'i yükle
        final themeProvider = context.read<ThemeProvider>();
        await BrandingService.instance.applyBranding(themeProvider);
        if (!mounted) return;
        _openRolePanel();
        unawaited(LiveNotificationBridge.instance.startForCurrentSession());
        unawaited(RemotePushService.instance.refreshRegistration());
      }
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
        ),
      );
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

  bool _canOpenSelectedRole(AuthSession session) {
    final roles = <String>{session.primaryRole, ...session.extraRoles};
    switch (widget.role) {
      case "Öğrenci":
        return roles.contains('Student');
      case "Veli":
        return roles.contains('Parent');
      case "Öğretmen":
        return roles.contains('Teacher');
      case "Muhasebeci":
        return roles.contains('Accounting');
      case "Yönetici":
        return roles.contains('Admin');
      case "İdari Birimler":
        return roles.contains('Administrative');
      default:
        return false;
    }
  }

  void _openRolePanel() {
    Widget page;
    switch (widget.role) {
      case "Öğrenci":
        page = const BottomNav();
        break;
      case "Veli":
        page = const VeliBottomNav();
        break;
      case "Öğretmen":
        page = const TeacherBottomNav();
        break;
      case "Muhasebeci":
        page = const AccountingBottomNav();
        break;
      case "Yönetici":
        page = const AdminBottomNav();
        break;
      case "İdari Birimler":
        page = const AdministrativeBottomNav();
        break;
      default:
        return;
    }

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => page),
    );
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
                        color: Colors.black.withValues(alpha: isDark ? 0.22 : 0.06),
                        blurRadius: 22,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "${widget.role} Girisi",
                        style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'CourseIntellect uzerinden hesap bilgilerinle guvenli giris yap.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.72),
                        ),
                      ),
                      const SizedBox(height: 22),
                      if (_demoCredentials != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.bolt_rounded, size: 18),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  'Gelistirme ortaminda hizli test icin demo hesap bilgilerini otomatik doldur.',
                                ),
                              ),
                              TextButton(
                                onPressed: _fillDemoCredentials,
                                child: const Text('Otomatik Doldur'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),
                      ],
                      const Text("Kullanici Adi"),
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
                          hintText: "Kullanici adinizi girin",
                          filled: true,
                          fillColor: theme.scaffoldBackgroundColor.withValues(alpha: 0.65),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text("Sifre"),
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
                          hintText: "Sifrenizi girin",
                          filled: true,
                          fillColor: theme.scaffoldBackgroundColor.withValues(alpha: 0.65),
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
                              : const Text("Giris Yap"),
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
