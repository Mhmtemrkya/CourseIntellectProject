import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'auth_session_store.dart';
import '../theme_provider.dart';

/// Tenant branding konfigürasyonunu API'den çeker ve ThemeProvider'a uygular.
class BrandingService {
  BrandingService._();
  static final BrandingService instance = BrandingService._();

  /// Login sonrası çağrılır — branding'i çekip tema renklerini günceller.
  Future<void> applyBranding(ThemeProvider themeProvider) async {
    try {
      final session = await AuthSessionStore.instance.load();
      if (session == null) return;

      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/platformconfigurations/branding'),
        headers: {
          'Authorization': 'Bearer ${session.accessToken}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode != 200) return;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final payloadJson = data['payloadJson'] as String?;
      final payload = payloadJson != null && payloadJson.isNotEmpty
          ? jsonDecode(payloadJson) as Map<String, dynamic>
          : data;
      final primaryHex = payload['primaryColor'] as String?;
      final accentHex = payload['accentColor'] as String?;
      final logoUrl = payload['logoUrl'] as String?;
      final appName = payload['appName'] as String? ?? '';

      if (primaryHex != null && primaryHex.isNotEmpty) {
        themeProvider.applyBranding(
          primaryColor: ThemeProvider.colorFromHex(primaryHex),
          accentColor: (accentHex != null && accentHex.isNotEmpty)
              ? ThemeProvider.colorFromHex(accentHex)
              : null,
          logoUrl: logoUrl,
          tenantName: appName,
        );
      }
    } catch (_) {
      // Branding yüklenemezse varsayılan tema ile devam et
    }
  }
}
