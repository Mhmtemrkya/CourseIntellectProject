import { api } from './client';

/**
 * Okul ana paneli KPI'ları. Kurumun paketinde ya da kullanıcının rolünde olmayan
 * modülün sayacı `null` gelir (sorgu hiç çalıştırılmaz); kişi/sınıf sayaçları her zaman dolu.
 */
export interface SchoolDashboardKpis {
  activeStudents: number;
  activeTeachers: number;
  activeStaff: number;
  activeClasses: number;
  todayLessons: number;
  newRegistrations: number;
  passiveAccounts: number;
  todayAbsent: number | null;
  attendanceRate: number | null;
  upcomingExams: number | null;
  pendingQuestions: number | null;
  unreadMessages: number | null;
  pendingMeetings: number | null;
  activeAnnouncements: number | null;
  pendingLeaves: number | null;
  todayOnLeave: number | null;
  pendingApprovals: number | null;
  openTasks: number | null;
  overdueTasks: number | null;
  expiringDocuments: number | null;
  passwordResetRequests: number | null;
  collections: number | null;
  expenses: number | null;
  net: number | null;
  pendingInstallments: number | null;
  pendingInstallmentAmount: number | null;
  overdueInstallments: number | null;
  overdueInstallmentAmount: number | null;
  overdueLoans: number | null;
  pendingGuidance: number | null;
  pendingConsentForms: number | null;
  activeServiceRoutes: number | null;
}

/** Panonun eylem bloğu; sırayı sunucu belirler (kritikler önce). */
export interface SchoolDashboardAlert {
  type: string;
  severity: string;
  title: string;
  message: string;
  actionPath: string;
}

/** GET /api/admin/dashboard. */
export interface SchoolDashboard {
  generatedAtUtc: string;
  rangeFromUtc: string;
  rangeToUtc: string;
  kpis: SchoolDashboardKpis;
  alerts: SchoolDashboardAlert[];
  charts: {
    monthlyRegistrations: Array<{ label: string; value: number }>;
  };
}

export interface SetupStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
  count: number;
  countLabel: string;
  actionPath: string;
  actionLabel: string;
}

/** GET /api/admin/dashboard/setup. */
export interface SchoolSetupStatus {
  completed: boolean;
  completedSteps: number;
  totalSteps: number;
  steps: SetupStep[];
}

export interface DashboardRange {
  from?: string | null;
  to?: string | null;
}

// Okul kurum sahibi ana paneli — tüm KPI'lar tek uçtan, sunucuda hesaplanır.
// params: { from, to } (ISO). Verilmezse backend "bugün" davranışına düşer.
// Kurumun paketinde/kullanıcının rolünde olmayan modülün sayacı null gelir.
export async function fetchSchoolDashboard(params: DashboardRange = {}): Promise<SchoolDashboard | null> {
  return api.get<SchoolDashboard>('/api/admin/dashboard', { params });
}

// Yeni kurum kurulum sihirbazı: adımlar ve hangilerinin bittiği. "Bitti" bilgisi
// kullanıcının işaretinden değil, kurumun kendi verisinden hesaplanır.
export async function fetchSchoolSetupStatus(): Promise<SchoolSetupStatus | null> {
  return api.get<SchoolSetupStatus>('/api/admin/dashboard/setup');
}
