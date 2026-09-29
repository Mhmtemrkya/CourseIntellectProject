import { api } from './client';
import type {
  CheckoutRequest,
  LibraryBook,
  LibraryLoan,
  LibraryRecommendation,
  LibrarySettings,
} from '../../types/api/generated';

// Kitap/öneri/ayar uçları gövde olarak entity alır; sunucu kimlik ve kurum
// alanlarını kendisi doldurur. Bu yüzden istek tipleri Partial'dır.

/** LibraryController.ToBookDto: kopya sayıları sunucuda hesaplanır. */
export interface LibraryBookRow {
  id: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  shelf: string;
  totalCopies: number;
  notes: string;
  activeLoans: number;
  availableCopies: number;
  reservationCount: number;
}

export interface LibraryLoanRow extends Omit<LibraryLoan, 'tenantId'> {
  overdue: boolean;
  overdueDays: number;
}

export type IsbnLookupResult =
  | { found: false }
  | { found: boolean; title: string; author: string; publisher: string; isbn: string };

export interface MyLibrary {
  activeLoans: Array<{
    id: string;
    bookTitle: string;
    loanedAtUtc: string;
    dueAtUtc: string;
    extensionCount: number;
    overdue: boolean;
  }>;
  history: LibraryLoan[];
  readCount: number;
  reservations: Array<{ id: string; bookTitle: string; status: string; createdAtUtc: string; queuePosition: number }>;
  recommendations: Array<{ bookId: string; bookTitle: string; teacherName: string; note: string; createdAtUtc: string }>;
}

export interface ParentLibraryChild {
  studentName: string;
  className: string;
  readCount: number;
  activeLoans: Array<{ bookTitle: string; dueAtUtc: string; overdue: boolean }>;
}

export interface LibraryStats {
  totalBooks: number;
  totalCopies: number;
  activeLoans: number;
  overdueLoans: number;
  totalLoans: number;
  distinctReaders: number;
  topBooks: Array<{ title: string; count: number }>;
  topReaders: Array<{ student: string; count: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
  monthlyLoans: Array<{ month: string; count: number }>;
}

export interface LibraryBookQuery {
  search?: string | null;
  category?: string | null;
}

export interface LibraryLoanQuery {
  activeOnly?: boolean;
  student?: string | null;
}

// --- Kütüphane (Library) ---

export async function fetchLibraryBooks(params: LibraryBookQuery = {}): Promise<LibraryBookRow[]> {
  const response = await api.get<LibraryBookRow[]>('/api/library/books', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function fetchLibraryCategories(): Promise<string[]> {
  const response = await api.get<string[]>('/api/library/categories');
  return Array.isArray(response) ? response : [];
}

export async function createLibraryBook(payload: Partial<LibraryBook>): Promise<LibraryBookRow | null> {
  return api.post<LibraryBookRow>('/api/library/books', payload);
}

export async function createLibraryBooksBulk(books: Array<Partial<LibraryBook>>): Promise<{ created: number } | null> {
  return api.post<{ created: number }>('/api/library/books/bulk', { books });
}

export async function updateLibraryBook(id: string, payload: Partial<LibraryBook>): Promise<LibraryBookRow | null> {
  return api.put<LibraryBookRow>(`/api/library/books/${id}`, payload);
}

export async function deleteLibraryBook(id: string): Promise<{ deleted: boolean } | null> {
  return api.delete<{ deleted: boolean }>(`/api/library/books/${id}`);
}

export async function lookupIsbn(isbn: string): Promise<IsbnLookupResult | null> {
  return api.get<IsbnLookupResult>('/api/library/isbn-lookup', { params: { isbn } });
}

export async function fetchLibraryLoans(params: LibraryLoanQuery = {}): Promise<LibraryLoanRow[]> {
  const response = await api.get<LibraryLoanRow[]>('/api/library/loans', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function checkoutLibraryBook(payload: CheckoutRequest): Promise<LibraryLoan | null> {
  return api.post<LibraryLoan>('/api/library/loans', payload);
}

export async function returnLibraryLoan(id: string): Promise<{ id: string; returnedAtUtc: string | null; fineAmount: number; overdueDays: number } | null> {
  return api.patch<{ id: string; returnedAtUtc: string | null; fineAmount: number; overdueDays: number }>(`/api/library/loans/${id}/return`, {});
}

export async function extendLibraryLoan(id: string): Promise<LibraryLoan | null> {
  return api.patch<LibraryLoan>(`/api/library/loans/${id}/extend`, {});
}

export async function sendLibraryReminders(): Promise<{ notified: number } | null> {
  return api.post<{ notified: number }>('/api/library/reminders', {});
}

export async function reserveLibraryBook(bookId: string): Promise<{ id: string; status: string; queuePosition: number } | null> {
  return api.post<{ id: string; status: string; queuePosition: number }>('/api/library/reservations', { bookId });
}

export async function cancelLibraryReservation(id: string): Promise<{ cancelled: boolean } | null> {
  return api.delete<{ cancelled: boolean }>(`/api/library/reservations/${id}`);
}

export async function createLibraryRecommendation(payload: Partial<LibraryRecommendation>): Promise<LibraryRecommendation | null> {
  return api.post<LibraryRecommendation>('/api/library/recommendations', payload);
}

export async function fetchLibraryRecommendations(): Promise<LibraryRecommendation[]> {
  const response = await api.get<LibraryRecommendation[]>('/api/library/recommendations');
  return Array.isArray(response) ? response : [];
}

export async function fetchMyLibrary(): Promise<MyLibrary | null> {
  return api.get<MyLibrary>('/api/library/my');
}

export async function fetchParentLibrary(): Promise<ParentLibraryChild[]> {
  const response = await api.get<ParentLibraryChild[]>('/api/library/parent/children');
  return Array.isArray(response) ? response : [];
}

export async function fetchLibraryStats(): Promise<LibraryStats | null> {
  return api.get<LibraryStats>('/api/library/stats');
}

export async function fetchLibrarySettings(): Promise<LibrarySettings | null> {
  return api.get<LibrarySettings>('/api/library/settings');
}

export async function saveLibrarySettings(payload: Partial<LibrarySettings>): Promise<LibrarySettings | null> {
  return api.put<LibrarySettings>('/api/library/settings', payload);
}
