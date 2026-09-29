// WebKit'e özgü tam ekran API'leri: Tauri macOS'ta WKWebView kullanır ve standart
// requestFullscreen bazı sürümlerde yoktur. Standart DOM tiplerinde tanımlı değiller.
interface HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface HTMLVideoElement {
  /** iOS/macOS Safari: yerleşik video oynatıcısını tam ekrana alır. */
  webkitEnterFullscreen?: () => void;
}
