// Kullanıcı/sınıf/program eşleştirme yardımcıları.
// Schedule, attendance, dashboard gibi farklı sayfaların tekrar eden
// "şu user/teacher/student programdaki şu kayıt ile aynı mı?" mantığını
// tek yerde toplar.

export function normalizeText(value = '') {
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

/**
 * Mevcut giriş yapan kullanıcının student listesindeki kaydını bulur.
 * Eşleştirme: fullName, username veya name üzerinden case/accent-insensitive.
 */
export function resolveCurrentStudent(user, students) {
  if (!user || !Array.isArray(students) || students.length === 0) return null;
  const candidates = [user.name, user.fullName, user.username].map(normalizeText).filter(Boolean);
  if (candidates.length === 0) return null;
  for (const student of students) {
    const haystack = [student.fullName, student.username].map(normalizeText);
    if (haystack.some((value) => value && candidates.includes(value))) {
      return student;
    }
  }
  return null;
}

/**
 * Schedule entry shape: { className, day, time, subject, teacher, ... }
 * Öğretmen kullanıcısı için, kendi adına eşleşen schedule kayıtlarını döner.
 */
export function filterScheduleForTeacher(scheduleEntries, user) {
  if (!Array.isArray(scheduleEntries)) return [];
  const teacherKey = normalizeText(user?.name || user?.fullName || user?.username || '');
  if (!teacherKey) return [];
  return scheduleEntries.filter((entry) => normalizeText(entry?.teacher) === teacherKey);
}

/**
 * Öğrenci için kendi sınıfına eşleşen schedule kayıtlarını döner.
 * className parametresi opsiyonel; verilmezse boş döner.
 */
export function filterScheduleForStudent(scheduleEntries, className) {
  if (!Array.isArray(scheduleEntries) || !className) return [];
  const key = normalizeText(className);
  return scheduleEntries.filter((entry) => normalizeText(entry?.className) === key);
}
