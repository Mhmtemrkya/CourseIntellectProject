/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth flow.
 * Used when the desktop app authenticates via system browser.
 */

/**
 * Generate a random code verifier (43-128 chars, URL-safe).
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Derive the S256 code challenge from a code verifier.
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Open system browser for PKCE login, return a Promise that resolves
 * with the authorization code when the deep link callback arrives.
 */
export async function startPkceLogin(apiBaseUrl) {
  const { open } = await import("@tauri-apps/plugin-shell");
  const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const redirectUri = "courseintellect://callback";
  const clientId = "desktop";

  // Build the login URL that the web app will handle
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_type: "code",
  });

  const loginUrl = `${apiBaseUrl.replace(/\/$/, "")}/auth/pkce?${params.toString()}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("PKCE login timeout (5 minutes)."));
      }
    }, 5 * 60 * 1000);

    // Listen for the deep link callback
    onOpenUrl((urls) => {
      if (settled) return;
      for (const url of urls) {
        if (url.startsWith("courseintellect://callback")) {
          settled = true;
          clearTimeout(timeout);
          const callbackUrl = new URL(url);
          const code = callbackUrl.searchParams.get("code");
          if (code) {
            resolve({ code, codeVerifier, clientId, redirectUri });
          } else {
            const error = callbackUrl.searchParams.get("error") || "No authorization code received.";
            reject(new Error(error));
          }
          return;
        }
      }
    });

    // Open system browser
    open(loginUrl).catch((err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

/**
 * Exchange authorization code + code_verifier for tokens.
 */
export async function exchangePkceCode(apiBaseUrl, { code, codeVerifier, clientId, redirectUri }) {
  const response = await fetch(`${apiBaseUrl}/api/auth/pkce/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      codeVerifier,
      clientId,
      redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Token exchange failed (${response.status})`);
  }

  return response.json();
}

function base64UrlEncode(bytes) {
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
