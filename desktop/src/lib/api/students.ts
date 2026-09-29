import { api } from './client';
import type {
  CreateStudentRequest,
  PromoteStudentsRequest,
  PromoteStudentsResult,
  StudentCredentialsDto,
  StudentSummaryDto,
  UpdateStudentRequest,
} from '../../types/api/generated';
import type { UserLike } from '../../types/session';

export async function fetchStudents(): Promise<StudentSummaryDto[] | null> {
  const response = await api.get<StudentSummaryDto[]>('/api/students');
  return response;
}

function normalizeForMatch(value: unknown = ''): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

// Geçerli öğrencinin kendi sınıfını çözer. Sınıf bazlı sayfalarda (soru bankası,
// sınav, deneme, ödev) yalnızca kendi sınıfının içeriğini göstermek için kullanılır.
let cachedMyClassName: string | undefined;
export async function getMyClassName(user: UserLike | null | undefined): Promise<string> {
  if (cachedMyClassName !== undefined) return cachedMyClassName;
  try {
    const students = await fetchStudents();
    const list = Array.isArray(students) ? students : [];
    const username = normalizeForMatch(user?.username);
    const fullName = normalizeForMatch(user?.name);
    const me = (username && list.find((item) => normalizeForMatch(item.username) === username))
      || (fullName && list.find((item) => normalizeForMatch(item.fullName) === fullName))
      || null;
    cachedMyClassName = me?.className || '';
  } catch {
    cachedMyClassName = '';
  }
  return cachedMyClassName;
}

// Bir içeriğin sınıf hedefi öğrencinin sınıfıyla eşleşiyor mu? Sınıfsız/genel
// içerikler herkese görünür; öğrencinin sınıfı çözülemediyse yalnızca genel
// içerikler görünür.
export function classMatchesMine(itemClassName: string | null | undefined, myClassName: string | null | undefined): boolean {
  const mine = normalizeForMatch(myClassName);
  const target = normalizeForMatch(itemClassName);
  if (!target || target === 'tum siniflar' || target === 'tumu' || target === 'genel' || target === 'tum') return true;
  if (!mine) return false;
  return target
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .some((part) => part === mine);
}

// Dönem sonu sınıf yükseltme (7-A → 8-A). Yalnız kurum yöneticisi ve şube müdürü;
// yetki backend'de zorlanır (Admin rolü + students.edit).
export async function promoteStudents(payload: PromoteStudentsRequest): Promise<PromoteStudentsResult | null> {
  return api.post<PromoteStudentsResult>('/api/students/promote', payload);
}

export async function createStudent(
  payload: CreateStudentRequest,
  branchId?: string | null,
): Promise<StudentCredentialsDto | null> {
  const config = branchId ? { headers: { 'X-Branch-Filter': branchId } } : undefined;
  const response = await api.post<StudentCredentialsDto>('/api/students', payload, config);
  return response;
}

export async function updateStudent(id: string, payload: UpdateStudentRequest): Promise<StudentSummaryDto | null> {
  const response = await api.put<StudentSummaryDto>(`/api/students/${id}`, payload);
  return response;
}
