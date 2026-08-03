import { api } from './client';
import { isUserPassive } from '../userStatus';

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
    api.get('/api/announcements'),
    api.get('/api/messages/threads'),
    api.get('/api/notifications', { params: { targetRole: 'Admin' } }),
    api.get('/api/staff-hr/leaves'),
    api.get('/api/questionthreads'),
  ]);

  const students = safeData(results[0], []).filter((item) => !isUserPassive(item.status));
  const staff = safeData(results[1], []).filter((item) => !isUserPassive(item.status));
  const attendance = safeData(results[2], []);
  const announcements = safeData(results[3], []);
  const threads = safeData(results[4], []);
  const notifications = safeData(results[5], []);
  const leaves = safeData(results[6], []);
  const questionThreads = safeData(results[7], []);

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
  const approvedLeave = (item) => {
    const status = normalizeText(item.status);
    return status.includes('onay') || status.includes('approved');
  };
  const todayLeaves = leaves
    .filter((item) => {
      const start = new Date(item.startDateUtc || item.startDate);
      const end = new Date(item.endDateUtc || item.endDate);
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
      endDate: item.endDateUtc || item.endDate,
    }));

  const dateKey = (value) => {
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
    const uniqueRows = new Map();
    dayRows.forEach((item) => {
      const studentKey = normalizeText(item.studentName || item.studentUsername);
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

  const studentClassByKey = new Map();
  students.forEach((student) => {
    const keys = [student.fullName, student.studentName, student.username, student.userName].map(normalizeText).filter(Boolean);
    keys.forEach((key) => studentClassByKey.set(key, student.className || 'Sınıf belirtilmemiş'));
  });
  const responseByClassMap = new Map();
  questionThreads.forEach((thread) => {
    const studentKey = normalizeText(thread.studentUsername || thread.studentName || thread.contactName);
    const className = studentClassByKey.get(studentKey) || thread.className || 'Sınıf belirtilmemiş';
    const teacherName = thread.teacherName || 'Öğretmen belirtilmemiş';
    if (!responseByClassMap.has(className)) responseByClassMap.set(className, new Map());
    const teacherMap = responseByClassMap.get(className);
    if (!teacherMap.has(teacherName)) {
      teacherMap.set(teacherName, { teacherName, askedCount: 0, answeredCount: 0, questions: [] });
    }
    const row = teacherMap.get(teacherName);
    const teacherAnswered = Array.isArray(thread.replies)
      ? thread.replies.some((reply) => ['teacher', 'admin', 'administrative'].includes(normalizeText(reply.senderRole)))
      : false;
    const statusAnswered = ['cevaplandi', 'yanitlandi', 'answered', 'closed', 'cozuldu'].some((token) => normalizeText(thread.status).includes(token));
    row.askedCount += 1;
    if (teacherAnswered || statusAnswered) row.answeredCount += 1;
    row.questions.push({
      id: thread.id,
      studentName: thread.studentName || thread.contactName || 'Öğrenci',
      title: thread.title || thread.questionText || 'Soru',
      status: thread.status || (teacherAnswered ? 'Cevaplandı' : 'Bekliyor'),
    });
  });
  const questionResponseByClass = [...responseByClassMap.entries()]
    .map(([className, teacherMap]) => {
      const teachers = [...teacherMap.values()].sort((a, b) => b.askedCount - a.askedCount || a.teacherName.localeCompare(b.teacherName, 'tr'));
      const askedCount = teachers.reduce((sum, item) => sum + item.askedCount, 0);
      const answeredCount = teachers.reduce((sum, item) => sum + item.answeredCount, 0);
      return {
        className,
        askedCount,
        answeredCount,
        responseRate: askedCount > 0 ? Math.round((answeredCount / askedCount) * 100) : 0,
        teachers,
      };
    })
    .sort((left, right) => left.className.localeCompare(right.className, 'tr'));

  const activeStudentStats = ['day', 'week', 'month', 'year'].reduce((acc, period) => {
    const start = new Date(todayStart);
    if (period === 'week') start.setDate(start.getDate() - 6);
    if (period === 'month') start.setMonth(start.getMonth() - 1);
    if (period === 'year') start.setFullYear(start.getFullYear() - 1);
    const active = students.filter((student) => {
      const lastLogin = new Date(student.lastLoginAtUtc || student.lastLogin || student.lastSeenAtUtc || '');
      return !Number.isNaN(lastLogin.getTime()) && lastLogin >= start && lastLogin < todayEnd;
    });
    acc[period] = {
      uniqueCount: new Set(active.map((student) => student.userId || student.id || student.username || student.fullName)).size,
      totalStudents: students.length,
    };
    return acc;
  }, {});

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
      detail: item.detail || item.body || item.message || '',
      date: item.dateLabel || item.date || item.createdAtUtc || item.createdAt || '',
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

function buildStudyStats({ exams = [], homework = [], studentName = '', studentAttendance = [], contents = [], practiceAttempts = [] }) {
  const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const parseDate = (raw) => {
    if (!raw) return null;
    const parsed = parseHumanDateLabel(raw) || new Date(raw);
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  };

  const events = [];
  const pushEvent = (raw, type) => {
    const parsed = parseDate(raw);
    if (parsed) events.push({ date: parsed, type });
  };

  exams.forEach((item) => pushEvent(item.dateLabel || item.date || item.createdAt, 'exam'));
  homework.forEach((item) => (item.submissions || []).forEach((submission) => {
    if (normalizeText(submission.studentName) === normalizeText(studentName)) {
      pushEvent(submission.submittedAtUtc || submission.submittedAt || submission.createdAt, 'homework');
    }
  }));
  studentAttendance.forEach((item) => {
    if (normalizeText(item.status).includes('katildi')) pushEvent(item.lessonDate || item.date, 'attendance');
  });
  contents.forEach((item) => pushEvent(item.createdAtUtc || item.createdAt || item.publishedAtUtc || item.publishedAt, 'content'));
  practiceAttempts.forEach((item) => pushEvent(item.attemptedAtUtc || item.createdAtUtc || item.createdAt || item.date, 'question'));

  const today = startOfDay(new Date());
  const monthShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  const dayBuckets = [];
  for (let i = 13; i >= 0; i -= 1) {
    const start = new Date(today); start.setDate(today.getDate() - i);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    dayBuckets.push({ start, end, label: String(start.getDate()) });
  }
  const weekBuckets = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = new Date(today); start.setDate(today.getDate() - (i * 7) - 6);
    const end = new Date(today); end.setDate(today.getDate() - (i * 7) + 1);
    weekBuckets.push({ start, end, label: `${start.getDate()}.${start.getMonth() + 1}` });
  }
  const monthBuckets = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    monthBuckets.push({ start, end, label: monthShort[start.getMonth()] });
  }
  const yearBuckets = [];
  for (let i = 4; i >= 0; i -= 1) {
    const start = new Date(today.getFullYear() - i, 0, 1);
    const end = new Date(today.getFullYear() - i + 1, 0, 1);
    yearBuckets.push({ start, end, label: String(start.getFullYear()) });
  }

  const build = (buckets) => {
    const values = buckets.map(() => 0);
    const summary = { questions: 0, contents: 0, exams: 0, homework: 0, attendance: 0 };
    const windowStart = buckets[0]?.start;
    const windowEnd = buckets[buckets.length - 1]?.end;
    events.forEach((event) => {
      if (windowStart && event.date < windowStart) return;
      if (windowEnd && event.date >= windowEnd) return;
      const index = buckets.findIndex((bucket) => event.date >= bucket.start && event.date < bucket.end);
      if (index < 0) return;
      values[index] += 1;
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

  const [examResultResponse, questionBankResponse, practiceAttemptsResponse, classRankingResponse] = await Promise.allSettled([
    api.get('/api/examresults', { params: { studentName } }),
    api.get('/api/questionbank', { params: className ? { className } : undefined }),
    api.get('/api/questionbank/attempts', { params: student?.username ? { studentUsername: student.username } : undefined }),
    api.get('/api/examresults/class-ranking'),
  ]);

  const exams = safeData(examResultResponse, []);
  const questionBank = safeData(questionBankResponse, []);
  const practiceAttempts = safeData(practiceAttemptsResponse, []);
  const classRanking = classRankingResponse.status === 'fulfilled' ? classRankingResponse.value : null;

  const studentAttendance = attendance.filter((item) => normalizeText(item.studentName) === normalizeText(studentName));
  // Bugünkü program /api/schedule'dan, öğrencinin sınıfına göre.
  const todayLessons = pickScheduleTodayForClass(scheduleEntries, className).slice(0, 4);
  const pendingAssignments = homework.filter((item) => !item.submissions?.some((submission) => normalizeText(submission.studentName) === normalizeText(studentName)));
  const contentProgress = contents.length > 0
    ? Math.round(contents.reduce((sum, item) => sum + safeNumber(item.progress), 0) / contents.length)
    : 0;
  const examSignals = announcements.filter((item) => /sinav|deneme|quiz/i.test(`${item.title} ${item.detail || ''}`));

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
  const subjectMap = new Map();
  exams.forEach((item) => {
    const subject = item.subject || 'Genel';
    if (!subjectMap.has(subject)) subjectMap.set(subject, []);
    subjectMap.get(subject).push(safeNumber(item.score));
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
  const distributionMap = new Map();
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
  const upcomingEvents = (examSignals.length ? examSignals : exams)
    .slice(0, 4)
    .map((item) => {
      const when = parseHumanDateLabel(item.dateLabel || item.date);
      const days = when ? Math.max(0, Math.ceil((when.getTime() - Date.now()) / dayMs)) : null;
      return {
        title: item.subject || item.title || 'Etkinlik',
        detail: item.type || item.detail || item.audience || '',
        days,
      };
    });
  const announcementList = announcements.slice(0, 3).map((item) => ({
    title: item.title || 'Duyuru',
    detail: item.detail || item.body || item.message || '',
    date: item.dateLabel || item.date || '',
  }));
  const suggestedContents = contents.slice(0, 4).map((item) => ({
    title: item.title || 'İçerik',
    subject: item.subject || item.grade || '',
    type: item.fileType || item.type || 'İçerik',
    meta: item.duration || item.timeLabel || '',
  }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKey = (value) => {
    if (!value) return '';
    const parsed = parseHumanDateLabel(value) || new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  };
  const weeklySeries = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    const submittedHomework = homework.reduce((sum, item) => {
      const submissions = item.submissions || [];
      return sum + submissions.filter((submission) => {
        const submittedAt = submission.submittedAtUtc || submission.submittedAt || submission.createdAt;
        return normalizeText(submission.studentName) === normalizeText(studentName)
          && submittedAt
          && dayKey(submittedAt) === key;
      }).length;
    }, 0);
    const newContents = contents.filter((item) => {
      const createdAt = item.createdAtUtc || item.createdAt || item.publishedAtUtc || item.publishedAt;
      return createdAt && dayKey(createdAt) === key;
    }).length;
    const examResultsForDay = exams.filter((item) => {
      return dayKey(item.dateLabel || item.date || item.createdAt) === key;
    }).length;
    return submittedHomework + newContents + examResultsForDay;
  });
  const weekly = {
    solvedQuestions: questionBank.length,
    watchedVideos: contents.filter((item) => normalizeText(item.fileType).includes('video')).length,
    contentCount: contents.length,
    series: weeklySeries,
  };

  // Gerçek zaman damgalı çalışma hareketlerinden gün/hafta/ay/yıl istatistikleri.
  const studyStats = buildStudyStats({ exams, homework, studentName, studentAttendance, contents, practiceAttempts });

  // Sınıf içi başarı sıralaması (sunucudan, not ortalamasına göre, sızıntısız).
  const rankFromServer = safeNumber(classRanking?.rank, 0);
  const totalFromServer = safeNumber(classRanking?.totalStudents, 0);

  return {
    greetingName: studentName.split(' ')[0],
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
      xp: safeNumber(studyPlan?.xpPoints, 0),
      level: Math.max(1, Math.floor(safeNumber(studyPlan?.xpPoints, 0) / 100) + 1),
      xpToNext: Math.max(100, 100 - (safeNumber(studyPlan?.xpPoints, 0) % 100)),
      rank: rankFromServer > 0 ? rankFromServer : null,
      totalStudents: totalFromServer > 0 ? totalFromServer : (students.filter((item) => normalizeText(item.className) === normalizeText(className)).length || null),
      classAverage: Math.round(safeNumber(classRanking?.average, averageScore)),
    },
    subjectPerformance,
    pendingList,
    assignmentsBySubject,
    todayLessons,
    upcomingExams: (examSignals.length ? examSignals : exams)
      .slice(0, 2)
      .map((item, index) => ({
        subject: item.subject || item.title || `Yaklaşan sınav ${index + 1}`,
        date: parseHumanDateLabel(item.dateLabel || item.date)?.toISOString() || new Date().toISOString(),
        type: item.type || item.audience || 'Planlandı',
      })),
    recentResults: exams.slice(0, 5).map((item) => ({
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
    api.get('/api/examresults'),
    api.get('/api/plannedexams'),
    api.get('/api/announcements', { params: { audience: 'Ogretmen' } }),
  ]);

  const students = safeData(results[0], []);
  const attendance = safeData(results[1], []);
  const threads = safeData(results[2], []);
  const homework = safeData(results[3], []);
  const contents = safeData(results[4], []);
  const notifications = safeData(results[5], []);
  const scheduleEntries = safeData(results[6], []);
  const examResults = safeData(results[7], []);
  const plannedExams = safeData(results[8], []);
  const announcements = safeData(results[9], []);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (value) => {
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
  const classExamMap = new Map();
  examResults.forEach((item) => {
    const cls = item.className || 'Tanımsız';
    if (!classExamMap.has(cls)) classExamMap.set(cls, []);
    classExamMap.get(cls).push(safeNumber(item.score));
  });
  const studentsByClass = new Map();
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
  const completedExams = new Set(examResults.map((item) => `${item.examTitle || item.title}-${item.className}`)).size;
  const plannedFuture = plannedExams.filter((item) => {
    const date = parseHumanDateLabel(item.dateLabel || item.date || item.examDate);
    return date && date.getTime() > now.getTime();
  });
  const plannedToday = plannedExams.filter((item) => {
    const date = parseHumanDateLabel(item.dateLabel || item.date || item.examDate);
    return date && isToday(date);
  });
  const examStats = { completed: completedExams, ongoing: plannedToday.length, planned: plannedFuture.length };

  // Ödev dağılımı (donut) + bekleyen değerlendirmeler.
  const homeworkDistribution = { delivered: 0, pending: 0, overdue: 0 };
  let pendingGradingCount = 0;
  const pendingGrading = [];
  homework.forEach((item) => {
    const subs = item.submissions || [];
    const due = item.deadline ? new Date(item.deadline) : null;
    const ungraded = subs.filter((sub) => sub.grade == null).length;
    pendingGradingCount += ungraded;
    if (ungraded > 0) pendingGrading.push({ className: item.className, title: item.title, count: ungraded });
    if (students.length && subs.length >= students.length) homeworkDistribution.delivered += 1;
    else if (due && due < now) homeworkDistribution.overdue += 1;
    else homeworkDistribution.pending += 1;
  });

  const contentViews = contents.reduce((sum, item) => sum + safeNumber(item.viewCount ?? item.views ?? item.usageCount), 0);
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
    contentViewSeries: contents.slice(0, 12).map((item) => safeNumber(item.viewCount ?? item.views ?? item.usageCount)),
    pendingGrading: pendingGrading.slice(0, 4),
    upcomingExams: plannedFuture
      .map((item) => {
        const date = parseHumanDateLabel(item.dateLabel || item.date || item.examDate);
        return {
          title: item.title || item.examTitle || 'Sınav',
          className: item.className || (item.classTargets || []).join(', '),
          date,
          days: date ? Math.max(0, Math.ceil((date.getTime() - now.getTime()) / dayMs)) : null,
        };
      })
      .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
      .slice(0, 3),
    recentContents: contents.slice(0, 3).map((item) => ({
      title: item.title || 'İçerik',
      type: item.fileType || 'İçerik',
      date: item.createdAt ? formatShortDate(item.createdAt) : (item.dateLabel || ''),
    })),
    announcementList: announcements.slice(0, 3).map((item) => ({
      title: item.title || 'Duyuru',
      detail: item.detail || item.body || '',
      date: item.dateLabel || item.date || '',
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
    api.get('/api/homework'),
    api.get('/api/schedule'),
    api.get('/api/plannedexams'),
    api.get('/api/notifications', { params: { targetRole: 'Parent' } }),
    api.get('/api/parent/finance/children'),
  ]);

  const students = safeData(results[0], []);
  const announcements = safeData(results[1], []);
  const threads = safeData(results[2], []);
  const attendance = safeData(results[3], []);
  const homework = safeData(results[4], []);
  const scheduleEntries = safeData(results[5], []);
  const plannedExams = safeData(results[6], []);
  const notifications = safeData(results[7], []);
  const financeAccounts = safeData(results[8], []);

  const selectedChild = children[0] || null;

  const examResults = await Promise.allSettled(
    children.map((child) => api.get('/api/examresults', { params: { studentName: child.fullName } }))
  );
  const examsByChild = new Map();
  children.forEach((child, index) => {
    examsByChild.set(child.fullName, safeData(examResults[index], []));
  });
  const exams = selectedChild ? (examsByChild.get(selectedChild.fullName) || []) : [];

  const buildChildSummary = (child) => {
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

    return {
      attendance: attendanceRate,
      attendanceCounts: {
        present: presentCount,
        absent: absentCount,
        excuse: excuseCount,
        total: totalAttendance,
      },
      lastExam: childExams[0]
        ? { subject: childExams[0].subject, score: safeNumber(childExams[0].score), title: childExams[0].examTitle || childExams[0].title || '' }
        : null,
      examTrend: childExams.slice(0, 7).reverse().map((item) => safeNumber(item.score)).filter((value) => value > 0),
      pendingPayment,
      paidTotal,
      exams: childExams,
    };
  };

  const childSummaries = children.reduce((map, child) => {
    map[child.fullName] = buildChildSummary(child);
    return map;
  }, {});

  const selectedSummary = selectedChild ? childSummaries[selectedChild.fullName] : null;
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
      deadline: item.deadline || item.dueDate || item.dateLabel || '',
      status: item.status || 'Bekliyor',
    }));

  const upcomingExams = plannedExams
    .filter((item) => {
      const className = normalizeText(item.className || item.targetClass || item.class);
      return !className || classNames.has(className);
    })
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title || item.examTitle || 'Sınav',
      subject: item.subject || '',
      className: item.className || item.targetClass || '',
      date: item.dateLabel || item.date || item.startAtUtc || '',
      status: item.status || 'Planlandı',
    }));

  const activities = [
    ...mapActivities(announcements, notifications),
    ...exams.slice(0, 3).map((item) => ({
      id: item.id || `${item.subject}-${item.score}`,
      message: `${item.subject || 'Sınav'} sonucu girildi`,
      time: item.dateLabel || item.date || '',
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
    (item) => normalizeText(item.status) !== 'paid' && safeNumber(item.remaining ?? item.amount) > 0
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
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0] || null,
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
