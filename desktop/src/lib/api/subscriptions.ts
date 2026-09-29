import { api } from './client';
import type {
  CreatePlatformSubscriptionInvoiceRequest,
  MarkPlatformInvoicePaidRequest,
  PlatformSubscriptionInvoiceDto,
} from '../../types/api/generated';

export interface SubscriptionInvoiceQuery {
  status?: string | null;
  search?: string | null;
}

export async function fetchPlatformSubscriptionInvoices(params: SubscriptionInvoiceQuery = {}): Promise<PlatformSubscriptionInvoiceDto[] | null> {
  const response = await api.get<PlatformSubscriptionInvoiceDto[]>('/api/platformsubscriptions', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return response;
}

export async function fetchMyPlatformSubscriptionInvoices(): Promise<PlatformSubscriptionInvoiceDto[] | null> {
  const response = await api.get<PlatformSubscriptionInvoiceDto[]>('/api/platformsubscriptions/mine');
  return response;
}

export async function purchasePlatformSubscription(payload: CreatePlatformSubscriptionInvoiceRequest): Promise<PlatformSubscriptionInvoiceDto | null> {
  const response = await api.post<PlatformSubscriptionInvoiceDto>('/api/platformsubscriptions/purchase', payload);
  return response;
}

export async function markPlatformInvoicePaid(invoiceId: string, payload: Partial<MarkPlatformInvoicePaidRequest> = {}): Promise<PlatformSubscriptionInvoiceDto | null> {
  const response = await api.put<PlatformSubscriptionInvoiceDto>(`/api/platformsubscriptions/${invoiceId}/pay`, payload);
  return response;
}

export async function cancelPlatformInvoice(invoiceId: string, payload: Partial<MarkPlatformInvoicePaidRequest> = {}): Promise<PlatformSubscriptionInvoiceDto | null> {
  const response = await api.put<PlatformSubscriptionInvoiceDto>(`/api/platformsubscriptions/${invoiceId}/cancel`, payload);
  return response;
}
