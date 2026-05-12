import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'auth_session_store.dart';

class PkceLoginService {
  PkceLoginService._();

  static final PkceLoginService instance = PkceLoginService._();

  static const String _clientId = 'mobile';
  static const String _redirectUri = 'courseintellect://callback';
  static const String _callbackScheme = 'courseintellect';

  Future<AuthSession> loginWithBrowser() async {
    final configuredError = ApiConfig.configurationError;
    if (configuredError != null) {
      throw AuthApiException(configuredError);
    }

    final apiBaseUrl = _resolveBaseUrl();
    if (apiBaseUrl.isEmpty) {
      throw const AuthApiException('Backend adresi bulunamadı.');
    }

    final marketingBaseUrl = ApiConfig.marketingBaseUrl;
    if (marketingBaseUrl.isEmpty) {
      throw const AuthApiException('Web giriş adresi bulunamadı.');
    }

    final codeVerifier = _generateCodeVerifier();
    final codeChallenge = _generateCodeChallenge(codeVerifier);

    final params = {
      'client_id': _clientId,
      'redirect_uri': _redirectUri,
      'code_challenge': codeChallenge,
      'code_challenge_method': 'S256',
      'response_type': 'code',
    };

    final loginUri = Uri.parse(
      '$marketingBaseUrl/auth/pkce',
    ).replace(queryParameters: params);

    final String callbackUrl;
    try {
      callbackUrl = await FlutterWebAuth2.authenticate(
        url: loginUri.toString(),
        callbackUrlScheme: _callbackScheme,
        options: const FlutterWebAuth2Options(preferEphemeral: true),
      );
    } catch (error) {
      throw AuthApiException(
        'Tarayıcı ile giriş tamamlanmadı (${error.toString()}).',
      );
    }

    final returned = Uri.parse(callbackUrl);
    final code = returned.queryParameters['code'];
    if (code == null || code.isEmpty) {
      final errorMessage =
          returned.queryParameters['error'] ?? 'Yetkilendirme kodu alınamadı.';
      throw AuthApiException(errorMessage);
    }

    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/auth/pkce/token'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'code': code,
        'codeVerifier': codeVerifier,
        'clientId': _clientId,
        'redirectUri': _redirectUri,
      }),
    );

    if (response.statusCode == 401) {
      throw const AuthApiException('Yetkilendirme kodu reddedildi.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException(
        'Token değişimi başarısız (${response.statusCode}).',
      );
    }

    final session = AuthApiService.instance.parseLoginResponse(response.body);
    await AuthSessionStore.instance.save(session);
    return session;
  }

  String _resolveBaseUrl() {
    final urls = ApiConfig.candidateBaseUrls;
    return urls.isEmpty ? '' : urls.first;
  }

  String _generateCodeVerifier() {
    final rng = Random.secure();
    final bytes = List<int>.generate(48, (_) => rng.nextInt(256));
    return _base64UrlNoPad(bytes);
  }

  String _generateCodeChallenge(String verifier) {
    final digest = sha256.convert(utf8.encode(verifier));
    return _base64UrlNoPad(digest.bytes);
  }

  String _base64UrlNoPad(List<int> bytes) {
    return base64Url.encode(bytes).replaceAll('=', '');
  }
}
