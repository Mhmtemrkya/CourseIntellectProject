/// Kullanıcı/API verisinden gelen bağlantılar yalnız http(s) şemasıyla açılır;
/// javascript:, file:, intent: gibi şemalar burada kesilir (desktop safeOpen eşi).
Uri? httpUri(String? raw) {
  final uri = Uri.tryParse((raw ?? '').trim());
  if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https') || uri.host.isEmpty) {
    return null;
  }
  return uri;
}
