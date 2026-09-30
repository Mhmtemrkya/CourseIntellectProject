import {
  desktopAppEnv,
  getDesktopApiBaseUrl,
  getOrderedDesktopApiCandidates,
  setActiveDesktopApiBaseUrl,
} from "./appEnv";
import { createCodedError, isRecord } from "./errors";
import { isLoginPayload } from "./loginPayload";
import type {
  BackendCurrentUser,
  DesktopRole,
  DesktopUser,
  LoginPayload,
  UserLike,
} from "../types/session";

export const desktopApiBaseUrl = getDesktopApiBaseUrl();

/** Backend yanıtı doğrudan ya da `{ data: ... }` zarfıyla gelebilir. */
type Envelope<T> = T | { data: T };

/** Kullanıcı üretmek için yeterli olan en küçük yanıt (eski API'ler yalnız `user` döner). */
export interface UserPayload {
  user?: BackendCurrentUser | null;
}

function isDataEnvelope<T extends object>(payload: Envelope<T>): payload is { data: T } {
  return "data" in payload && isRecord(payload.data);
}

function unwrapBackendPayload<T extends object>(payload: Envelope<T>): T {
  return isDataEnvelope(payload) ? payload.data : payload;
}


export function mapBackendRoleToDesktopRole(role: string | null | undefined): DesktopRole {
  const normalizedRole = String(role || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s_-]+/g, "");

  switch (normalizedRole) {
    case "admin":
    case "institutionadmin":
    case "institutionadministrator":
    case "developer":
    // Şube müdürü admin UI'ını kullanır; verisi backend'de Branch grant ile şubesine kilitli.
    case "branchmanager":
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
    case "idare":
    case "idari":
    case "idaripersonel":
    case "idarîpersonel":
      return "administrative";
    case "cafeteria":
      return "cafeteria";
    default:
      return "student";
  }
}

export function getRoleHomePath(role: string | null | undefined): string {
  return getHomePathForRole(role);
}

export interface HomePathOptions {
  isPlatformAdmin?: boolean | undefined;
}

export function getHomePathForRole(role: string | null | undefined, options: HomePathOptions = {}): string {
  switch (role) {
    case "admin":
      return options?.isPlatformAdmin ? "/sa/dashboard" : "/dashboard";
    case "finance":
      return "/finance/dashboard";
    case "teacher":
      return "/t/dashboard";
    case "counselor":
      return "/g/dashboard";
    case "student":
      return "/s/dashboard";
    case "parent":
      return "/p/dashboard";
    case "administrative":
      return "/admin/operations";
    case "cafeteria":
      return "/cafeteria/menu";
    default:
      return "/dashboard";
  }
}

export function getUserHomePath(user: UserLike | null | undefined): string {
  if (user?.mustChangePassword) {
    return "/change-password-required";
  }

  if (user?.isPlatformAdmin) {
    return "/sa/dashboard";
  }

  if (user?.hasRoleManagementPolicy) {
    const modules = Array.isArray(user.modules) ? user.modules.map((m) => String(m).toLowerCase()) : [];
    for (const moduleKey of modules) {
      const path = getHomePathForModule(user.role, moduleKey, { isPlatformAdmin: user?.isPlatformAdmin });
      if (path) return path;
    }

    return getProfilePathForRole(user?.role);
  }

  return getHomePathForRole(user?.role, {
    isPlatformAdmin: user?.isPlatformAdmin,
  });
}

// Backend e-posta döndürmüyorsa kullanıcı adından türetilir. Kullanıcı adı zaten
// bir e-posta ise (ör. test@surucukursu.local) domain EKLENMEZ — aksi halde
// Ayarlar ekranında "test@surucukursu.local@courseintellect.local" görünüyordu.
export function resolveUserEmail(user: Pick<BackendCurrentUser, "email" | "username"> | null | undefined): string {
  const explicit = (user?.email || "").trim();
  if (explicit) return explicit;
  const username = (user?.username || "").trim();
  if (!username) return "";
  return username.includes("@") ? username : `${username}@courseintellect.local`;
}

function getProfilePathForRole(role: string | null | undefined): string {
  switch (role) {
    case "teacher":
      return "/t/profile";
    case "student":
      return "/s/profile";
    case "parent":
      return "/p/profile";
    case "admin":
      return "/admin/profile";
    case "cafeteria":
      return "/cafeteria/menu";
    default:
      return "/settings";
  }
}

