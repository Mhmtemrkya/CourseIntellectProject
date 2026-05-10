import 'package:flutter/material.dart';

import '../services/auth_api_service.dart';

class ChangePasswordPage extends StatefulWidget {
  final bool forceMode;
  final VoidCallback? onSuccess;

  const ChangePasswordPage({
    super.key,
    this.forceMode = false,
    this.onSuccess,
  });

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final TextEditingController oldPass = TextEditingController();
  final TextEditingController newPass = TextEditingController();
  final TextEditingController newPassAgain = TextEditingController();

  bool hideOld = true;
  bool hideNew = true;
  bool hideAgain = true;
  bool _saving = false;

  @override
  void dispose() {
    oldPass.dispose();
    newPass.dispose();
    newPassAgain.dispose();
    super.dispose();
  }

  bool get _ruleLength => newPass.text.length >= 8;
  bool get _ruleUpper => newPass.text.contains(RegExp(r'[A-Z]'));
  bool get _ruleLower => newPass.text.contains(RegExp(r'[a-z]'));
  bool get _ruleDigit => newPass.text.contains(RegExp(r'[0-9]'));
  bool get _ruleMatch =>
      newPass.text.isNotEmpty && newPass.text == newPassAgain.text;
  bool get _allRulesValid =>
      _ruleLength && _ruleUpper && _ruleLower && _ruleDigit && _ruleMatch;

  Future<void> _handleSubmit() async {
    if (!_allRulesValid) {
      _showError('Şifre kurallarını kontrol edin.');
      return;
    }
    if (!widget.forceMode && oldPass.text.isEmpty) {
      _showError('Mevcut şifre boş olamaz.');
      return;
    }

    setState(() => _saving = true);
    try {
      await AuthApiService.instance.changePassword(
        currentPassword: widget.forceMode ? null : oldPass.text,
        newPassword: newPass.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Şifreniz başarıyla güncellendi.')),
      );
      widget.onSuccess?.call();
      if (widget.forceMode) {
        // forceMode'da yönlendirme caller tarafından yapılır
      } else {
        Navigator.pop(context);
      }
    } on AuthApiException catch (err) {
      if (!mounted) return;
      _showError(err.message);
    } catch (_) {
      if (!mounted) return;
      _showError('Beklenmeyen bir hata oluştu.');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  Widget _passwordField({
    required String label,
    required TextEditingController controller,
    required bool obscureText,
    required VoidCallback onToggle,
  }) {
    final theme = Theme.of(context);
    return TextField(
      controller: controller,
      obscureText: obscureText,
      style: theme.textTheme.bodyMedium,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(Icons.lock_outline, color: theme.colorScheme.primary),
        suffixIcon: IconButton(
          onPressed: onToggle,
          icon: Icon(
            obscureText ? Icons.visibility_off : Icons.visibility,
            color: theme.iconTheme.color,
          ),
        ),
      ),
    );
  }

  Widget _ruleRow(bool ok, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: ok ? Colors.green : Colors.grey,
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: TextStyle(
              fontSize: 13,
              color: ok ? Colors.green.shade700 : Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final force = widget.forceMode;

    final body = Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: force
          ? null
          : AppBar(title: const Text('Şifre Değiştir')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: theme.cardColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (force) ...[
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.shield_outlined,
                        size: 36,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: Text(
                      'Yeni Şifre Belirleyin',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Hesabınızın güvenliği için ilk girişte şifrenizi yenilemeniz gerekiyor.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                ] else ...[
                  Text(
                    'Şifre Güvenliği',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 20,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Hesabınızın güvenliği için yeni bir şifre belirleyin.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  _passwordField(
                    label: 'Mevcut Şifre',
                    controller: oldPass,
                    obscureText: hideOld,
                    onToggle: () => setState(() => hideOld = !hideOld),
                  ),
                  const SizedBox(height: 16),
                ],
                _passwordField(
                  label: 'Yeni Şifre',
                  controller: newPass,
                  obscureText: hideNew,
                  onToggle: () => setState(() => hideNew = !hideNew),
                ),
                const SizedBox(height: 16),
                _passwordField(
                  label: 'Yeni Şifre Tekrar',
                  controller: newPassAgain,
                  obscureText: hideAgain,
                  onToggle: () => setState(() => hideAgain = !hideAgain),
                ),
                const SizedBox(height: 16),
                _ruleRow(_ruleLength, 'En az 8 karakter'),
                _ruleRow(_ruleUpper, 'Büyük harf (A-Z)'),
                _ruleRow(_ruleLower, 'Küçük harf (a-z)'),
                _ruleRow(_ruleDigit, 'Rakam (0-9)'),
                _ruleRow(_ruleMatch, 'Şifreler eşleşiyor'),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: (_saving || !_allRulesValid) ? null : _handleSubmit,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(force ? 'Şifreyi Güncelle ve Devam Et' : 'Şifreyi Güncelle'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (!force) return body;
    return PopScope(canPop: false, child: body);
  }
}
