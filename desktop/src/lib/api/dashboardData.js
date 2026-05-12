import { api } from './client';

function normalizeText(value = '') {
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

function isToday(value) {
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
function todayScheduleDayName() {
  return SCHEDULE_DAY_NAMES[new Date().getDay()];
}

function pickScheduleTodayForTeacher(scheduleEntries, teacherName) {
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

function pickScheduleTodayForClass(scheduleEntries, className) {
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

function safeData(result, fallback) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatShortDate(value) {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatLongDate(value) {
  if (!value) return 'Bilinmiyor';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseHumanDateLabel(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = String(value).trim();
  const parts = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!parts) return null;

  const [, day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T09:00:00`);
}

function groupLessons(attendanceEntries, { className, studentName } = {}) {
  const filtered = attendanceEntries.filter((item) => {
    if (className && item.className !== className) return false;
    if (studentName && item.studentName !== studentName) return false;
    return true;
  });

  const lessonMap = new Map();
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

function mapActivities(announcements, notifications) {
  return [
    ...announcements.slice(0, 3).map((item, index) => ({
      id: `announcement-${index}`,
      message: item.title,
      time: item.dateLabel || item.date || 'Bugün',
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

function resolveStudentFromSession(user, students) {
  const username = normalizeText(user?.username);
  const fullName = normalizeText(user?.name);

  return (
    students.find((item) => normalizeText(item.username) === username) ||
    students.find((item) => normalizeText(item.fullName) === fullName) ||
    students[0] ||
    null
  );
}

function resolveParentChildren(user, students) {
  const name = normalizeText(user?.name);
  const username = normalizeText(user?.username);
  const email = normalizeText(user?.email);
  const emailLocal = email.includes('@') ? email.split('@')[0] : email;

  const matched = students.filter((student) => {
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

  if (matched.length > 0) return matched;
  return [];
}

export async function fetchAdminDashboardData() {
  const results = await Promise.allSettled([
    api.get('/api/students'),
    api.get('/api/staff'),
    api.get('/api/attendance'),
    api.get('/api/examresults'),
    api.get('/api/announcements'),
    api.get('/api/messages/threads'),
    api.get('/api/notifications', { params: { targetRole: 'Admin' } }),
  ]);

  const students = safeData(results[0], []);
  const staff = safeData(results[1], []);
  const attendance = safeData(results[2], []);
  const exams = safeData(results[3], []);
  const announcements = safeData(results[4], []);
  const threads = safeData(results[5], []);
  const notifications = safeData(results[6], []);

  const teachers = staff.filter((item) => normalizeText(item.role) === 'teacher');
  const classes = new Set(students.map((item) => item.className).filter(Boolean));
  const todayAttendance = attendance.filter((item) => isToday(item.lessonDate));
  const uniquePresentStudents = new Set(
    todayAttendance
      .filter((item) => normalizeText(item.status) === 'katildi')
      .map((item) => item.studentName)
  ).size;

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
    quickStats: {
      attendanceRate: students.length > 0 ? Math.round((uniquePresentStudents / students.length) * 100) : 0,
      answeredMessagesRate: threads.length > 0 ? Math.round((threads.filter((item) => safeNumber(item.unreadCount) === 0).length / threads.length) * 100) : 0,
      contentRate: announcements.length > 0 ? Math.min(100, announcements.length * 12) : 0,
      examRate: exams.length > 0 ? Math.round(exams.reduce((sum, item) => sum + safeNumber(item.score), 0) / exams.length) : 0,
    },
  };
}

export async function fetchStudentDashboardData(user) {
  const results = await Promise.allSettled([
    api.get('/api/students'),
    api.get('/api/contents', { params: { visibleOnly: true } }),
    api.get('/api/studyplans'),
    api.get('/api/homework'),
    api.get('/api/announcements', { params: { audience: 'Ogrenci' } }),
    api.get('/api/messages/threads'),
    api.get('/api/attendance'),
    api.get('/api/schedule'),
  ]);

  const students = safeData(results[0], []);
  const contents = safeData(results[1], []);
  const studyPlan = results[2].status === 'fulfilled' ? results[2].value : null;
  const homework = safeData(results[3], []);
  const announcements = safeData(results[4], []);
  const threads = safeData(results[5], []);
  const attendance = safeData(results[6], []);
  const scheduleEntries = safeData(results[7], []);

  const student = resolveStudentFromSession(user, students);
  const studentName = student?.fullName || user?.name || 'Öğrenci';
  const className = student?.className || '';

  const [examResultResponse, questionBankResponse] = await Promise.allSettled([
    api.get('/api/examresults', { params: { studentName } }),
    api.get('/api/questionbank', { params: className ? { className } : undefined }),
  ]);

  const exams = safeData(examResultResponse, []);
  const questionBank = safeData(questionBankResponse, []);

  const studentAttendance = attendance.filter((item) => normalizeText(item.studentName) === normalizeText(studentName));
  // Bugünkü program /api/schedule'dan, öğrencinin sınıfına göre.
  const todayLessons = pickScheduleTodayForClass(scheduleEntries, className).slice(0, 4);
  const pendingAssignments = homework.filter((item) => !item.submissions?.some((submission) => normalizeText(submission.studentName) === normalizeText(studentName)));
  const contentProgress = contents.length > 0
    ? Math.round(contents.reduce((sum, item) => sum + safeNumber(item.progress), 0) / contents.length)
    : 0;
  const examSignals = announcements.filter((item) => /sinav|deneme|quiz/i.test(`${item.title} ${item.detail || ''}`));

  return {
    greetingName: studentName.split(' ')[0],
    stats: {
      todayLessons: todayLessons.length,
      upcomingExams: examSignals.length || Math.min(2, exams.length),
      completedContent: contentProgress,
      pendingAssignments: pendingAssignments.length,
      streak: safeNumber(studyPlan?.streakCount, 0),
      xp: safeNumber(studyPlan?.xpPoints, 0),
      level: Math.max(1, Math.floor(safeNumber(studyPlan?.xpPoints, 0) / 100) + 1),
      xpToNext: Math.max(100, 100 - (safeNumber(studyPlan?.xpPoints, 0) % 100)),
      rank: Math.max(1, Math.min(students.length || 1, Math.floor((students.length || 1) / 5))),
      totalStudents: students.length || 1,
    },
    todayLessons,
    upcomingExams: (examSignals.length ? examSignals : exams)
      .slice(0, 2)
      .map((item, index) => ({
        subject: item.subject || item.title || `Yaklaşan sınav ${index + 1}`,
        date: parseHumanDateLabel(item.dateLabel || item.date)?.toISOString() || new Date().toISOString(),
        type: item.type || item.audience || 'Planlandı',
      })),
    recentResults: exams.slice(0, 4).map((item) => ({
      subject: item.subject,
      score: safeNumber(item.score),
      date: parseHumanDateLabel(item.dateLabel || item.date)?.toISOString() || new Date().toISOString(),
      type: item.type || 'Sınav',
    })),
    achievements: [
      {
        id: 1,
        name: 'Düzenli Başlangıç',
        unlocked: safeNumber(studyPlan?.xpPoints) >= 50,
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

export async function fetchTeacherDashboardData(user) {
  const results = await Promise.allSettled([
    api.get('/api/students'),
    api.get('/api/attendance'),
    api.get('/api/messages/threads'),
    api.get('/api/homework'),
    api.get('/api/contents', { params: { visibleOnly: false } }),
    api.get('/api/notifications', { params: { targetRole: 'Teacher' } }),
    api.get('/api/schedule'),
  ]);

  const students = safeData(results[0], []);
  const attendance = safeData(results[1], []);
  const threads = safeData(results[2], []);
  const homework = safeData(results[3], []);
  const contents = safeData(results[4], []);
  const notifications = safeData(results[5], []);
  const scheduleEntries = safeData(results[6], []);

  // Bugünkü program /api/schedule'dan; attendance sadece yoklama durumu için.
  const todayLessons = pickScheduleTodayForTeacher(scheduleEntries, user?.name).slice(0, 4);
  const todayAttendanceGroups = new Set(
    attendance
      .filter((item) => isToday(item.lessonDate))
      .map((item) => `${item.className}-${item.lesson}-${item.lessonDate}`)
  ).size;

  return {
    teacherName: user?.name || 'Öğretmenim',
    stats: {
      todayLessons: todayLessons.length,
      pendingQuestions: threads.reduce((sum, item) => sum + safeNumber(item.unreadCount), 0),
      completedAttendance: todayAttendanceGroups,
      totalStudents: students.length,
    },
    todaySchedule: todayLessons,
    pendingQuestions: threads
      .filter((item) => safeNumber(item.unreadCount) > 0)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        student: item.contactName,
        question: item.lastMessagePreview,
        time: formatLongDate(item.lastMessageAtUtc),
        class: item.contactRole,
      })),
    quickStats: {
      activeHomework: homework.length,
      visibleContent: contents.filter((item) => normalizeText(item.publishStatus) === 'yayinda').length,
      notifications: notifications.length,
    },
  };
}

export async function fetchParentDashboardData(user) {
  const studentResult = await api.get('/api/students').catch(() => []);
  const children = resolveParentChildren(user, studentResult);
  const results = await Promise.allSettled([
    Promise.resolve(studentResult),
    api.get('/api/announcements', {
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
    api.get('/api/messages/threads'),
    api.get('/api/attendance'),
    api.get('/api/accounting/dashboard'),
  ]);

  const students = safeData(results[0], []);
  const announcements = safeData(results[1], []);
  const threads = safeData(results[2], []);
  const attendance = safeData(results[3], []);
  const accounting = results[4].status === 'fulfilled' ? results[4].value : null;

  const selectedChild = children[0] || null;

  const exams = selectedChild
    ? await api.get('/api/examresults', { params: { studentName: selectedChild.fullName } }).catch(() => [])
    : [];

  const childAttendance = selectedChild
    ? attendance.filter((item) => normalizeText(item.studentName) === normalizeText(selectedChild.fullName))
    : [];

  const presentCount = childAttendance.filter((item) => normalizeText(item.status) === 'katildi').length;
  const excuseCount = childAttendance.filter((item) => normalizeText(item.status) === 'izinli').length;
  const absentCount = childAttendance.filter((item) => normalizeText(item.status) === 'devamsiz').length;
  const totalAttendance = childAttendance.length || 1;
  const attendanceRate = Math.round((presentCount / totalAttendance) * 100);

  const childCollections = (accounting?.collections || []).filter(
    (item) => normalizeText(item.name) === normalizeText(selectedChild?.fullName)
  );
  const childInstallments = (accounting?.installments || []).filter(
    (item) => normalizeText(item.student) === normalizeText(selectedChild?.fullName)
  );

  const paidTotal = childCollections.reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const pendingPayment = childInstallments
    .filter((item) => normalizeText(item.status) !== 'odendi')
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);

  return {
    children,
    selectedChild,
    selectedChildSummary: selectedChild
        ? {
          attendance: attendanceRate,
          lastExam: exams[0]
            ? { subject: exams[0].subject, score: safeNumber(exams[0].score) }
            : { subject: 'Henüz kayıt yok', score: 0 },
          pendingPayment,
          paidTotal,
        }
      : null,
    announcements: announcements.slice(0, 4),
    unreadMessages: threads.reduce((sum, item) => sum + safeNumber(item.unreadCount), 0),
    attendanceBreakdown: {
      present: presentCount,
      absent: absentCount,
      excuse: excuseCount,
      rate: attendanceRate,
    },
    exams: exams.slice(0, 4),
  };
}
