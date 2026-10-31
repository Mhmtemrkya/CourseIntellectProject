import { api } from './client';
import type {
  PaySalaryRequest,
  UpdateInvoiceRequest,
  AccountingApprovalDto,
  AccountingCollectionDto,
  AccountingDashboardDto,
  AccountingInstallmentDto,
  AccountingInvoiceDto,
  AccountingNotificationDto,
  AccountingSalaryDto,
  CreateAccountingBenefitRequest,
  CreateAccountingNotificationRequest,
  CreateCollectionRequest,
  CreateInstallmentRequest,
  CreateInvoiceRequest,
  CreateSalaryRequest,
  MarkInvoicePaidRequest,
  UpdateInstallmentRequest,
} from '../../types/api/generated';

/** AccountingController.MapBenefit çıktısı (tutarlar metin olarak saklanır). */
export interface AccountingBenefit {
  id: string;
  studentName: string;
  studentUsername: string;
  className: string;
  benefitType: string;
  title: string;
  rate: string;
  totalAmount: string;
  netAmount: string;
  status: string;
  note: string;
  createdAtLabel: string;
}

/** GET /api/accounting/dashboard: servis panosu + burs/indirim listesi. */
export interface AccountingDashboard extends AccountingDashboardDto {
  benefits: AccountingBenefit[];
}

export interface AccountingRange {
  fromUtc?: string | null;
  toUtc?: string | null;
}

export async function fetchAccountingDashboard(range: AccountingRange = {}): Promise<AccountingDashboard | null> {
  const response = await api.get<AccountingDashboard>('/api/accounting/dashboard', {
    params: Object.keys(range).length ? range : undefined,
  });
  return response;
}

export async function fetchAccountingBenefits(): Promise<AccountingBenefit[] | null> {
  const response = await api.get<AccountingBenefit[]>('/api/accounting/benefits');
  return response;
}

export async function createAccountingBenefit(payload: CreateAccountingBenefitRequest): Promise<AccountingBenefit | null> {
  const response = await api.post<AccountingBenefit>('/api/accounting/benefits', payload);
  return response;
}

export async function createCollection(payload: CreateCollectionRequest): Promise<AccountingCollectionDto | null> {
  const response = await api.post<AccountingCollectionDto>('/api/accounting/collections', payload);
  return response;
}

export async function updateCollection(id: string, payload: CreateCollectionRequest): Promise<AccountingCollectionDto | null> {
  const response = await api.put<AccountingCollectionDto>(`/api/accounting/collections/${id}`, payload);
  return response;
}

export async function deleteCollection(id: string): Promise<void> {
  await api.delete(`/api/accounting/collections/${id}`);
}

export async function createInvoice(payload: CreateInvoiceRequest): Promise<AccountingInvoiceDto | null> {
  const response = await api.post<AccountingInvoiceDto>('/api/accounting/invoices', payload);
  return response;
}

export async function markInvoicePaid(id: string, payload: MarkInvoicePaidRequest): Promise<AccountingInvoiceDto | null> {
  const response = await api.put<AccountingInvoiceDto>(`/api/accounting/invoices/${id}/mark-paid`, payload);
  return response;
}

export async function createInstallment(payload: CreateInstallmentRequest): Promise<AccountingInstallmentDto | null> {
  const response = await api.post<AccountingInstallmentDto>('/api/accounting/installments', payload);
  return response;
}

export async function updateApprovalStatus(id: string, status: string): Promise<AccountingApprovalDto | null> {
  const response = await api.put<AccountingApprovalDto>(`/api/accounting/approvals/${id}/status`, { status });
  return response;
}

export async function createAccountingNotification(payload: CreateAccountingNotificationRequest): Promise<AccountingNotificationDto | null> {
  const response = await api.post<AccountingNotificationDto>('/api/accounting/notifications', payload);
  return response;
}

export async function sendBulkAccountingReminders(): Promise<{ sentCount: number; message: string } | null> {
  const response = await api.post<{ sentCount: number; message: string }>('/api/accounting/bulk-reminders');
  return response;
}

// --- Accounting (extra) ---

export async function createSalary(payload: CreateSalaryRequest): Promise<AccountingSalaryDto | null> {
  const response = await api.post<AccountingSalaryDto>('/api/accounting/salaries', payload);
  return response;
}

export async function updateInstallment(id: string, payload: UpdateInstallmentRequest): Promise<AccountingInstallmentDto | null> {
  const response = await api.put<AccountingInstallmentDto>(`/api/accounting/installments/${id}`, payload);
  return response;
}

export async function markAllAccountingNotificationsRead(): Promise<null> {
  const response = await api.put<null>('/api/accounting/notifications/read-all');
  return response;
}

// --- Fatura ve bordro yaşam döngüsü ---

export async function updateInvoice(id: string, payload: UpdateInvoiceRequest): Promise<AccountingInvoiceDto | null> {
  return api.put<AccountingInvoiceDto>(`/api/accounting/invoices/${id}`, payload);
}

/** İptal edilen fatura silinmez; gider toplamından çıkar, gerekçesiyle kalır. */
export async function cancelInvoice(id: string, reason: string): Promise<AccountingInvoiceDto | null> {
  return api.post<AccountingInvoiceDto>(`/api/accounting/invoices/${id}/cancel`, { reason });
}

/** Yalnız ödenmemiş fatura silinir. */
export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/api/accounting/invoices/${id}`);
}

/** Onaylı (Planlandı) bordronun ödendiğini kaydeder. */
export async function paySalary(id: string, payload: PaySalaryRequest): Promise<AccountingSalaryDto | null> {
  return api.put<AccountingSalaryDto>(`/api/accounting/salaries/${id}/pay`, payload);
}

/**
 * Muhasebe hareket dökümü (yevmiye CSV): dönemdeki tahsilat, iade, gider, maaş ve
 * fatura ödemeleri; belge no, yöntem, şube ve işlem yapan sütunlarıyla. Sunucuda üretilir.
 */
export function downloadAccountingJournal(range: AccountingRange = {}): Promise<Blob | null> {
  return api.get('/api/accounting/exports/csv', {
    params: Object.keys(range).length ? range : undefined,
    responseType: 'blob',
  });
}
