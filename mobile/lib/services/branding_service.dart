import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'auth_session_store.dart';
import 'tenant_scope_store.dart';
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
      await TenantScopeStore.instance.ensureLoaded();
      final effectiveTenantId =
          TenantScopeStore.instance.tenantId ?? session.tenantId;

      final brandingUrl =
          effectiveTenantId != null && effectiveTenantId.isNotEmpty
          ? '${ApiConfig.baseUrl}/api/platformconfigurations/branding?tenantId=${Uri.encodeQueryComponent(effectiveTenantId)}'
          : '${ApiConfig.baseUrl}/api/platformconfigurations/branding';

      final response = await http.get(
        Uri.parse(brandingUrl),
        headers: {
          'Authorization': 'Bearer ${session.accessToken}',
          'Content-Type': 'application/json',
          ...TenantScopeStore.instance.headers,
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
      final appName = payload['appName'] as String? ?? session.tenantName;

      themeProvider.applyBranding(
        primaryColor: ThemeProvider.colorFromHex(
          primaryHex != null && primaryHex.isNotEmpty ? primaryHex : '#08111F',
        ),
        accentColor: (accentHex != null && accentHex.isNotEmpty)
            ? ThemeProvider.colorFromHex(accentHex)
            : const Color(0xFFFF7A1A),
        logoUrl: logoUrl == null || logoUrl.isEmpty
            ? null
            : ApiConfig.resolveAssetUrl(logoUrl),
        tenantName: appName,
      );
    } catch (_) {
      // Branding yüklenemezse varsayılan tema ile devam et
    }
  }

  Future<void> uploadLogo(PlatformFile file) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || file.bytes == null) {
      throw Exception('Logo dosyası okunamadı.');
    }
    await TenantScopeStore.instance.ensureLoaded();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse(
        '${ApiConfig.baseUrl}/api/platformconfigurations/branding/logo',
      ),
    );
    request.headers.addAll({
      'Authorization': 'Bearer ${session.accessToken}',
      ...TenantScopeStore.instance.headers,
    });
    request.files.add(
      http.MultipartFile.fromBytes('file', file.bytes!, filename: file.name),
    );
    final response = await http.Response.fromStream(await request.send());
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final payload = jsonDecode(response.body) as Map<String, dynamic>?;
      throw Exception(
        payload?['message']?.toString() ??
            'Logo yüklenemedi (${response.statusCode}).',
      );
    }
  }

  Future<void> removeLogo() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) throw Exception('Oturum bulunamadı.');
    await TenantScopeStore.instance.ensureLoaded();
    final response = await http.delete(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/platformconfigurations/branding/logo',
      ),
      headers: {
        'Authorization': 'Bearer ${session.accessToken}',
        ...TenantScopeStore.instance.headers,
      },
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Logo kaldırılamadı (${response.statusCode}).');
    }
  }
}
