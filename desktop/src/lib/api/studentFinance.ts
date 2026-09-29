import { api } from './client';
import type {
  CollectDownPaymentRequest,
  ConfirmPaymentRequest,
  CreateEnrollmentRequest,
  EInvoiceResultDto,
  EnrollmentContractDto,
  FinanceDashboardDto,
  FinancePaymentDto,
  InstitutionProfileDto,
  IssueEInvoiceRequest,
  PaymentIntentDto,
  PaymentIntentRequest,
  PayrollRequest,
  PayrollResultDto,
  PendingDownPaymentDto,
  ReconciliationRequest,
  ReconciliationResultDto,
  RecordPaymentRequest,
  RefundRequest,
  ReminderResultDto,
  SaveInstitutionProfileRequest,
  StudentFinanceAccountDto,
  StudentFinanceSummaryDto,
  StudentStatementDto,
} from '../../types/api/generated';

/** Öğrenci cari hesabı/ekstre sorgusu: kullanıcı kimliği ya da ad ile. */
export interface StudentFinanceQuery {
  studentUserId?: string | null;
  studentName?: string | null;
}

export interface StatementQuery extends StudentFinanceQuery {
  fromUtc?: string | null;
  toUtc?: string | null;
}

/** Sunucu künyeyi hesaplanan `location` (İlçe / İL) satırıyla döner. */
export type InstitutionProfile = InstitutionProfileDto & { location: string };

export interface DateRangeQuery {
  fromUtc?: string | null;
  toUtc?: string | null;
}

export async function createEnrollment(payload: CreateEnrollmentRequest): Promise<EnrollmentContractDto | null> {
  const response = await api.post<EnrollmentContractDto>('/api/student-finance/enrollments', payload);
  return response;
}

export async function fetchStudentFinanceAccount(params: StudentFinanceQuery): Promise<StudentFinanceAccountDto | null> {
  const response = await api.get<StudentFinanceAccountDto>('/api/student-finance/account', { params });
  return response;
}

/**
 * Kurum künyesi — ekstre/makbuz gibi belgelerin başlığında kullanılır. Kayıt
 * yoksa mevcut kurum verisinden türetilmiş öneri döner (isConfigured=false).
 */
export async function fetchInstitutionProfile(): Promise<InstitutionProfile | null> {
  const response = await api.get<InstitutionProfile>('/api/institution-profile');
  return response;
}

export async function saveInstitutionProfile(payload: SaveInstitutionProfileRequest): Promise<InstitutionProfile | null> {
  const response = await api.put<InstitutionProfile>('/api/institution-profile', payload);
  return response;
}

/**
 * Cari hesap ekstresi (JSON). Tarihler verilmezse ilk hareketten taksit planının
 * sonuna kadar tüm geçmiş döner.
 */
export async function fetchStudentStatement(params: StatementQuery): Promise<StudentStatementDto | null> {
  const response = await api.get<StudentStatementDto>('/api/student-finance/statement', { params });
  return response;
}

/** Aynı ekstrenin kurum künyeli, baskıya uygun PDF çıktısı. */
export function downloadStudentStatementPdf(params: StatementQuery): Promise<Blob | null> {
  return api.get('/api/student-finance/statement', {
    params: { ...params, format: 'pdf' },
    responseType: 'blob',
  });
}

export async function recordFinancePayment(payload: RecordPaymentRequest): Promise<FinancePaymentDto | null> {
  const response = await api.post<FinancePaymentDto>('/api/student-finance/payments', payload);
  return response;
}

export async function fetchFinanceSummaries(className?: string | null): Promise<StudentFinanceSummaryDto[]> {
  const response = await api.get<StudentFinanceSummaryDto[]>('/api/student-finance/summaries', {
    params: className ? { className } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function fetchFinanceDashboard(
  className?: string | null,
  range: DateRangeQuery = {},
): Promise<FinanceDashboardDto | null> {
  const params: DateRangeQuery & { className?: string } = { ...range };
  if (className) params.className = className;
  const response = await api.get<FinanceDashboardDto>('/api/student-finance/dashboard', {
    params: Object.keys(params).length ? params : undefined,
  });
  return response;
}

export async function refundFinancePayment(payload: RefundRequest): Promise<FinancePaymentDto | null> {
  const response = await api.post<FinancePaymentDto>('/api/student-finance/refunds', payload);
  return response;
}

// Peşinatı beklenen (tahsil edilmemiş) sözleşmeler.
export async function fetchPendingDownPayments(): Promise<PendingDownPaymentDto[]> {
  const response = await api.get<PendingDownPaymentDto[]>('/api/student-finance/pending-down-payments');
  return Array.isArray(response) ? response : [];
}

// Bekleyen peşinatı makbuzlu tahsil eder ve sözleşmeyi "ödendi" işaretler.
export async function collectDownPayment(
  contractId: string,
  method: CollectDownPaymentRequest['method'],
): Promise<FinancePaymentDto | null> {
  const response = await api.post<FinancePaymentDto>(`/api/student-finance/contracts/${contractId}/collect-down-payment`, { method });
  return response;
}

export async function sendFinanceReminders(upcomingWindowDays = 7): Promise<ReminderResultDto | null> {
  const response = await api.post<ReminderResultDto>('/api/student-finance/reminders', null, {
    params: { upcomingWindowDays },
  });
  return response;
}

export async function backfillFinanceInstallments(): Promise<{ created: number; message: string } | null> {
  const response = await api.post<{ created: number; message: string }>('/api/student-finance/backfill-installments');
  return response;
}

// Geçmiş "Peşinat" yöntemli kayıt peşinatlarını tek seferde "Nakit"e çevirir.
export async function backfillDownPaymentMethod(): Promise<{ updated: number; message: string } | null> {
  const response = await api.post<{ updated: number; message: string }>('/api/student-finance/backfill-downpayment-method');
  return response;
}

export async function createFinancePaymentIntent(payload: PaymentIntentRequest): Promise<PaymentIntentDto | null> {
  const response = await api.post<PaymentIntentDto>('/api/student-finance/payments/intent', payload);
  return response;
}

export async function confirmFinancePayment(payload: ConfirmPaymentRequest): Promise<{ success: boolean } | null> {
  const response = await api.post<{ success: boolean }>('/api/student-finance/payments/confirm', payload);
  return response;
}

export async function reconcileFinance(payload: ReconciliationRequest): Promise<ReconciliationResultDto | null> {
  const response = await api.post<ReconciliationResultDto>('/api/student-finance/reconciliation', payload);
  return response;
}

export async function issueFinanceEInvoice(payload: IssueEInvoiceRequest): Promise<EInvoiceResultDto | null> {
  const response = await api.post<EInvoiceResultDto>('/api/student-finance/e-invoice/issue', payload);
  return response;
}

export async function calculatePayroll(payload: PayrollRequest): Promise<PayrollResultDto | null> {
  const response = await api.post<PayrollResultDto>('/api/student-finance/payroll/calculate', payload);
  return response;
}
