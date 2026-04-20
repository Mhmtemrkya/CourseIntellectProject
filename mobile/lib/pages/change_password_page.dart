import 'package:flutter/material.dart';

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

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

  @override
  void dispose() {
    oldPass.dispose();
    newPass.dispose();
    newPassAgain.dispose();
    super.dispose();
  }

  void _showSuccessDialog() {
    final theme = Theme.of(context);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: theme.cardColor,
          title: Text("Başarılı", style: theme.textTheme.titleMedium),
          content: Text(
            "Şifreniz başarıyla değiştirildi.",
            style: theme.textTheme.bodyMedium,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                "Tamam",
                style: TextStyle(color: theme.colorScheme.primary),
              ),
            ),
          ],
        );
      },
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text("Şifre Değiştir")),
      body: SingleChildScrollView(
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
              Text(
                "Şifre Güvenliği",
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 20,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Hesabınızın güvenliği için yeni bir şifre belirleyin.",
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              _passwordField(
                label: "Mevcut Şifre",
                controller: oldPass,
                obscureText: hideOld,
                onToggle: () => setState(() => hideOld = !hideOld),
              ),
              const SizedBox(height: 16),
              _passwordField(
                label: "Yeni Şifre",
                controller: newPass,
                obscureText: hideNew,
                onToggle: () => setState(() => hideNew = !hideNew),
              ),
              const SizedBox(height: 16),
              _passwordField(
                label: "Yeni Şifre Tekrar",
                controller: newPassAgain,
                obscureText: hideAgain,
                onToggle: () => setState(() => hideAgain = !hideAgain),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _showSuccessDialog,
                  child: const Text("Şifreyi Güncelle"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
