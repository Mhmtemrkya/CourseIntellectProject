import { fetchMyTenantFeatures } from './api/modules';

// Kurum bazlı özellik anahtarları. Platform yöneticisi kapattığı modüller
// bu kurumun menülerinden gizlenir. Bayraklar oturum boyunca önbelleğe alınır;
// okunamazsa güvenli varsayılan "tümü açık"tır.
let cachedDisabled = null;
let pending = null;

export async function getDisabledFeatureKeys() {
  if (cachedDisabled) return cachedDisabled;
  if (!pending) {
    pending = fetchMyTenantFeatures()
      .then((payload) => new Set(
        (Array.isArray(payload?.features) ? payload.features : [])
          .filter((feature) => feature.enabled === false)
          .map((feature) => feature.key),
      ))
      .catch(() => new Set());
  }
  cachedDisabled = await pending;
  return cachedDisabled;
}

export function resetTenantFeatureCache() {
  cachedDisabled = null;
  pending = null;
}

// Özellik anahtarı → menü yolu önekleri.
const FEATURE_PATHS = {
  attendance: ['/attendance', '/t/attendance', '/s/attendance', '/p/attendance', '/kiosk-qr', '/s/attendance-qr'],
  exams: ['/exams', '/t/exams', '/s/exams', '/t/mock-exams', '/t/grade-entry', '/s/exam-results', '/t/student-exams', '/s/solve', '/t/exam-workbench', '/p/exams'],
  questionBank: ['/questions', '/t/question-bank', '/s/questions', '/t/question-studio', '/s/question-practice', '/s/wrong-answers'],
  questionBox: ['/t/questions', '/s/question-box'],
  studyPlan: ['/s/study-plan', '/s/badges'],
  homework: ['/t/assignments', '/s/assignments', '/t/submissions', '/p/assignments'],
  liveLessons: ['/live', '/t/live', '/s/live'],
  content: ['/content', '/t/content', '/s/content', '/s/content-detail'],
  messaging: ['/chat', '/t/chat', '/s/chat', '/p/chat', '/messages'],
  announcements: ['/announcements', '/s/announcements', '/t/announcements', '/p/announcements', '/admin/announcements'],
  service: ['/admin/service', '/p/service', '/s/service', '/driver'],
  cafeteria: ['/cafeteria'],
  finance: ['/finance'],
  reports: ['/reports', '/t/reports', '/p/reports'],
  ai: ['/s/ai', '/ai'],
};

export function isPathDisabled(path, disabledKeys) {
  if (!path || !disabledKeys || disabledKeys.size === 0) return false;
  for (const key of disabledKeys) {
    const prefixes = FEATURE_PATHS[key];
    if (!prefixes) continue;
    for (const prefix of prefixes) {
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        return true;
      }
    }
  }
  return false;
}
