// Desktop oturum deposu — token'lar düz metin localStorage yerine AES-GCM ile
// şifrelenip saklanır; şifreleme anahtarı OS keychain'inde tutulur (macOS
// Keychain / Windows Credential Manager, Rust `keyring` komutları üzerinden).
// Tarayıcı (dev) ortamında ve keychain erişilemeyen platformlarda eski düz
// localStorage davranışına düşülür, işlev kaybı olmaz.

const LEGACY_STORAGE_KEY = 'courseintellect-desktop-session';
const ENCRYPTED_STORAGE_KEY = 'courseintellect-desktop-session-v2';
const KEYCHAIN_ACCOUNT = 'session-encryption-key';

let sessionCache = null;
let secureMode = false;
let cryptoKey = null;
let initPromise = null;
// Şifreli yazmalar sıralanır; hızlı persist/clear ardışıklığında eski bir
// yazmanın temizlenmiş oturumu geri getirmesi engellenir.
let pendingWrite = Promise.resolve();

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
}

async function invokeTauri(command, args) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
}

function toBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function readPlainLocal() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return null;
  }
}

async function getOrCreateCryptoKey() {
  let encoded = await invokeTauri('keychain_get', { account: KEYCHAIN_ACCOUNT });
  if (!encoded) {
    encoded = toBase64(crypto.getRandomValues(new Uint8Array(32)));
    await invokeTauri('keychain_set', { account: KEYCHAIN_ACCOUNT, value: encoded });
  }
  return crypto.subtle.importKey('raw', fromBase64(encoded), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToStorage(session) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
  localStorage.setItem(ENCRYPTED_STORAGE_KEY, `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`);
}

async function decryptFromStorage() {
  const stored = localStorage.getItem(ENCRYPTED_STORAGE_KEY);
  if (!stored) return null;
  try {
    const [ivPart, dataPart] = stored.split('.');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      cryptoKey,
      fromBase64(dataPart),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    // Anahtar değişmiş veya kayıt bozulmuş: oturum düşer, yeniden giriş istenir.
    localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
    return null;
  }
}

// Uygulama açılışında bir kez await edilmelidir; idempotenttir.
export function initDesktopSessionStore() {
  if (!initPromise) {
    initPromise = (async () => {
      if (!isTauriRuntime() || !globalThis.crypto?.subtle) {
        sessionCache = readPlainLocal();
        return;
      }
      try {
        cryptoKey = await getOrCreateCryptoKey();
        secureMode = true;
      } catch (error) {
        console.warn('Keychain erişilemedi, oturum localStorage üzerinde tutulacak:', error);
        sessionCache = readPlainLocal();
        return;
      }
      sessionCache = await decryptFromStorage();
      // Eski sürüm migrasyonu: düz metin oturum şifreli depoya taşınır ve
      // düz kopya ancak şifreli yazma başarılı olursa silinir.
      const legacy = readPlainLocal();
      if (legacy) {
        if (!sessionCache) sessionCache = legacy;
        try {
          await encryptToStorage(sessionCache);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (error) {
          console.warn('Oturum şifreli depoya taşınamadı:', error);
        }
      }
    })();
  }
  return initPromise;
}

export function persistDesktopSession(session) {
  sessionCache = session;
  if (secureMode) {
    pendingWrite = pendingWrite
      .then(() => encryptToStorage(session))
      .catch((error) => {
        console.warn('Oturum şifreli depoya yazılamadı:', error);
      });
    return;
  }
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(session));
}

export function loadDesktopSession() {
  if (sessionCache) return sessionCache;
  // Tauri'de init sonrası cache doludur; tarayıcı (dev) ortamında eski
  // senkron localStorage davranışı korunur.
  if (isTauriRuntime()) return null;
  return readPlainLocal();
}

export function clearDesktopSession() {
  sessionCache = null;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  if (secureMode) {
    pendingWrite = pendingWrite
      .catch(() => {})
      .then(() => {
        localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
      });
    return;
  }
  localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
}