function getHomePathForModule(role: string | null | undefined, moduleKey: string, options: HomePathOptions = {}): string {
  const byRole: Record<string, string> = {
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
    cafeteria: role === "student" ? "/s/cafeteria" : role === "parent" ? "/p/cafeteria" : "/cafeteria/menu",
    meetings: role === "teacher" ? "/t/meeting-approvals" : role === "parent" ? "/p/meetings" : "/admin/meetings",
    registrations: "/admin/student-registration",
    "branch-comparison": "/admin/branch-comparison",
    "global-search": "/admin/global-search",
    chat: role === "teacher" ? "/t/chat" : role === "student" ? "/s/chat" : role === "parent" ? "/p/chat" : "/chat",
    finance: "/finance/dashboard",
    "student-accounts": "/finance/student-accounts",
    collections: "/finance/collections",
    refunds: "/finance/refunds",
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

// Rehberlik: backend'de ayrı rol yok; branşı "Rehberlik" olan öğretmen
// masaüstünde counselor rolüyle çalışır (backend uçları da aynı kuralı uygular).
function isCounselorBranch(departmentOrBranch: string | null | undefined): boolean {
  return String(departmentOrBranch || "")
    .toLocaleLowerCase("tr-TR")
    .includes("rehberlik");
}

export function createDesktopUser(payload: Envelope<UserPayload>): DesktopUser {
  const data = unwrapBackendPayload(payload);
  const backendRole = data?.user?.primaryRole || data?.user?.role || "";
  let role: DesktopRole = mapBackendRoleToDesktopRole(backendRole);
  if (role === "teacher" && isCounselorBranch(data?.user?.departmentOrBranch)) {
    role = "counselor";
  }
  const tenantId = data?.user?.tenantId || null;
  const isPlatformAdmin = Boolean(data?.user?.isPlatformAdmin) || ((backendRole || "").toLowerCase() === "developer" && tenantId == null);
  const tenantName = data?.user?.tenantName || (isPlatformAdmin ? "Platform" : "SchoolAsist Desktop");
  const institutionType = data?.user?.institutionType || null;

  return {
    id: data?.user?.id || "",
    name: data?.user?.fullName || data?.user?.name || "",
    // Kullanıcı adı zaten e-posta biçimindeyse olduğu gibi kullanılır; aksi halde
    // "test@kurs.local@courseintellect.local" gibi ikilenmiş adres oluşuyordu.
    email: resolveUserEmail(data?.user),
    role,
    backendRole,
    isPlatformAdmin,
    username: data?.user?.username || data?.user?.email?.split("@")[0] || "",
    tenantId,
    tenantSlug: data?.user?.tenantSlug || "",
    tenant: tenantName,
    institutionType,
    branch: data?.user?.campus || "Merkez Kampüs",
    department: data?.user?.departmentOrBranch || "",
    extraRoles: data?.user?.extraRoles || [],
    modules: data?.user?.modules || [],
    permissions: data?.user?.permissions || [],
    hasRoleManagementPolicy: Boolean(data?.user?.hasRoleManagementPolicy),
    homePath: getUserHomePath({
      role,
      isPlatformAdmin,
      modules: data?.user?.modules || [],
      hasRoleManagementPolicy: Boolean(data?.user?.hasRoleManagementPolicy),
      mustChangePassword: Boolean(data?.user?.mustChangePassword),
    }),
    mustChangePassword: Boolean(data?.user?.mustChangePassword),
    subscriptionRequired: Boolean(data?.user?.subscriptionRequired),
  };
}

// Oturum deposu secureSession'a taşındı: token'lar AES-GCM ile şifreli,
// anahtar OS keychain'inde. Mevcut import yolları bozulmasın diye re-export.
export {
  initDesktopSessionStore,
  persistDesktopSession,
  loadDesktopSession,
  clearDesktopSession,
} from './secureSession';

// Lazy singleton: import'u ilk kullanımda await eder, sonraki çağrılarda cache'den döner
type FetchFn = typeof fetch;
let _tauriFetchPromise: Promise<FetchFn | null> | null = null;
async function getTauriFetch(): Promise<FetchFn | null> {
  if (typeof window === 'undefined' || !(window.__TAURI__ || window.__TAURI_INTERNALS__)) return null;
  if (!_tauriFetchPromise) {
    _tauriFetchPromise = import('@tauri-apps/plugin-http')
      .then((mod): FetchFn => mod.fetch)
      .catch(() => null);
  }
  return _tauriFetchPromise;
}

interface LoginErrorBody {
  code?: string;
  message?: string;
}

async function readErrorBody(response: Response): Promise<LoginErrorBody | null> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) return null;
    return {
      code: typeof body.code === "string" ? body.code : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    };
  } catch {
    return null;
  }
}

