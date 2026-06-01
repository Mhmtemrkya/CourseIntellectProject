import 'dart:async';

import 'package:flutter/material.dart';
import 'package:student/pages/change_password_page.dart';
import 'package:student/services/auth_api_service.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/branding_service.dart';
import 'package:student/services/live_notification_bridge.dart';
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

  Future<void> _openForgotPasswordSheet() async {
    final emailController = TextEditingController(
      text: usernameController.text.contains('@')
          ? usernameController.text.trim()
          : '',
    );
    var submitting = false;
    var sheetClosed = false;
    String? successMessage;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            Future<void> submit() async {
              final email = emailController.text.trim();
              if (!email.contains('@')) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  const SnackBar(
                    content: Text('Kayıtlı e-posta adresinizi girin.'),
                  ),
                );
                return;
              }

              setModalState(() => submitting = true);
              try {
                final message = await AuthApiService.instance
                    .requestPasswordReset(email: email);
                if (!mounted || !sheetContext.mounted) return;
                successMessage = message;
                sheetClosed = true;
                Navigator.of(sheetContext).pop();
              } on AuthApiException catch (error) {
                if (!sheetContext.mounted) return;
                ScaffoldMessenger.of(
                  sheetContext,
                ).showSnackBar(SnackBar(content: Text(error.message)));
              } finally {
                if (!sheetClosed && modalContext.mounted) {
                  setModalState(() => submitting = false);
                }
              }
            }

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
                  top: 8,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF97316).withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.key_rounded,
                        color: Color(0xFFF97316),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Şifremi Unuttum',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Kayıtlı e-postanızı girin. Talep kurum yöneticisi ve idari yetkili ekranına düşer.',
                      style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      textCapitalization: TextCapitalization.none,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: 'Kayıtlı E-posta',
                        hintText: 'ornek@kurum.com',
                        prefixIcon: const Icon(Icons.mail_outline_rounded),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: submitting ? null : submit,
                        icon: submitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.send_rounded),
                        label: Text(
                          submitting ? 'Gönderiliyor...' : 'Talebi Gönder',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    emailController.dispose();
    if (!mounted || successMessage == null) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(successMessage!)));
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
            onSuccess: () async {
              await AuthSessionStore.instance.clear();
              if (!mounted) return;
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const LoginPage()),
                (_) => false,
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
                      const SizedBox(height: 22),
                      const Text("Kullanıcı Adı veya E-posta"),
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
                          hintText: "Kullanıcı adınızı veya e-postanızı girin",
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
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: isLoading
                              ? null
                              : _openForgotPasswordSheet,
                          child: const Text('Şifremi unuttum'),
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
