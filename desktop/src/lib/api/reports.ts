import { api } from './client';
import type { QueryParams } from './client';
import { isNotFoundError } from './shared';

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
