import 'dart:async';

import 'package:student/i18n/app_locale.dart';
import 'package:flutter/material.dart';
import 'package:student/pages/change_password_page.dart';
import 'package:student/services/auth_api_service.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/branding_service.dart';
import 'package:student/services/branch_scope_store.dart';
import 'package:student/services/live_notification_bridge.dart';
import 'package:student/services/remote_push_service.dart';
import 'package:student/services/role_router.dart';
import 'package:student/services/tenant_scope_store.dart';
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
      // Her yeni girişte eski kurum/şube seçimi taşınmaz; yönetici seçim
      // ekranından bağlamını açıkça yeniden belirler.
      await TenantScopeStore.instance.clear();
      await BranchScopeStore.instance.clear();
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
    final successMessage = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      enableDrag: false,
      showDragHandle: true,
      builder: (_) => _ForgotPasswordSheet(
        initialEmail: usernameController.text.contains('@')
            ? usernameController.text.trim()
            : '',
      ),
    );

    if (!mounted || successMessage == null) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(successMessage)));
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

  bool _obscurePassword = true;
  bool _rememberMe = true;

  static const _navy = Color(0xFF15294B);
  static const _orange = Color(0xFFF7941D);

  InputDecoration _fieldDecoration({
    required BuildContext context,
    required String hint,
    required IconData icon,
    Widget? suffix,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark
        ? const Color(0xFF2A3B5C)
        : const Color(0xFFE2E8F0);
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(
        icon,
        size: 20,
        color: isDark ? const Color(0xFF8FA0BC) : const Color(0xFF64748B),
      ),
      suffixIcon: suffix,
      filled: true,
      fillColor: isDark ? const Color(0xFF16223C) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: _orange, width: 1.6),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final subtleText = isDark
        ? const Color(0xFF9DACC4)
        : const Color(0xFF5B6B84);
    final headingColor = isDark ? Colors.white : _navy;

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF0B1428)
          : const Color(0xFFF4F6FA),
      body: Stack(
        children: [
          // Alt lacivert dalga + turuncu kontur (mockup dekoru)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: IgnorePointer(
              child: CustomPaint(
                size: const Size(double.infinity, 130),
                painter: _BottomWavePainter(),
              ),
            ),
          ),
          // Nokta ızgarası dekorları
          const Positioned(
            top: 48,
            left: 24,
            child: IgnorePointer(child: _DotGrid(color: _navy)),
          ),
          // Dil değiştirici (sağ üst)
          Positioned(
            top: 8,
            right: 12,
            child: SafeArea(
              child: ValueListenableBuilder<String>(
                valueListenable: AppLocale.language,
                builder: (context, lang, _) => TextButton.icon(
                  onPressed: AppLocale.toggle,
                  icon: const Icon(Icons.translate_rounded, size: 18),
                  label: Text(
                    lang == 'tr' ? 'EN' : 'TR',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  style: TextButton.styleFrom(foregroundColor: _navy),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 150,
            right: 24,
            child: IgnorePointer(
              child: _DotGrid(color: _navy.withValues(alpha: 0.5)),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 36),
                  const Center(
                    child: SchoolAsistLogo(scale: 1.05, compact: true),
                  ),
                  const SizedBox(height: 30),
                  Text(
                    'Giriş Yapın'.tr,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: headingColor,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'SchoolAsist hesabınıza giriş yaparak\neğitim süreçlerinizi kolayca yönetin.'
                        .tr,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: subtleText,
                    ),
                  ),
                  const SizedBox(height: 30),
                  TextField(
                    controller: usernameController,
                    keyboardType: TextInputType.visiblePassword,
                    textCapitalization: TextCapitalization.none,
                    autocorrect: false,
                    enableSuggestions: false,
                    smartDashesType: SmartDashesType.disabled,
                    smartQuotesType: SmartQuotesType.disabled,
                    autofillHints: const [AutofillHints.username],
                    decoration: _fieldDecoration(
                      context: context,
                      hint: 'Kullanıcı adı veya e-posta',
                      icon: Icons.mail_outline,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: passwordController,
                    obscureText: _obscurePassword,
                    textCapitalization: TextCapitalization.none,
                    autocorrect: false,
                    enableSuggestions: false,
                    smartDashesType: SmartDashesType.disabled,
                    smartQuotesType: SmartQuotesType.disabled,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => login(),
                    decoration: _fieldDecoration(
                      context: context,
                      hint: 'Şifreniz',
                      icon: Icons.lock_outline,
                      suffix: IconButton(
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: isDark
                              ? const Color(0xFF8FA0BC)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () =>
                              setState(() => _rememberMe = !_rememberMe),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 24,
                                height: 24,
                                child: Checkbox(
                                  value: _rememberMe,
                                  activeColor: _orange,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  onChanged: (value) => setState(
                                    () => _rememberMe = value ?? true,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Beni hatırla'.tr,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: headingColor,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: isLoading ? null : _openForgotPasswordSheet,
                        style: TextButton.styleFrom(
                          foregroundColor: _orange,
                          padding: EdgeInsets.zero,
                        ),
                        child: Text(
                          'Şifremi unuttum?'.tr,
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    height: 56,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _orange,
                        foregroundColor: Colors.white,
                        elevation: 4,
                        shadowColor: _orange.withValues(alpha: 0.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
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
                          : Stack(
                              alignment: Alignment.center,
                              children: [
                                Text(
                                  'Giriş Yap'.tr,
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: Padding(
                                    padding: EdgeInsets.only(right: 6),
                                    child: Icon(Icons.arrow_forward, size: 22),
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 26),
                  Text(
                    'Hesabınız yok mu?'.tr,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: subtleText,
                    ),
                  ),
                  Center(
                    child: TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(foregroundColor: _orange),
                      child: Text(
                        'İletişime geçin'.tr,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 150),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Mockup'taki köşe nokta ızgarası
class _DotGrid extends StatelessWidget {
  const _DotGrid({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(88, 72),
      painter: _DotGridPainter(color: color.withValues(alpha: 0.35)),
    );
  }
}

class _DotGridPainter extends CustomPainter {
  _DotGridPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const step = 18.0;
    for (double x = 0; x <= size.width; x += step) {
      for (double y = 0; y <= size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 2.2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DotGridPainter oldDelegate) =>
      oldDelegate.color != color;
}

// Alt lacivert dalga ve üzerindeki turuncu kontur
class _BottomWavePainter extends CustomPainter {
  static const _navy = Color(0xFF15294B);
  static const _orange = Color(0xFFF7941D);

  @override
  void paint(Canvas canvas, Size size) {
    final navyPath = Path()
      ..moveTo(0, size.height * 0.42)
      ..cubicTo(
        size.width * 0.28,
        size.height * -0.12,
        size.width * 0.55,
        size.height * 0.95,
        size.width,
        size.height * 0.38,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(navyPath, Paint()..color = _navy);

    final orangePath = Path()
      ..moveTo(0, size.height * 0.30)
      ..cubicTo(
        size.width * 0.28,
        size.height * -0.24,
        size.width * 0.55,
        size.height * 0.83,
        size.width,
        size.height * 0.26,
      );
    canvas.drawPath(
      orangePath,
      Paint()
        ..color = _orange
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet({required this.initialEmail});

  final String initialEmail;

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  late final TextEditingController _emailController = TextEditingController(
    text: widget.initialEmail,
  );
  bool _submitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (!email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Kayıtlı e-posta adresinizi girin.'.tr)),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final message = await AuthApiService.instance.requestPasswordReset(
        email: email,
      );
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
      setState(() => _submitting = false);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Talep gönderilemedi. Bağlantıyı kontrol edin.'.tr),
        ),
      );
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          top: 8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
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
                const Spacer(),
                IconButton(
                  tooltip: 'Kapat',
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'Şifremi Unuttum'.tr,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Kayıtlı e-postanızı girin. Talep kurum yöneticisi ve idari yetkili ekranına düşer.'
                  .tr,
              style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              textCapitalization: TextCapitalization.none,
              autocorrect: false,
              enableSuggestions: false,
              decoration: InputDecoration(
                labelText: 'Kayıtlı E-posta'.tr,
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
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(_submitting ? 'Gönderiliyor...' : 'Talebi Gönder'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