export async function loginWithBackend(username: string, password: string): Promise<LoginPayload> {
  if (!desktopApiBaseUrl) {
    throw new Error(
      desktopAppEnv.isProduction || desktopAppEnv.isStaging
        ? "Uygulama API adresi yapılandırılmamış."
        : "API adresi bulunamadı."
    );
  }

  const tauriFetch = await getTauriFetch();
  const fetchFn = tauriFetch || fetch;
  const candidates = getOrderedDesktopApiCandidates();
  let response: Response | null = null;

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
        setActiveDesktopApiBaseUrl(baseUrl);
        break;
      }
    } catch {
      // Sıradaki aday adres denenir.
    }
  }

  if (!response) {
    throw new Error("Giriş sunucusuna bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
  }

  if (response.status === 401) {
    // Geçici parolanın süresi dolduysa backend ayırt edilebilir bir kod döner.
    // Genel "şifre yanlış" mesajı kurumu bulunmayan bir sorunun peşine düşürürdü.
    const body = await readErrorBody(response);
    if (body?.code === "TEMPORARY_PASSWORD_EXPIRED") {
      throw createCodedError(body.message || "Geçici parolanızın süresi doldu.", "TEMPORARY_PASSWORD_EXPIRED");
    }
    throw new Error("Kullanıcı adı veya şifre yanlış.");
  }

  // Sürücü kursu kurumları DrivingAsist'e taşındı — 403 + code INSTITUTION_MOVED
  if (response.status === 403) {
    const body = await readErrorBody(response);
    if (body?.code === "INSTITUTION_MOVED") {
      throw createCodedError(body.message || "Kurumunuz artık DrivingAsist uygulamasını kullanıyor.", "INSTITUTION_MOVED");
    }
    // Herkese açık demo parolası canlıda reddedilir; kullanıcı parolasını sıfırlatmalı.
    if (body?.code === "PUBLIC_DEMO_PASSWORD") {
      throw createCodedError(body.message || "Bu parola güvenlik nedeniyle kullanılamaz. Parolanızı sıfırlatın.", "PUBLIC_DEMO_PASSWORD");
    }
  }

  // Bakım modu — 503 + code MAINTENANCE_MODE
  if (response.status === 503) {
    const body = await readErrorBody(response);
    if (body?.code === "MAINTENANCE_MODE") {
      throw createCodedError(
        body.message || "Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin.",
        "MAINTENANCE_MODE",
      );
    }
    throw new Error(body?.message || "Servis geçici olarak ulaşılamıyor.");
  }

  // Çok fazla deneme — 429: hesap kilitleme (ACCOUNT_LOCKED) veya hız sınırı (RATE_LIMITED)
  if (response.status === 429) {
    const body = await readErrorBody(response);
    throw createCodedError(
      body?.message || "Çok fazla giriş denemesi yapıldı. Lütfen bir süre sonra tekrar deneyin.",
      body?.code || "RATE_LIMITED",
    );
  }

  if (!response.ok) {
    throw new Error("Giriş işlemi şu anda tamamlanamadı. Kısa bir süre sonra tekrar deneyin; sorun devam ederse destek ekibine başvurun.");
  }

  const payload: unknown = await response.json();
  const data = isRecord(payload) && isLoginPayload(payload.data) ? payload.data : payload;
  if (!isLoginPayload(data)) {
    throw new Error("Giriş yanıtı beklenen biçimde değil. Kısa bir süre sonra tekrar deneyin.");
  }

  // Kurum üyesi ama abonelik ödemesi yapılmamış → desktop'a giriş reddedilir.
  // Platform admin (kendi platformumuzun yöneticisi) bu kontrolden muaftır.
  const user = data?.user;
  if (user && user.subscriptionRequired === true && user.isPlatformAdmin !== true) {
    throw createCodedError(
      "Kurum aboneliğiniz aktif değil. Lütfen kurum yöneticinizle iletişime geçin ve ödemeyi tamamlayın.",
      "SUBSCRIPTION_REQUIRED",
    );
  }

  return data;
}
