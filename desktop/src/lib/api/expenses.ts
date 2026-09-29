import { api } from './client';
import type { QueryParams } from './client';
import type { ExpenseRequest } from '../../types/api/generated';

export interface ExpenseItem {
  id: string;
  category: string;
  title: string;
  vendorName: string;
  invoiceNo: string;
  amount: number;
  currency: string;
  expenseDateUtc: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  note: string;
  branchId: string | null;
  branchName: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface ExpenseCategoryTotal {
  category: string;
  total: number;
  count: number;
}

/** GET /api/finance/expenses (ExpensesController.Get). */
export interface ExpenseListResponse {
  items: ExpenseItem[];
  summary: {
    total: number;
    count: number;
    byCategory: ExpenseCategoryTotal[];
  };
  categories: string[];
  vehicles: Array<{ id: string; plateNumber: string }>;
}

export interface ExpenseQuery extends QueryParams {
  from?: string;
  to?: string;
  category?: string;
  vehicleId?: string;
}

// ─── İşletme giderleri (mazot, bakım, kira, sigorta...) ───────────────────────
// İşletme giderleri — kurumdan bağımsız genel finans modülü (okul + sürücü kursu).
export const fetchExpenses = (params: ExpenseQuery = {}) => api.get<ExpenseListResponse>('/api/finance/expenses', { params });
export const createExpense = (payload: ExpenseRequest) => api.post<{ id: string }>('/api/finance/expenses', payload);
export const updateExpense = (id: string, payload: ExpenseRequest) => api.put<{ id: string }>(`/api/finance/expenses/${id}`, payload);
export const deleteExpense = (id: string) => api.delete<{ deleted: boolean }>(`/api/finance/expenses/${id}`);
