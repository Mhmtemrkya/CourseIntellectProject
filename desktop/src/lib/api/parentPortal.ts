import { api } from './client';
import type {
  FinancePaymentDto,
  ParentAccountDto,
  ParentPaymentRequest,
  StudentFinanceAccountDto,
} from '../../types/api/generated';

/** GET /api/parent/academic/children satırı. */
export interface ParentChildAcademic {
  studentName: string;
  className: string;
  examCount: number;
  averageScore: number;
  averageNet: number;
  attendanceRate: number;
  netTrend: number;
  recentExams: Array<{ title: string; subject: string; score: number; net: number; date: string }>;
}

// Veli hesapları (durum + bağlı öğrenciler) — pasifleştirme yönetimi.
export async function fetchParentAccounts(): Promise<ParentAccountDto[]> {
  const response = await api.get<ParentAccountDto[]>('/api/parents/accounts');
  return Array.isArray(response) ? response : [];
}

export async function fetchParentAcademic(): Promise<ParentChildAcademic[]> {
  const response = await api.get<ParentChildAcademic[]>('/api/parent/academic/children');
  return Array.isArray(response) ? response : [];
}

export async function fetchParentChildrenFinance(): Promise<StudentFinanceAccountDto[]> {
  const response = await api.get<StudentFinanceAccountDto[]>('/api/parent/finance/children');
  return Array.isArray(response) ? response : [];
}

export async function parentPay(payload: ParentPaymentRequest): Promise<FinancePaymentDto | null> {
  const response = await api.post<FinancePaymentDto>('/api/parent/finance/pay', payload);
  return response;
}
