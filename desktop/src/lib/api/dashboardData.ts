import { api } from './client';
import { isUserPassive } from '../userStatus';
import type { PlannedExam } from './plannedExams';
import type { UserLike } from '../../types/session';
import type {
  AnnouncementDto,
  AttendanceEntryDto,
  ClassRankingDto,
  ContentDto,
  ExamResultDto,
  HomeworkAssignmentDto,
  MessageThreadDto,
  NotificationDto,
  QuestionBankItemDto,
  QuestionPracticeAttemptDto,
  QuestionThreadDto,
  ScheduleEntryDto,
  StaffLeaveDto,
  StaffSummaryDto,
  StudentFinanceAccountDto,
  StudentSummaryDto,
  StudyPlanStateDto,
} from '../../types/api/generated';

type DateInput = string | number | Date | null | undefined;

/** Pano "bugünkü dersler" satırı. */
export interface DashboardLesson {
  time: string;
  subject: string;
  class: string;
  teacher: string;
  status: string;
  room?: string;
}

export interface DashboardActivity {
  id: string;
  message: string;
  time: string;
  icon: string;
}

function normalizeText(value: unknown = ''): string {
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

function isToday(value: DateInput): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// Bugünkü Türkçe gün adı (ScheduleController kayıtlarındaki 'day' field
// ile aynı format: 'Pazartesi'...'Pazar').
const SCHEDULE_DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
function todayScheduleDayName(): string {
  return SCHEDULE_DAY_NAMES[new Date().getDay()] ?? '';
}

function pickScheduleTodayForTeacher(scheduleEntries: readonly ScheduleEntryDto[], teacherName: string | null | undefined): DashboardLesson[] {
  if (!Array.isArray(scheduleEntries) || !teacherName) return [];
  const teacherKey = normalizeText(teacherName);
  const todayKey = todayScheduleDayName();
  return scheduleEntries
    .filter((entry) => entry.day === todayKey && normalizeText(entry.teacher) === teacherKey)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
    .map((entry) => ({
      time: entry.time || '—',
      subject: entry.subject || 'Ders',
      class: entry.className || '',
      teacher: entry.teacher || teacherName,
      status: 'upcoming',
    }));
}

function pickScheduleTodayForClass(scheduleEntries: readonly ScheduleEntryDto[], className: string | null | undefined): DashboardLesson[] {
  if (!Array.isArray(scheduleEntries) || !className) return [];
  const classKey = normalizeText(className);
  const todayKey = todayScheduleDayName();
  return scheduleEntries
    .filter((entry) => entry.day === todayKey && normalizeText(entry.className) === classKey)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
    .map((entry) => ({
      time: entry.time || '—',
      subject: entry.subject || 'Ders',
      class: entry.className || className,
      teacher: entry.teacher || '',
      status: 'upcoming',
    }));
}

/** Başarısız ya da boş (204) yanıtta varsayılana düşer. */
function safeData<T>(result: PromiseSettledResult<T | null> | undefined, fallback: T): T {
  return result?.status === 'fulfilled' ? (result.value ?? fallback) : fallback;
}

function settledValue<T>(result: PromiseSettledResult<T | null> | undefined): T | null {
  return result?.status === 'fulfilled' ? result.value : null;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatShortDate(value: DateInput): string {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function parseHumanDateLabel(value: DateInput): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = String(value).trim();
  const parts = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!parts) return null;

  const [, day = '', month = '', year = ''] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T09:00:00`);
}

function groupLessons(
  attendanceEntries: readonly AttendanceEntryDto[],
  { className, studentName }: { className?: string; studentName?: string } = {},
): DashboardLesson[] {
  const filtered = attendanceEntries.filter((item) => {
    if (className && item.className !== className) return false;
    if (studentName && item.studentName !== studentName) return false;
    return true;
  });

  const lessonMap = new Map<string, DashboardLesson>();
  filtered.forEach((item) => {
    const key = `${item.className}-${item.lesson}-${item.lessonDate}`;
    if (!lessonMap.has(key)) {
      lessonMap.set(key, {
        time: isToday(item.lessonDate) ? 'Bugün' : formatShortDate(item.lessonDate),
        subject: item.lesson || 'Ders',
        class: item.className || 'Sınıf',
        teacher: isToday(item.lessonDate) ? 'Devam kaydı işlendi' : 'Geçmiş kayıt',
        room: item.status || 'Durum yok',
        status: isToday(item.lessonDate) ? 'ongoing' : 'completed',
      });
    }
  });

  return Array.from(lessonMap.values()).slice(0, 4);
}

function mapActivities(announcements: readonly AnnouncementDto[], notifications: readonly NotificationDto[]): DashboardActivity[] {
  return [
    ...announcements.slice(0, 3).map((item, index) => ({
      id: `announcement-${index}`,
      message: item.title,
      time: item.dateLabel || 'Bugün',
      icon: 'file',
    })),
    ...notifications.slice(0, 3).map((item) => ({
      id: item.id,
      message: item.title,
      time: item.timeLabel || 'Şimdi',
      icon: 'check',
    })),
  ].slice(0, 6);
}

function resolveStudentFromSession(user: UserLike | null | undefined, students: readonly StudentSummaryDto[]): StudentSummaryDto | null {
  const username = normalizeText(user?.username);
  const fullName = normalizeText(user?.name);

  return (
    students.find((item) => normalizeText(item.username) === username) ||
    students.find((item) => normalizeText(item.fullName) === fullName) ||
    students[0] ||
    null
  );
}

function resolveParentChildren(user: UserLike | null | undefined, students: readonly StudentSummaryDto[]): StudentSummaryDto[] {
  const name = normalizeText(user?.name);
  const username = normalizeText(user?.username);
  const email = normalizeText(user?.email);
  const emailLocal = email.includes('@') ? (email.split('@')[0] ?? '') : email;

  return students.filter((student) => {
    const parentName = normalizeText(student.parentName);
    const parentEmail = normalizeText(student.parentEmail);
    return (
      parentName === name ||
      (name && parentName.includes(name)) ||
      (parentName && name.includes(parentName)) ||
      (username && (parentEmail.includes(username) || parentName.includes(username))) ||
      (email && parentEmail === email) ||
      (emailLocal && parentEmail.includes(emailLocal))
    );
  });
}

// ─── Yönetici panosu ─────────────────────────────────────────────────────────

export interface QuestionResponseTeacherRow {
  teacherName: string;
  askedCount: number;
  answeredCount: number;
  questions: Array<{ id: string; studentName: string; title: string; status: string }>;
}

export interface QuestionResponseClassRow {
  className: string;
  askedCount: number;
  answeredCount: number;
  responseRate: number;
  teachers: QuestionResponseTeacherRow[];
}

type ActivityPeriod = 'day' | 'week' | 'month' | 'year';

export interface AdminDashboardData {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    todayAttendanceRate: number;
  };
  lessons: DashboardLesson[];
  pendingItems: Array<{ id: string; studentName: string; question: string; subject: string }>;
  activities: DashboardActivity[];
  announcements: Array<{ id: string; title: string; detail: string; date: string; audience: string }>;
  classOptions: string[];
  todayLeaves: Array<{ id: string; staffName: string; leaveType: string; endDate: string }>;
  attendanceSeries: Array<{ label: string; value: number; present: number; total: number }>;
  questionResponseByClass: QuestionResponseClassRow[];
  activeStudentStats: Record<ActivityPeriod, { uniqueCount: number; totalStudents: number }>;
  quickStats: {
    attendanceRate: number;
    answeredMessagesRate: number;
    publishedAnnouncements: number;
    unansweredMessages: number;
    todayLeaveCount: number;
  };
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    studentsResult,
    staffResult,
    attendanceResult,
    announcementsResult,
    threadsResult,
    notificationsResult,
    leavesResult,
    questionThreadsResult,
  ] = await Promise.allSettled([
    api.get<StudentSummaryDto[]>('/api/students'),
    api.get<StaffSummaryDto[]>('/api/staff'),
    api.get<AttendanceEntryDto[]>('/api/attendance'),
    api.get<AnnouncementDto[]>('/api/announcements'),
    api.get<MessageThreadDto[]>('/api/messages/threads'),
    api.get<NotificationDto[]>('/api/notifications', { params: { targetRole: 'Admin' } }),
    api.get<StaffLeaveDto[]>('/api/staff-hr/leaves'),
    api.get<QuestionThreadDto[]>('/api/questionthreads'),
  ]);

  const students = safeData(studentsResult, []).filter((item) => !isUserPassive(item.status));
  const staff = safeData(staffResult, []).filter((item) => !isUserPassive(item.status));
  const attendance = safeData(attendanceResult, []);
  const announcements = safeData(announcementsResult, []);
  const threads = safeData(threadsResult, []);
  const notifications = safeData(notificationsResult, []);
  const leaves = safeData(leavesResult, []);
  const questionThreads = safeData(questionThreadsResult, []);

  const teachers = staff.filter((item) => normalizeText(item.role) === 'teacher');
  const classes = new Set(students.map((item) => item.className).filter(Boolean));
  const todayAttendance = attendance.filter((item) => isToday(item.lessonDate));
  const uniquePresentStudents = new Set(
    todayAttendance
      .filter((item) => normalizeText(item.status) === 'katildi')
      .map((item) => item.studentName)
  ).size;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const approvedLeave = (item: StaffLeaveDto) => {
    const status = normalizeText(item.status);
    return status.includes('onay') || status.includes('approved');
  };
  const todayLeaves = leaves
    .filter((item) => {
      const start = new Date(item.startDateUtc);
      const end = new Date(item.endDateUtc);
      return approvedLeave(item)
        && !Number.isNaN(start.getTime())
        && !Number.isNaN(end.getTime())
        && start < todayEnd
        && end >= todayStart;
    })
    .map((item) => ({
      id: item.id,
      staffName: item.staffName || 'Personel',
      leaveType: item.leaveType || 'İzin',
      endDate: item.endDateUtc,
    }));

  const dateKey = (value: DateInput) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const attendanceSeries = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart);
    day.setDate(todayStart.getDate() - (6 - index));
    const key = dateKey(day);
    const dayRows = attendance.filter((item) => dateKey(item.lessonDate) === key);
    const uniqueRows = new Map<string, AttendanceEntryDto>();
    dayRows.forEach((item) => {
      const studentKey = normalizeText(item.studentName);
      if (studentKey) uniqueRows.set(studentKey, item);
    });
    const rows = [...uniqueRows.values()];
    const present = rows.filter((item) => {
      const status = normalizeText(item.status);
      return status.includes('katildi') || status.includes('present') || status.includes('geldi');
    }).length;
    return {
      label: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(day),
      value: rows.length > 0 ? Math.round((present / rows.length) * 100) : 0,
      present,
      total: rows.length,
    };
  });

  const studentClassByKey = new Map<string, string>();
  students.forEach((student) => {
    const keys = [student.fullName, student.username].map(normalizeText).filter(Boolean);
    keys.forEach((key) => studentClassByKey.set(key, student.className || 'Sınıf belirtilmemiş'));
  });
  const responseByClassMap = new Map<string, Map<string, QuestionResponseTeacherRow>>();
  questionThreads.forEach((thread) => {
    const studentKey = normalizeText(thread.studentUsername || thread.studentName);
    const className = studentClassByKey.get(studentKey) || 'Sınıf belirtilmemiş';
    const teacherName = thread.teacherName || 'Öğretmen belirtilmemiş';
    let teacherMap = responseByClassMap.get(className);
    if (!teacherMap) {
      teacherMap = new Map();
      responseByClassMap.set(className, teacherMap);
    }
    let row = teacherMap.get(teacherName);
    if (!row) {
      row = { teacherName, askedCount: 0, answeredCount: 0, questions: [] };
      teacherMap.set(teacherName, row);
    }
    const teacherAnswered = Array.isArray(thread.replies)
      ? thread.replies.some((reply) => ['teacher', 'admin', 'administrative'].includes(normalizeText(reply.senderRole)))
      : false;
    const statusAnswered = ['cevaplandi', 'yanitlandi', 'answered', 'closed', 'cozuldu'].some((token) => normalizeText(thread.status).includes(token));
    row.askedCount += 1;
    if (teacherAnswered || statusAnswered) row.answeredCount += 1;
    row.questions.push({
      id: thread.id,
      studentName: thread.studentName || 'Öğrenci',
      title: thread.title || thread.questionText || 'Soru',
      status: thread.status || (teacherAnswered ? 'Cevaplandı' : 'Bekliyor'),
    });
  });
  const questionResponseByClass = [...responseByClassMap.entries()]
    .map(([className, teacherMap]) => {
      const teacherRows = [...teacherMap.values()].sort((a, b) => b.askedCount - a.askedCount || a.teacherName.localeCompare(b.teacherName, 'tr'));
      const askedCount = teacherRows.reduce((sum, item) => sum + item.askedCount, 0);
      const answeredCount = teacherRows.reduce((sum, item) => sum + item.answeredCount, 0);
      return {
        className,
        askedCount,
        answeredCount,
        responseRate: askedCount > 0 ? Math.round((answeredCount / askedCount) * 100) : 0,
        teachers: teacherRows,
      };
    })
    .sort((left, right) => left.className.localeCompare(right.className, 'tr'));

  const activeStudentsSince = (period: ActivityPeriod) => {
    const start = new Date(todayStart);
    if (period === 'week') start.setDate(start.getDate() - 6);
    if (period === 'month') start.setMonth(start.getMonth() - 1);
    if (period === 'year') start.setFullYear(start.getFullYear() - 1);
    const active = students.filter((student) => {
      const lastLogin = new Date(student.lastLoginAtUtc || '');
      return !Number.isNaN(lastLogin.getTime()) && lastLogin >= start && lastLogin < todayEnd;
    });
    return {
      uniqueCount: new Set(active.map((student) => student.userId || student.id || student.username || student.fullName)).size,
      totalStudents: students.length,
    };
  };
  const activeStudentStats: Record<ActivityPeriod, { uniqueCount: number; totalStudents: number }> = {
    day: activeStudentsSince('day'),
    week: activeStudentsSince('week'),
    month: activeStudentsSince('month'),
    year: activeStudentsSince('year'),
  };

  return {
    stats: {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalClasses: classes.size,
      todayAttendanceRate: students.length > 0 ? Math.round((uniquePresentStudents / students.length) * 100) : 0,
    },
    lessons: groupLessons(todayAttendance),
    pendingItems: threads
      .filter((item) => safeNumber(item.unreadCount) > 0)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        studentName: item.contactName,
        question: item.lastMessagePreview,
        subject: item.contactRole,
      })),
    activities: mapActivities(announcements, notifications),
    announcements: announcements.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title || 'Duyuru',
      detail: item.detail || '',
      date: item.dateLabel || '',
      audience: item.audience || 'Tüm kurum',
    })),
    classOptions: [...classes].sort((left, right) => left.localeCompare(right, 'tr')),
    todayLeaves,
    attendanceSeries,
    questionResponseByClass,
    activeStudentStats,
    quickStats: {
      attendanceRate: students.length > 0 ? Math.round((uniquePresentStudents / students.length) * 100) : 0,
      answeredMessagesRate: threads.length > 0 ? Math.round((threads.filter((item) => safeNumber(item.unreadCount) === 0).length / threads.length) * 100) : 0,
      publishedAnnouncements: announcements.length,
      unansweredMessages: threads.reduce((sum, item) => sum + safeNumber(item.unreadCount), 0),
      todayLeaveCount: todayLeaves.length,
    },
  };
}

// ─── Öğrenci / öğretmen / veli panoları ──────────────────────────────────────
// NOT: Bu üç toplayıcı şu an hiçbir ekrandan çağrılmıyor (panolar kendi
// uçlarını kullanıyor). Tipleme sırasında okudukları alanlar DTO'lara
// indirildi; DTO'da hiç bulunmayan alan okumaları (ör. ödev teslim zaman
// damgası, içerik oluşturma tarihi) her zaman boş döndüğü için kaldırıldı.

interface StudyBucket {
  start: Date;
  end: Date;
  label: string;
}

type StudyEventType = 'question' | 'content' | 'exam' | 'homework' | 'attendance';

export interface StudyStatsSeries {
  labels: string[];
  values: number[];
  total: number;
  summary: { questions: number; contents: number; exams: number; homework: number; attendance: number };
}

// Yalnız zaman damgası taşıyan kaynaklar sayılır: sınav sonucu (dateLabel) ve
// katıldı yoklaması (lessonDate). Ödev teslimi, içerik ve soru denemesi
// DTO'larında bu hesabın okuduğu tarih alanı yoktur.
function buildStudyStats({
  exams = [],
  studentAttendance = [],
}: {
  exams?: readonly ExamResultDto[];
  studentAttendance?: readonly AttendanceEntryDto[];
}): Record<'day' | 'week' | 'month' | 'year', StudyStatsSeries> {
  const startOfDay = (value: Date) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const parseDate = (raw: string | null | undefined) => {
    if (!raw) return null;
    const parsed = parseHumanDateLabel(raw) || new Date(raw);
    return !Number.isNaN(parsed.getTime()) ? parsed : null;
  };

  const events: Array<{ date: Date; type: StudyEventType }> = [];
  const pushEvent = (raw: string | null | undefined, type: StudyEventType) => {
    const parsed = parseDate(raw);
    if (parsed) events.push({ date: parsed, type });
  };

  exams.forEach((item) => pushEvent(item.dateLabel, 'exam'));
  studentAttendance.forEach((item) => {
    if (normalizeText(item.status).includes('katildi')) pushEvent(item.lessonDate, 'attendance');
  });

  const today = startOfDay(new Date());
  const monthShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  const dayBuckets: StudyBucket[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const start = new Date(today); start.setDate(today.getDate() - i);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    dayBuckets.push({ start, end, label: String(start.getDate()) });
  }
  const weekBuckets: StudyBucket[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = new Date(today); start.setDate(today.getDate() - (i * 7) - 6);
    const end = new Date(today); end.setDate(today.getDate() - (i * 7) + 1);
    weekBuckets.push({ start, end, label: `${start.getDate()}.${start.getMonth() + 1}` });
  }
  const monthBuckets: StudyBucket[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    monthBuckets.push({ start, end, label: monthShort[start.getMonth()] ?? '' });
  }
  const yearBuckets: StudyBucket[] = [];
  for (let i = 4; i >= 0; i -= 1) {
    const start = new Date(today.getFullYear() - i, 0, 1);
    const end = new Date(today.getFullYear() - i + 1, 0, 1);
    yearBuckets.push({ start, end, label: String(start.getFullYear()) });
  }

  const build = (buckets: readonly StudyBucket[]): StudyStatsSeries => {
    const values = buckets.map(() => 0);
    const summary = { questions: 0, contents: 0, exams: 0, homework: 0, attendance: 0 };
    const windowStart = buckets[0]?.start;
    const windowEnd = buckets[buckets.length - 1]?.end;
    events.forEach((event) => {
      if (windowStart && event.date < windowStart) return;
      if (windowEnd && event.date >= windowEnd) return;
      const index = buckets.findIndex((bucket) => event.date >= bucket.start && event.date < bucket.end);
      if (index < 0) return;
      values[index] = (values[index] ?? 0) + 1;
      if (event.type === 'question') summary.questions += 1;
      else if (event.type === 'content') summary.contents += 1;
      else if (event.type === 'exam') summary.exams += 1;
      else if (event.type === 'homework') summary.homework += 1;
      else if (event.type === 'attendance') summary.attendance += 1;
    });
    return {
      labels: buckets.map((bucket) => bucket.label),
      values,
      total: values.reduce((sum, value) => sum + value, 0),
      summary,
    };
  };

  return {
    day: build(dayBuckets),
    week: build(weekBuckets),
    month: build(monthBuckets),
    year: build(yearBuckets),
  };
}

/** Yaklaşan etkinlik/sınav listeleri için duyuru ya da sınav sonucunun ortak görünümü. */
interface ExamSignal {
  subject: string;
  title: string;
  type: string;
  detail: string;
  audience: string;
  dateLabel: string;
}

export async function fetchStudentDashboardData(user: UserLike | null | undefined) {
  const [
    studentsResult,
    contentsResult,
    studyPlanResult,
    homeworkResult,
    announcementsResult,
    threadsResult,
    attendanceResult,
    scheduleResult,
  ] = await Promise.allSettled([
    api.get<StudentSummaryDto[]>('/api/students'),
    api.get<ContentDto[]>('/api/contents', { params: { visibleOnly: true } }),
    api.get<StudyPlanStateDto>('/api/studyplans'),
    api.get<HomeworkAssignmentDto[]>('/api/homework'),
    api.get<AnnouncementDto[]>('/api/announcements', { params: { audience: 'Ogrenci' } }),
    api.get<MessageThreadDto[]>('/api/messages/threads'),
    api.get<AttendanceEntryDto[]>('/api/attendance'),
    api.get<ScheduleEntryDto[]>('/api/schedule'),
  ]);

  const students = safeData(studentsResult, []);
  const contents = safeData(contentsResult, []);
  const studyPlan = settledValue(studyPlanResult);
  const homework = safeData(homeworkResult, []);
  const announcements = safeData(announcementsResult, []);
  const threads = safeData(threadsResult, []);
  const attendance = safeData(attendanceResult, []);
  const scheduleEntries = safeData(scheduleResult, []);

  const student = resolveStudentFromSession(user, students);
  const studentName = student?.fullName || user?.name || 'Öğrenci';
  const className = student?.className || '';

  const [examResultResponse, questionBankResponse, , classRankingResponse] = await Promise.allSettled([
    api.get<ExamResultDto[]>('/api/examresults', { params: { studentName } }),
    api.get<QuestionBankItemDto[]>('/api/questionbank', { params: className ? { className } : undefined }),
    api.get<QuestionPracticeAttemptDto[]>('/api/questionbank/attempts', { params: student?.username ? { studentUsername: student.username } : undefined }),
    api.get<ClassRankingDto>('/api/examresults/class-ranking'),
  ]);

  const exams = safeData(examResultResponse, []);
  const questionBank = safeData(questionBankResponse, []);
  const classRanking = settledValue(classRankingResponse);

  const studentAttendance = attendance.filter((item) => normalizeText(item.studentName) === normalizeText(studentName));
  // Bugünkü program /api/schedule'dan, öğrencinin sınıfına göre.
  const todayLessons = pickScheduleTodayForClass(scheduleEntries, className).slice(0, 4);
  const pendingAssignments = homework.filter((item) => !item.submissions?.some((submission) => normalizeText(submission.studentName) === normalizeText(studentName)));
  const contentProgress = contents.length > 0
    ? Math.round(contents.reduce((sum, item) => sum + safeNumber(item.progress), 0) / contents.length)
    : 0;
  const examSignals = announcements.filter((item) => /sinav|deneme|quiz/i.test(`${item.title} ${item.detail || ''}`));
  const signalSource: ExamSignal[] = examSignals.length
    ? examSignals.map((item) => ({ subject: '', title: item.title, type: '', detail: item.detail, audience: item.audience, dateLabel: item.dateLabel }))
    : exams.map((item) => ({ subject: item.subject, title: '', type: item.type, detail: '', audience: '', dateLabel: item.dateLabel }));

  // Not ortalaması ve devam oranı (gerçek veriden türetilir).
  const examScores = exams.map((item) => safeNumber(item.score)).filter((value) => value > 0);
  const averageScore = examScores.length
    ? Math.round((examScores.reduce((sum, value) => sum + value, 0) / examScores.length) * 10) / 10
    : 0;
  const presentCount = studentAttendance.filter((item) => normalizeText(item.status).includes('katildi')).length;
  const attendanceRate = studentAttendance.length
    ? Math.round((presentCount / studentAttendance.length) * 100)
    : 0;

  // Derse göre performans (Ders Performansım paneli).
  const subjectMap = new Map<string, number[]>();
  exams.forEach((item) => {
    const subject = item.subject || 'Genel';
    const scores = subjectMap.get(subject) ?? [];
    scores.push(safeNumber(item.score));
    subjectMap.set(subject, scores);
  });
  const subjectPerformance = Array.from(subjectMap.entries())
    .map(([subject, scores]) => ({
      subject,
      average: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
      count: scores.length,
    }))
    .sort((a, b) => b.average - a.average);

  // Bekleyen ödev listesi + derse göre dağılım (Yaklaşan Ödevler / Ders Dağılımı).
  const pendingList = pendingAssignments.slice(0, 6).map((item) => ({
    subject: item.subject || 'Genel',
    title: item.title || 'Ödev',
    deadline: item.deadline || '',
    status: item.status || 'Bekliyor',
  }));
  const distributionMap = new Map<string, number>();
  pendingAssignments.forEach((item) => {
    const subject = item.subject || 'Genel';
    distributionMap.set(subject, (distributionMap.get(subject) || 0) + 1);
  });
  const totalPending = pendingAssignments.length || 1;
  const assignmentsBySubject = Array.from(distributionMap.entries())
    .map(([subject, count]) => ({ subject, count, percent: Math.round((count / totalPending) * 100) }))
    .sort((a, b) => b.count - a.count);

  // Yaklaşan etkinlikler (gün sayacı), duyurular, önerilen içerikler, haftalık istatistik.
  const dayMs = 24 * 60 * 60 * 1000;
  const upcomingEvents = signalSource
    .slice(0, 4)
    .map((item) => {
      const when = parseHumanDateLabel(item.dateLabel);
      const days = when ? Math.max(0, Math.ceil((when.getTime() - Date.now()) / dayMs)) : null;
      return {
        title: item.subject || item.title || 'Etkinlik',
        detail: item.type || item.detail || item.audience || '',
        days,
      };
    });
  const announcementList = announcements.slice(0, 3).map((item) => ({
    title: item.title || 'Duyuru',
    detail: item.detail || '',
    date: item.dateLabel || '',
  }));
  const suggestedContents = contents.slice(0, 4).map((item) => ({
    title: item.title || 'İçerik',
    subject: item.subject || item.grade || '',
    type: item.fileType || 'İçerik',
    meta: '',
  }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKey = (value: string | null | undefined) => {
    if (!value) return '';
    const parsed = parseHumanDateLabel(value) || new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  };
  // Haftalık seri yalnız sınav sonuçlarını sayar (ödev teslimi ve içerik
  // DTO'larında tarih alanı yok).
  const weeklySeries = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    return exams.filter((item) => dayKey(item.dateLabel) === key).length;
  });
  const weekly = {
    solvedQuestions: questionBank.length,
    watchedVideos: contents.filter((item) => normalizeText(item.fileType).includes('video')).length,
    contentCount: contents.length,
    series: weeklySeries,
  };

  // Gerçek zaman damgalı çalışma hareketlerinden gün/hafta/ay/yıl istatistikleri.
  const studyStats = buildStudyStats({ exams, studentAttendance });

  // Sınıf içi başarı sıralaması (sunucudan, not ortalamasına göre, sızıntısız).
  const rankFromServer = safeNumber(classRanking?.rank, 0);
  const totalFromServer = safeNumber(classRanking?.totalStudents, 0);
  const xpPoints = safeNumber(studyPlan?.xpPoints, 0);

  return {
    greetingName: studentName.split(' ')[0] ?? '',
    className,
    upcomingEvents,
    announcementList,
    suggestedContents,
    weekly,
    studyStats,
    stats: {
      todayLessons: todayLessons.length,
      upcomingExams: examSignals.length || Math.min(2, exams.length),
      completedContent: contentProgress,
      pendingAssignments: pendingAssignments.length,
      averageScore,
      attendanceRate,
      streak: safeNumber(studyPlan?.streakCount, 0),
      xp: xpPoints,
      level: Math.max(1, Math.floor(xpPoints / 100) + 1),
      xpToNext: Math.max(100, 100 - (xpPoints % 100)),
      rank: rankFromServer > 0 ? rankFromServer : null,
      totalStudents: totalFromServer > 0 ? totalFromServer : (students.filter((item) => normalizeText(item.className) === normalizeText(className)).length || null),
      classAverage: Math.round(safeNumber(classRanking?.average, averageScore)),
    },
    subjectPerformance,
    pendingList,
    assignmentsBySubject,
    todayLessons,
    upcomingExams: signalSource
      .slice(0, 2)
      .map((item, index) => ({
        subject: item.subject || item.title || `Yaklaşan sınav ${index + 1}`,
        date: parseHumanDateLabel(item.dateLabel)?.toISOString() || new Date().toISOString(),
        type: item.type || item.audience || 'Planlandı',
      })),
    recentResults: exams.slice(0, 5).map((item) => ({
      subject: item.subject,
      score: safeNumber(item.score),
      date: parseHumanDateLabel(item.dateLabel)?.toISOString() || new Date().toISOString(),
      type: item.type || 'Sınav',
    })),
    achievements: [
      {
        id: 1,
        name: 'Düzenli Başlangıç',
        unlocked: xpPoints >= 50,
        description: 'İlk 50 XP tamamlandı.',
      },
      {
        id: 2,
        name: 'İçerik Kaşifi',
        unlocked: contents.length >= 3,
        description: 'En az 3 içerik görüntülendi.',
      },
      {
        id: 3,
        name: 'Soru Çözüm Serisi',
        unlocked: questionBank.length >= 5,
        description: 'Soru bankasında 5 kayıt erişildi.',
      },
      {
        id: 4,
        name: 'Yüksek Katılım',
        unlocked: studentAttendance.filter((item) => normalizeText(item.status) === 'katildi').length >= 5,
        description: '5 derste tam katılım sağlandı.',
      },
    ],
    summary: {
      watchedVideos: contents.filter((item) => normalizeText(item.fileType).includes('video')).length,
      solvedQuestions: questionBank.length,
    },
    quickActionsCount: {
      unreadMessages: threads.reduce((sum, item) => sum + safeNumber(item.unreadCount), 0),
      announcements: announcements.length,
    },
  };
}

export async function fetchTeacherDashboardData(user: UserLike | null | undefined) {
  const [
    studentsResult,
    ,
    threadsResult,
    homeworkResult,
    contentsResult,
    notificationsResult,
    scheduleResult,
    examResultsResult,
    plannedExamsResult,
    announcementsResult,
  ] = await Promise.allSettled([
    api.get<StudentSummaryDto[]>('/api/students'),
    api.get<AttendanceEntryDto[]>('/api/attendance'),
    api.get<MessageThreadDto[]>('/api/messages/threads'),
    api.get<HomeworkAssignmentDto[]>('/api/homework'),
    api.get<ContentDto[]>('/api/contents', { params: { visibleOnly: false } }),
    api.get<NotificationDto[]>('/api/notifications', { params: { targetRole: 'Teacher' } }),
    api.get<ScheduleEntryDto[]>('/api/schedule'),
    api.get<ExamResultDto[]>('/api/examresults'),
    api.get<PlannedExam[]>('/api/plannedexams'),
    api.get<AnnouncementDto[]>('/api/announcements', { params: { audience: 'Ogretmen' } }),
  ]);

  const students = safeData(studentsResult, []);
  const threads = safeData(threadsResult, []);
  const homework = safeData(homeworkResult, []);
  const contents = safeData(contentsResult, []);
  const notifications = safeData(notificationsResult, []);
  const scheduleEntries = safeData(scheduleResult, []);
  const examResults = safeData(examResultsResult, []);
  const plannedExams = safeData(plannedExamsResult, []);
  const announcements = safeData(announcementsResult, []);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (value: string | undefined) => {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };

  // Bugünkü program + zamana göre durum (Tamamlandı/Devam Ediyor/Sıradaki/Bekliyor).
  let nextMarked = false;
  const todaySchedule = pickScheduleTodayForTeacher(scheduleEntries, user?.name).slice(0, 5).map((lesson) => {
    const [startStr, endStr] = String(lesson.time || '').split(/[-–]/).map((part) => part.trim());
    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
    let status = 'pending';
    if (end != null && end < nowMinutes) status = 'done';
    else if (start != null && end != null && start <= nowMinutes && nowMinutes <= end) status = 'live';
    else if (!nextMarked && start != null && start > nowMinutes) { status = 'next'; nextMarked = true; }
    return { ...lesson, status };
  });
  const completedToday = todaySchedule.filter((lesson) => lesson.status === 'done').length;

  // Sınav ortalaması ve sınıf ortalamaları.
  const examScores = examResults.map((item) => safeNumber(item.score)).filter((value) => value > 0);
  const overallAvg = examScores.length ? Math.round((examScores.reduce((a, b) => a + b, 0) / examScores.length) * 10) / 10 : 0;
  const classExamMap = new Map<string, number[]>();
  examResults.forEach((item) => {
    const cls = item.className || 'Tanımsız';
    const scores = classExamMap.get(cls) ?? [];
    scores.push(safeNumber(item.score));
    classExamMap.set(cls, scores);
  });
  const studentsByClass = new Map<string, number>();
  students.forEach((item) => {
    const cls = item.className || 'Tanımsız';
    studentsByClass.set(cls, (studentsByClass.get(cls) || 0) + 1);
  });
  const teacherClasses = new Set(
    scheduleEntries.filter((item) => normalizeText(item.teacher) === normalizeText(user?.name)).map((item) => item.className).filter(Boolean),
  );
  const overviewClasses = teacherClasses.size ? [...teacherClasses] : [...studentsByClass.keys()];
  const classOverview = overviewClasses.map((className) => {
    const scores = classExamMap.get(className) || [];
    const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    return {
      className,
      studentCount: studentsByClass.get(className) || 0,
      average,
      trend: average && overallAvg ? Math.round((average - overallAvg) * 10) / 10 : 0,
    };
  }).sort((a, b) => b.average - a.average).slice(0, 6);

  // Sınav istatistikleri (donut).
  const completedExams = new Set(examResults.map((item) => `${item.examTitle}-${item.className}`)).size;
  const plannedFuture = plannedExams.filter((item) => {
    const date = parseHumanDateLabel(item.dateLabel || item.date);
    return date && date.getTime() > now.getTime();
  });
  const plannedToday = plannedExams.filter((item) => {
    const date = parseHumanDateLabel(item.dateLabel || item.date);
    return date && isToday(date);
  });
  const examStats = { completed: completedExams, ongoing: plannedToday.length, planned: plannedFuture.length };

  // Ödev dağılımı (donut) + bekleyen değerlendirmeler. Teslim DTO'sunda not
  // alanı olmadığından her teslim "değerlendirilmemiş" sayılır.
  const homeworkDistribution = { delivered: 0, pending: 0, overdue: 0 };
  let pendingGradingCount = 0;
  const pendingGrading: Array<{ className: string; title: string; count: number }> = [];
  homework.forEach((item) => {
    const subs = item.submissions || [];
    const due = item.deadline ? new Date(item.deadline) : null;
    const ungraded = subs.length;
    pendingGradingCount += ungraded;
    if (ungraded > 0) pendingGrading.push({ className: item.className, title: item.title, count: ungraded });
    if (students.length && subs.length >= students.length) homeworkDistribution.delivered += 1;
    else if (due && due < now) homeworkDistribution.overdue += 1;
    else homeworkDistribution.pending += 1;
  });

  const contentViews = contents.reduce((sum, item) => sum + safeNumber(item.views), 0);
  const dayMs = 86400000;

  return {
    teacherName: user?.name || 'Öğretmenim',
    stats: {
      totalCourses: teacherClasses.size
        ? new Set(scheduleEntries.filter((item) => normalizeText(item.teacher) === normalizeText(user?.name)).map((item) => `${item.subject}|${item.className}`)).size
        : new Set(homework.map((item) => item.subject).filter(Boolean)).size,
      totalStudents: students.length,
      todayLessons: todaySchedule.length,
      completedToday,
      pendingGradingCount,
      avgSuccess: overallAvg,
      pendingQuestions: threads.reduce((sum, item) => sum + safeNumber(item.unreadCount), 0),
    },
    classOverview,
    todaySchedule,
    recentActivities: notifications.slice(0, 4).map((item) => ({
      title: item.title || 'Aktivite',
      detail: item.message || '',
      time: item.timeLabel || 'Şimdi',
    })),
    examStats,
    homeworkDistribution,
    homeworkTotal: homework.length,
    contentViews,
    contentViewSeries: contents.slice(0, 12).map((item) => safeNumber(item.views)),
    pendingGrading: pendingGrading.slice(0, 4),
    upcomingExams: plannedFuture
      .map((item) => {
        const date = parseHumanDateLabel(item.dateLabel || item.date);
        return {
          title: item.title || 'Sınav',
          className: item.className || '',
          date,
          days: date ? Math.max(0, Math.ceil((date.getTime() - now.getTime()) / dayMs)) : null,
        };
      })
      .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
      .slice(0, 3),
    recentContents: contents.slice(0, 3).map((item) => ({
      title: item.title || 'İçerik',
      type: item.fileType || 'İçerik',
      date: '',
    })),
    announcementList: announcements.slice(0, 3).map((item) => ({
      title: item.title || 'Duyuru',
      detail: item.detail || '',
      date: item.dateLabel || '',
    })),
    quickStats: {
      activeHomework: homework.length,
      visibleContent: contents.filter((item) => normalizeText(item.publishStatus) === 'yayinda').length,
      notifications: notifications.length,
    },
  };
}

interface ChildSummary {
  attendance: number;
  attendanceCounts: { present: number; absent: number; excuse: number; total: number };
  lastExam: { subject: string; score: number; title: string } | null;
  examTrend: number[];
  pendingPayment: number;
  paidTotal: number;
  exams: ExamResultDto[];
}

export async function fetchParentDashboardData(user: UserLike | null | undefined) {
  const studentResult = (await api.get<StudentSummaryDto[]>('/api/students').catch(() => null)) ?? [];
  const children = resolveParentChildren(user, studentResult);
  const [
    ,
    announcementsResult,
    threadsResult,
    attendanceResult,
    homeworkResult,
    scheduleResult,
    plannedExamsResult,
    notificationsResult,
    financeResult,
  ] = await Promise.allSettled([
    Promise.resolve(studentResult),
    api.get<AnnouncementDto[]>('/api/announcements', {
      params: {
        audience: 'Veli',
        viewerRole: 'Veli',
        viewerUsername: user?.username || '',
        viewerName: user?.name || '',
        viewerEmail: user?.email || '',
        viewerLinkedStudentUsernames: children.map((child) => child.username).filter(Boolean).join(','),
        viewerClassName: children[0]?.className || '',
      },
    }),
    api.get<MessageThreadDto[]>('/api/messages/threads'),
    api.get<AttendanceEntryDto[]>('/api/attendance'),
    api.get<HomeworkAssignmentDto[]>('/api/homework'),
    api.get<ScheduleEntryDto[]>('/api/schedule'),
    api.get<PlannedExam[]>('/api/plannedexams'),
    api.get<NotificationDto[]>('/api/notifications', { params: { targetRole: 'Parent' } }),
    api.get<StudentFinanceAccountDto[]>('/api/parent/finance/children'),
  ]);

  const announcements = safeData(announcementsResult, []);
  const threads = safeData(threadsResult, []);
  const attendance = safeData(attendanceResult, []);
  const homework = safeData(homeworkResult, []);
  const scheduleEntries = safeData(scheduleResult, []);
  const plannedExams = safeData(plannedExamsResult, []);
  const notifications = safeData(notificationsResult, []);
  const financeAccounts = safeData(financeResult, []);

  const selectedChild = children[0] || null;

  const examResults = await Promise.allSettled(
    children.map((child) => api.get<ExamResultDto[]>('/api/examresults', { params: { studentName: child.fullName } }))
  );
  const examsByChild = new Map<string, ExamResultDto[]>();
  children.forEach((child, index) => {
    examsByChild.set(child.fullName, safeData(examResults[index], []));
  });
  const exams = selectedChild ? (examsByChild.get(selectedChild.fullName) || []) : [];

  const buildChildSummary = (child: StudentSummaryDto): ChildSummary => {
    const childExams = examsByChild.get(child.fullName) || [];
    const childAttendance = attendance.filter((item) => normalizeText(item.studentName) === normalizeText(child.fullName));
    const presentCount = childAttendance.filter((item) => normalizeText(item.status).includes('katildi')).length;
    const excuseCount = childAttendance.filter((item) => normalizeText(item.status).includes('izinli')).length;
    const absentCount = childAttendance.filter((item) => normalizeText(item.status).includes('devamsiz')).length;
    const totalAttendance = childAttendance.length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
    // Çocuğun ödeme özeti VELİ KAPSAMLI uçtan gelir (/api/parent/finance/children).
    // Eskiden yönetici ucu (/api/accounting/dashboard) okunuyordu; veli o uca
    // erişemediği için (403) ödenen/bekleyen tutar her velide 0 görünüyordu.
    const childAccount = (Array.isArray(financeAccounts) ? financeAccounts : []).find(
      (item) => normalizeText(item.studentName) === normalizeText(child.fullName)
    );
    const paidTotal = safeNumber(childAccount?.paidTotal);
    const pendingPayment = safeNumber(childAccount?.balance);
    const lastExam = childExams[0];

    return {
      attendance: attendanceRate,
      attendanceCounts: {
        present: presentCount,
        absent: absentCount,
        excuse: excuseCount,
        total: totalAttendance,
      },
      lastExam: lastExam
        ? { subject: lastExam.subject, score: safeNumber(lastExam.score), title: lastExam.examTitle || '' }
        : null,
      examTrend: childExams.slice(0, 7).reverse().map((item) => safeNumber(item.score)).filter((value) => value > 0),
      pendingPayment,
      paidTotal,
      exams: childExams,
    };
  };

  const childSummaries: Record<string, ChildSummary> = {};
  children.forEach((child) => {
    childSummaries[child.fullName] = buildChildSummary(child);
  });

  const selectedSummary = selectedChild ? (childSummaries[selectedChild.fullName] ?? null) : null;
  const classNames = new Set(children.map((child) => normalizeText(child.className)).filter(Boolean));
  const childNames = new Set(children.map((child) => normalizeText(child.fullName)).filter(Boolean));
  const todayLessons = selectedChild ? pickScheduleTodayForClass(scheduleEntries, selectedChild.className).slice(0, 5) : [];
  const pendingHomework = homework
    .filter((item) => {
      const classMatches = !item.className || classNames.has(normalizeText(item.className));
      const submitted = (item.submissions || []).some((submission) => childNames.has(normalizeText(submission.studentName)));
      return classMatches && !submitted;
    })
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title || 'Ödev',
      subject: item.subject || 'Genel',
      className: item.className || '',
      deadline: item.deadline || '',
      status: item.status || 'Bekliyor',
    }));

  const upcomingExams = plannedExams
    .filter((item) => {
      const className = normalizeText(item.className);
      return !className || classNames.has(className);
    })
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title || 'Sınav',
      subject: item.subject || '',
      className: item.className || '',
      date: item.dateLabel || item.date || '',
      status: item.status || 'Planlandı',
    }));

  const activities: DashboardActivity[] = [
    ...mapActivities(announcements, notifications),
    ...exams.slice(0, 3).map((item) => ({
      id: item.id || `${item.subject}-${item.score}`,
      message: `${item.subject || 'Sınav'} sonucu girildi`,
      time: item.dateLabel || '',
      icon: 'exam',
    })),
    ...pendingHomework.slice(0, 3).map((item) => ({
      id: `homework-${item.id || item.title}`,
      message: `${item.subject} ödevi bekliyor`,
      time: item.deadline || '',
      icon: 'homework',
    })),
  ].slice(0, 6);

  // Finansal özet (veli paneli finans odaklı kartları için).
  const financeList = Array.isArray(financeAccounts) ? financeAccounts : [];
  const financeInstallments = financeList.flatMap((account) => account.installments || []);
  const remainingInstallments = financeInstallments.filter(
    (item) => normalizeText(item.status) !== 'paid' && safeNumber(item.remaining) > 0
  );
  const finance = {
    totalDebt: financeList.reduce((sum, account) => sum + safeNumber(account.balance), 0),
    paidTotal: financeList.reduce((sum, account) => sum + safeNumber(account.paidTotal), 0),
    netTotal: financeList.reduce((sum, account) => sum + safeNumber(account.netTotal), 0),
    remainingInstallments: remainingInstallments.length,
    totalInstallments: financeInstallments.length,
    overdueCount: financeList.reduce((sum, account) => sum + safeNumber(account.overdueCount), 0),
    currency: financeList[0]?.currency || 'TRY',
    nextDue: financeList
      .map((account) => account.nextDueDateUtc)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || null,
  };

  return {
    children,
    selectedChild,
    childSummaries,
    selectedChildSummary: selectedSummary,
    finance,
    announcements: announcements.slice(0, 4),
    unreadMessages: threads.reduce((sum, item) => sum + safeNumber(item.unreadCount), 0),
    attendanceBreakdown: {
      present: selectedSummary?.attendanceCounts?.present || 0,
      absent: selectedSummary?.attendanceCounts?.absent || 0,
      excuse: selectedSummary?.attendanceCounts?.excuse || 0,
      rate: selectedSummary?.attendance || 0,
    },
    exams: exams.slice(0, 4),
    todayLessons,
    pendingHomework,
    upcomingExams,
    activities,
  };
}
