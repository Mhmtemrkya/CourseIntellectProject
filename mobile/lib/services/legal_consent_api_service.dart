import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../legal/legal_content.dart';
import 'api_config.dart';
import 'auth_session_store.dart';

/// Cihazdaki KVKK/yasal onay kararının anahtarları (LegalConsentGate yazar).
class LegalConsentPrefs {
  static const status = 'legal_consent_status';
  static const version = 'legal_consent_version';
  static const decidedAt = 'legal_consent_decided_at';
  static const marketing = 'legal_consent_marketing';
  static const push = 'legal_consent_push';
  static const analytics = 'legal_consent_analytics';
}

/// Onay kararının sunucu kaydı. Mobilde karar girişten ÖNCE (cihazda) alınır;
/// giriş başarılı olunca kullanıcının sunucu kaydı yoksa bu karar gönderilir.
/// Kimlik, kurum, IP ve kayıt zamanı sunucuda oturumdan alınır.
class LegalConsentApiService {
  LegalConsentApiService._();

  static final LegalConsentApiService instance = LegalConsentApiService._();

  /// Girişi bekletmemesi için çağıran `unawaited` kullanır; hata girişi bozmaz,
  /// bir sonraki girişte yeniden denenir (sunucuda kayıt yoksa).
  Future<void> syncAfterLogin(AuthSession session) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final status = prefs.getString(LegalConsentPrefs.status);
      final version = prefs.getString(LegalConsentPrefs.version);
      if (version != legalConsentVersion ||
          (status != 'accepted' && status != 'declined')) {
        return;
      }

      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      };
      final existing = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/api/legal-consent/me'), headers: headers)
          .timeout(const Duration(seconds: 15));
      // 200 = bu kullanıcının kararı zaten kayıtlı; 204 = kayıt yok, gönder.
      if (existing.statusCode != 204) return;

      final declined = status == 'declined';
      await http
          .post(
            Uri.parse('${ApiConfig.baseUrl}/api/legal-consent'),
            headers: headers,
            body: jsonEncode({
              'version': legalConsentVersion,
              'status': status,
              'marketing': !declined && (prefs.getBool(LegalConsentPrefs.marketing) ?? false),
              'push': !declined && (prefs.getBool(LegalConsentPrefs.push) ?? false),
              'analytics': !declined && (prefs.getBool(LegalConsentPrefs.analytics) ?? false),
              'platform': 'mobile',
              'decidedAtUtc': prefs.getString(LegalConsentPrefs.decidedAt),
            }),
          )
          .timeout(const Duration(seconds: 15));
    } on Exception {
      // Ağ hatası: kayıt sunucuda yoksa bir sonraki girişte tekrar gönderilir.
    }
  }
}
