import { desktopAppEnv, getDesktopApiBaseUrl } from "./appEnv";

const STORAGE_KEY = "courseintellect-desktop-session";

export const desktopApiBaseUrl = getDesktopApiBaseUrl();

function getDesktopApiCandidates() {
  const candidates = [
    desktopApiBaseUrl,
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
    case "developer":
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
  return getHomePathForRole(role);
}

export function getHomePathForRole(role, options = {}) {
  switch (role) {
    case "admin":
      return options?.isPlatformAdmin ? "/sa/dashboard" : "/dashboard";
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

export function getUserHomePath(user) {
  if (user?.mustChangePassword) {
    return "/change-password-required";
  }

  if (user?.hasRoleManagementPolicy) {
    const modules = Array.isArray(user.modules) ? user.modules.map((m) => String(m).toLowerCase()) : [];
    for (const moduleKey of modules) {
      const path = getHomePathForModule(user.role, moduleKey, { isPlatformAdmin: user?.isPlatformAdmin });
      if (path) return path;
    }

    return getProfilePathForRole(user?.role);
  }

  return getHomePathForRole(user?.role, { isPlatformAdmin: user?.isPlatformAdmin });
}

function getProfilePathForRole(role) {
  switch (role) {
    case "teacher":
      return "/t/profile";
    case "student":
      return "/s/profile";
    case "parent":
      return "/p/profile";
    case "admin":
      return "/admin/profile";
    default:
      return "/settings";
  }
}

function getHomePathForModule(role, moduleKey, options = {}) {
  const byRole = {
    dashboard: getHomePathForRole(role, options),
    students: "/students",
    teachers: "/teachers",
    classes: role === "student" ? "/s/classes" : "/classes",
    schedule: role === "teacher" ? "/t/schedule" : role === "student" ? "/s/schedule" : role === "administrative" ? "/admin/schedule" : "/schedule",
    content: role === "teacher" ? "/t/content" : role === "student" ? "/s/content" : "/content",
    questions: role === "teacher" ? "/t/questions" : role === "student" ? "/s/questions" : "/questions",
    exams: role === "teacher" ? "/t/exams" : role === "student" ? "/s/exams" : role === "parent" ? "/p/exams" : "/exams",
    reports: role === "teacher" ? "/t/reports" : role === "student" ? "/s/exam-results" : role === "parent" ? "/p/weekly-report" : "/reports",
    kpi: "/admin/kpi",
    academics: "/admin/academics",
    parents: role === "parent" ? "/p/children" : "/parents",
    attendance: role === "teacher" ? "/t/attendance" : role === "student" ? "/s/attendance" : role === "parent" ? "/p/attendance" : "/attendance",
    "question-bank": role === "teacher" ? "/t/question-bank" : role === "student" ? "/s/questions" : "/questions",
    assignments: role === "teacher" ? "/t/assignments" : role === "student" ? "/s/assignments" : "",
    "live-lessons": role === "teacher" ? "/t/live-lessons" : role === "student" ? "/s/live" : "",
    operations: "/admin/operations",
    tasks: "/admin/task-center",
    approvals: "/admin/finance-approvals",
    records: "/admin/records",
    documents: "/admin/documents",
    notifications: role === "teacher" ? "/t/announcements" : role === "student" ? "/s/announcements" : role === "parent" ? "/p/announcements" : "/admin/announcements",
    meetings: role === "teacher" ? "/t/meeting-approvals" : role === "parent" ? "/p/meetings" : "/admin/meetings",
    registrations: "/admin/student-registration",
    "branch-comparison": "/admin/branch-comparison",
    "global-search": "/admin/global-search",
    chat: role === "teacher" ? "/t/chat" : role === "student" ? "/s/chat" : role === "parent" ? "/p/chat" : "/chat",
    finance: "/finance/dashboard",
    "student-accounts": "/finance/student-accounts",
    collections: "/finance/collections",
    installments: "/finance/installments",
    "late-payments": "/finance/late-payments",
    billing: "/finance/invoices-receipts",
    "discounts-scholarships": "/finance/discounts-scholarships",
    "finance-export": "/finance/export",
    "finance-audit-log": "/finance/audit-log",
    "collection-calendar": "/finance/collection-calendar",
    reconciliation: "/finance/reconciliation",
    "bulk-actions": "/finance/bulk-actions",
    "finance-detail-hub": "/finance/detail-hub",
    salary: "/finance/salary",
    "cash-report": "/finance/cash-report",
    "overdue-rules": "/finance/overdue-rules",
    ledger: "/finance/ledger",
    platform: "/sa/dashboard",
    tenants: "/sa/tenants",
    plans: "/sa/plans",
    limits: "/sa/limits",
    "ai-management": "/sa/ai",
    customization: "/sa/customization",
    support: options?.isPlatformAdmin ? "/sa/support" : "/admin/destek",
    profile: getProfilePathForRole(role),
    system: options?.isPlatformAdmin ? "/sa/system" : "/settings",
  };

  return byRole[moduleKey] || "";
}

export function createDesktopUser(payload) {
  const data = unwrapBackendPayload(payload);
  const backendRole = data?.user?.primaryRole || data?.user?.role || "";
  const role = mapBackendRoleToDesktopRole(backendRole);
  const isPlatformAdmin = Boolean(data?.user?.isPlatformAdmin);
  const tenantName = data?.user?.tenantName || (isPlatformAdmin ? "Platform" : "CourseIntellect Desktop");

  return {
    id: data?.user?.id || "",
    name: data?.user?.fullName || data?.user?.name || "",
    email: data?.user?.email || `${data?.user?.username || "user"}@courseintellect.local`,
    role,
    backendRole,
    isPlatformAdmin,
    username: data?.user?.username || data?.user?.email?.split("@")[0] || "",
    tenantId: data?.user?.tenantId || null,
    tenantSlug: data?.user?.tenantSlug || "",
    tenant: tenantName,
    branch: data?.user?.campus || "Merkez Kampus",
    department: data?.user?.departmentOrBranch || "",
    extraRoles: data?.user?.extraRoles || [],
    modules: data?.user?.modules || [],
    permissions: data?.user?.permissions || [],
    hasRoleManagementPolicy: Boolean(data?.user?.hasRoleManagementPolicy),
    homePath: getUserHomePath({ role, isPlatformAdmin, modules: data?.user?.modules || [], hasRoleManagementPolicy: Boolean(data?.user?.hasRoleManagementPolicy), mustChangePassword: Boolean(data?.user?.mustChangePassword) }),
    mustChangePassword: Boolean(data?.user?.mustChangePassword),
    subscriptionRequired: Boolean(data?.user?.subscriptionRequired),
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

  // Bakım modu — 503 + code MAINTENANCE_MODE
  if (response.status === 503) {
    let body = null;
    try { body = await response.json(); } catch {}
    if (body?.code === "MAINTENANCE_MODE") {
      const err = new Error(
        body.message || "Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin."
      );
      err.code = "MAINTENANCE_MODE";
      throw err;
    }
    throw new Error(body?.message || "Servis geçici olarak ulaşılamıyor.");
  }

  if (!response.ok) {
    throw new Error(`Giriş sırasında sunucu hatası oluştu (${response.status}).`);
  }

  const payload = await response.json();
  const data = unwrapBackendPayload(payload);

  // Kurum üyesi ama abonelik ödemesi yapılmamış → desktop'a giriş reddedilir.
  // Platform admin (kendi platformumuzun yöneticisi) bu kontrolden muaftır.
  const user = data?.user;
  if (user && user.subscriptionRequired === true && user.isPlatformAdmin !== true) {
    const err = new Error(
      "Kurum aboneliğiniz aktif değil. Lütfen kurum yöneticinizle iletişime geçin ve ödemeyi tamamlayın."
    );
    err.code = "SUBSCRIPTION_REQUIRED";
    throw err;
  }

  return data;
}
