import { api } from './client';
import type { QueryParams } from './client';
import { isNotFoundError } from './shared';
import type { TeacherWeeklyReportCreateRequest } from '../../types/api/generated';

/** GET /api/reports/students satırı (ReportsController.GetStudents). */
export interface ReportStudentRow {
  id: string;
  fullName: string;
  username: string;
  className: string;
  programType: string;
  parentName: string;
  parentEmail: string;
  averageScore: number;
  attendanceRate: number;
  status: string;
  enrollmentNet: number;
  enrollmentPaid: number;
  enrollmentBalance: number;
  enrollmentOverdueCount: number;
  enrollmentCurrency: string;
  enrollmentStatus: string;
  enrollmentNextDueDateUtc: string | null;
}

export interface TeacherClassReport {
  className: string;
  studentCount: number;
  average: number;
  attendance: number;
  completion: number;
  trend: string;
  topTopic: string;
  supportTopic: string;
}

export interface TeacherTopicReport {
  name: string;
  success: number;
  questionCount: number;
  riskLevel: string;
}

/** GET /api/reports/teacher-analytics. */
export interface TeacherReportAnalytics {
  classReports: TeacherClassReport[];
  topics: TeacherTopicReport[];
}

export async function fetchReportStudents(params?: QueryParams): Promise<ReportStudentRow[] | null> {
  try {
    const response = await api.get<ReportStudentRow[]>('/api/reports/students', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

export async function fetchTeacherReportAnalytics(params?: QueryParams): Promise<TeacherReportAnalytics> {
  try {
    const response = await api.get<TeacherReportAnalytics>('/api/reports/teacher-analytics', {
      params,
    });
    return response || { classReports: [], topics: [] };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { classReports: [], topics: [] };
    }
    throw error;
  }
}

export interface TeacherWeeklyBootstrapStudent {
  fullName: string;
  username: string;
  className: string;
  parentName: string;
  parentEmail: string;
}

/** GET /api/reports/teacher-weekly/bootstrap. */
export interface TeacherWeeklyBootstrap {
  classes: string[];
  subjects: string[];
  students: TeacherWeeklyBootstrapStudent[];
}

/** ReportsController.ToTeacherWeeklyReportResponse. */
export interface TeacherWeeklyReport {
  id: string;
  teacherUsername: string;
  teacherName: string;
  studentUsername: string;
  studentName: string;
  parentName: string;
  parentEmail: string;
  className: string;
  subject: string;
  title: string;
  summary: string;
  highlights: string;
  supportNotes: string;
  weeklyPeriodLabel: string;
  createdAtUtc: string;
  attachments: Array<{ name: string; url: string; fileType: string }>;
}

export interface TeacherWeeklyTeacherQuery {
  teacherUsername?: string | null;
  teacherName?: string | null;
}

export interface TeacherWeeklyParentQuery {
  studentName?: string | null;
  studentUsername?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
}

export async function fetchTeacherWeeklyReportBootstrap(params?: { teacherUsername?: string | null }): Promise<TeacherWeeklyBootstrap | null> {
  try {
    const response = await api.get<TeacherWeeklyBootstrap>('/api/reports/teacher-weekly/bootstrap', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return { classes: [], subjects: [], students: [] };
    }
    throw error;
  }
}

export async function createTeacherWeeklyReport(payload: TeacherWeeklyReportCreateRequest): Promise<TeacherWeeklyReport | null> {
  try {
    const response = await api.post<TeacherWeeklyReport>('/api/reports/teacher-weekly', payload);
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error('Haftalık rapor servisi bu backend oturumunda bulunamadı. Backend’i güncel kodla yeniden başlat.');
    }
    throw error;
  }
}

export async function fetchTeacherWeeklyReportsForTeacher(params?: TeacherWeeklyTeacherQuery): Promise<TeacherWeeklyReport[] | null> {
  try {
    const response = await api.get<TeacherWeeklyReport[]>('/api/reports/teacher-weekly/teacher', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

export async function fetchTeacherWeeklyReportsForParent(params?: TeacherWeeklyParentQuery): Promise<TeacherWeeklyReport[] | null> {
  try {
    const response = await api.get<TeacherWeeklyReport[]>('/api/reports/teacher-weekly/parent', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}
