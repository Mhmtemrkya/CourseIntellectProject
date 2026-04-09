import { desktopAppEnv, getDesktopApiBaseUrl } from "./appEnv";

const STORAGE_KEY = "courseintellect-desktop-session";

export const desktopApiBaseUrl = getDesktopApiBaseUrl();

function getDesktopApiCandidates() {
  const candidates = [
    desktopApiBaseUrl,
    "http://127.0.0.1:5206",
    "http://localhost:5206",
    "http://127.0.0.1:5199",
    "http://localhost:5199",
  ]
    .map((value) => (value || "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  return [...new Set(candidates)];
}

function unwrapBackendPayload(payload) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  return payload;
}

export function mapBackendRoleToDesktopRole(role) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "admin";
    case "accounting":
      return "finance";
    case "teacher":
      return "teacher";
    case "student":
      return "student";
    case "parent":
      return "parent";
    case "administrative":
      return "administrative";
    default:
      return "student";
  }
}

export function getRoleHomePath(role) {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "finance":
      return "/finance/dashboard";
    case "teacher":
      return "/t/dashboard";
    case "student":
      return "/s/dashboard";
    case "parent":
      return "/p/dashboard";
    case "administrative":
      return "/admin/operations";
    default:
      return "/dashboard";
  }
}

export function createDesktopUser(payload) {
  const data = unwrapBackendPayload(payload);
  const backendRole = data?.user?.primaryRole || data?.user?.role || "";
  const role = mapBackendRoleToDesktopRole(backendRole);

  return {
    id: data?.user?.id || "",
    name: data?.user?.fullName || data?.user?.name || "",
    email: data?.user?.email || `${data?.user?.username || "user"}@courseintellect.local`,
    role,
    backendRole,
    username: data?.user?.username || data?.user?.email?.split("@")[0] || "",
    tenant: "CourseIntellect Desktop",
    branch: data?.user?.campus || "Merkez Kampus",
    department: data?.user?.departmentOrBranch || "",
    extraRoles: data?.user?.extraRoles || [],
  };
}

export function persistDesktopSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadDesktopSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearDesktopSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Lazy singleton: import'u ilk kullanımda await eder, sonraki çağrılarda cache'den döner
let _tauriFetchPromise = null;
async function getTauriFetch() {
  if (desktopAppEnv.isDevelopment) return null;
  if (typeof window === 'undefined' || !(window.__TAURI__ || window.__TAURI_INTERNALS__)) return null;
  if (!_tauriFetchPromise) {
    _tauriFetchPromise = import('@tauri-apps/plugin-http')
      .then((mod) => mod.fetch)
      .catch(() => null);
  }
  return _tauriFetchPromise;
}

export async function loginWithBackend(username, password) {
  if (!desktopApiBaseUrl) {
    throw new Error(
      desktopAppEnv.isProduction || desktopAppEnv.isStaging
        ? "Uygulama API adresi yapılandırılmamış."
        : "API adresi bulunamadı."
    );
  }

  const tauriFetch = await getTauriFetch();
  const fetchFn = tauriFetch || fetch;
  const candidates = getDesktopApiCandidates();
  let response = null;
  let lastConnectionError = null;

  for (const baseUrl of candidates) {
    try {
      response = await fetchFn(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response) {
        break;
      }
    } catch (error) {
      lastConnectionError = error;
    }
  }

  if (!response) {
    const reason = lastConnectionError?.message ? ` (${lastConnectionError.message})` : "";
    throw new Error(`Backend baglantisi kurulamadi${reason}`);
  }

  if (response.status === 401) {
    throw new Error("Kullanıcı adı veya şifre yanlış.");
  }

  if (!response.ok) {
    throw new Error(`Giriş sırasında sunucu hatası oluştu (${response.status}).`);
  }

  const payload = await response.json();
  return unwrapBackendPayload(payload);
}
