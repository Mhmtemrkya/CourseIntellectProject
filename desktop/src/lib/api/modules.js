import { api } from './client';
import { isNotFoundError } from './shared';
export * from './files';
export * from './students';
export * from './expenses';
export * from './backup';
export * from './account';
export * from './reports';
export * from './classes';
export * from './schedule';
export * from './liveRoom';
export * from './preferences';
export * from './overdueRules';
export * from './excuses';
export * from './attendanceQr';
export * from './parents';
export * from './studentFinance';
export * from './staff';
export * from './courses';
export * from './announcements';
export * from './notifications';
export * from './platformConfig';
export * from './approvals';
export * from './audit';
export * from './parentPortal';
export * from './orgUnits';
export * from './customRoles';
export * from './scopeAdmin';
export * from './adminWork';
export * from './staffHr';
export * from './appSettings';
export * from './system';
export * from './subscriptions';
export * from './platformOps';
export * from './messages';
export * from './contents';
export * from './academics';
export * from './schoolDashboard';
export * from './accounting';
export * from './questionBank';
export * from './meetings';
export * from './questionThreads';
export * from './studyPlans';
export * from './plannedExams';
export * from './examSessions';
export * from './users';
export * from './serviceTracking';
export * from './branding';
export * from './solutionSessions';
export * from './duties';

// --- Question Studio ---

export async function fetchQuestionStudioDrafts() {
  const response = await api.get('/api/question-studio/drafts');
  return Array.isArray(response) ? response : [];
}

export async function saveQuestionStudioDraft(payload) {
  const response = await api.post('/api/question-studio/drafts', payload);
  return response;
}

export async function deleteQuestionStudioDraft(id) {
  await api.delete(`/api/question-studio/drafts/${id}`);
}

// --- Cafeteria / Weekly Menu ---

export async function fetchCafeteriaWeek(weekStart) {
  return api.get('/api/cafeteria/week', {
    params: weekStart ? { weekStart } : undefined,
  });
}

export async function saveCafeteriaWeek(payload) {
  return api.post('/api/cafeteria/weeks', payload);
}

// --- Rehberlik (Guidance) ---

export async function fetchGuidanceOverview() {
  const response = await api.get('/api/guidance/overview');
  return Array.isArray(response) ? response : [];
}

export async function fetchGuidanceCounselors() {
  const response = await api.get('/api/guidance/counselors');
  return Array.isArray(response) ? response : [];
}

export async function fetchGuidanceStudentFile(student) {
  return api.get('/api/guidance/student-file', { params: { student } });
}

export async function createGuidanceSession(payload) {
  return api.post('/api/guidance/sessions', payload);
}

export async function updateGuidanceSession(id, payload) {
  return api.patch(`/api/guidance/sessions/${id}`, payload);
}

export async function deleteGuidanceSession(id) {
  return api.delete(`/api/guidance/sessions/${id}`);
}

export async function fetchGuidanceFollowUps() {
  const response = await api.get('/api/guidance/follow-ups');
  return Array.isArray(response) ? response : [];
}

export async function fetchGuidanceAvailability(counselor) {
  return api.get('/api/guidance/availability', {
    params: counselor ? { counselor } : undefined,
  });
}

export async function saveGuidanceAvailability(slots) {
  return api.put('/api/guidance/availability', { slots });
}

export async function fetchGuidanceAppointments(mine = false) {
  const response = await api.get('/api/guidance/appointments', { params: { mine } });
  return Array.isArray(response) ? response : [];
}

export async function createGuidanceAppointment(payload) {
  return api.post('/api/guidance/appointments', payload);
}

export async function decideGuidanceAppointment(id, { approved, note = '' }) {
  return api.patch(`/api/guidance/appointments/${id}/decide`, { approved, note });
}

export async function completeGuidanceAppointment(id) {
  return api.patch(`/api/guidance/appointments/${id}/complete`, {});
}

export async function saveGuidanceGoal(studentName, payload) {
  return api.put(`/api/guidance/goals/${encodeURIComponent(studentName)}`, payload);
}

export async function createGuidanceRiskReview(payload) {
  return api.post('/api/guidance/risk-reviews', payload);
}

export async function fetchGuidanceInventories(student) {
  const response = await api.get('/api/guidance/inventories', {
    params: student ? { student } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function assignGuidanceInventory(payload) {
  return api.post('/api/guidance/inventories', payload);
}

export async function completeGuidanceInventory(id, answersJson) {
  return api.patch(`/api/guidance/inventories/${id}/complete`, { answersJson });
}

export async function fetchGuidanceStudyPlan(student) {
  return api.get('/api/guidance/study-plan', { params: { student } });
}

export async function updateGuidanceStudyPlan(payload) {
  return api.put('/api/guidance/study-plan', payload);
}

export async function fetchGuidanceClassReport(className) {
  return api.get('/api/guidance/class-report', {
    params: className ? { className } : undefined,
  });
}

// --- Kütüphane (Library) ---

export async function fetchLibraryBooks(params = {}) {
  const response = await api.get('/api/library/books', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function fetchLibraryCategories() {
  const response = await api.get('/api/library/categories');
  return Array.isArray(response) ? response : [];
}

export async function createLibraryBook(payload) {
  return api.post('/api/library/books', payload);
}

export async function createLibraryBooksBulk(books) {
  return api.post('/api/library/books/bulk', { books });
}

export async function updateLibraryBook(id, payload) {
  return api.put(`/api/library/books/${id}`, payload);
}

export async function deleteLibraryBook(id) {
  return api.delete(`/api/library/books/${id}`);
}

export async function lookupIsbn(isbn) {
  return api.get('/api/library/isbn-lookup', { params: { isbn } });
}

export async function fetchLibraryLoans(params = {}) {
  const response = await api.get('/api/library/loans', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function checkoutLibraryBook(payload) {
  return api.post('/api/library/loans', payload);
}

export async function returnLibraryLoan(id) {
  return api.patch(`/api/library/loans/${id}/return`, {});
}

export async function extendLibraryLoan(id) {
  return api.patch(`/api/library/loans/${id}/extend`, {});
}

export async function sendLibraryReminders() {
  return api.post('/api/library/reminders', {});
}

export async function reserveLibraryBook(bookId) {
  return api.post('/api/library/reservations', { bookId });
}

export async function cancelLibraryReservation(id) {
  return api.delete(`/api/library/reservations/${id}`);
}

export async function createLibraryRecommendation(payload) {
  return api.post('/api/library/recommendations', payload);
}

export async function fetchLibraryRecommendations() {
  const response = await api.get('/api/library/recommendations');
  return Array.isArray(response) ? response : [];
}

export async function fetchMyLibrary() {
  return api.get('/api/library/my');
}

export async function fetchParentLibrary() {
  const response = await api.get('/api/library/parent/children');
  return Array.isArray(response) ? response : [];
}

export async function fetchLibraryStats() {
  return api.get('/api/library/stats');
}

export async function fetchLibrarySettings() {
  return api.get('/api/library/settings');
}

export async function saveLibrarySettings(payload) {
  return api.put('/api/library/settings', payload);
}

// ─── Onam / izin formları ────────────────────────────────────────────────────
// Sunucu tarafı: /api/consent. Okuma uçlarında paket kapısı yoktur — paket düşse
// bile daha önce imzalanmış belgeler görüntülenip indirilebilir.

export async function fetchConsentCatalog() {
  return api.get('/api/consent/catalog');
}

export async function fetchConsentTemplates(includeInactive = true) {
  const response = await api.get('/api/consent/templates', { params: { includeInactive } });
  return Array.isArray(response) ? response : [];
}

export async function createConsentTemplate(payload) {
  return api.post('/api/consent/templates', payload);
}

export async function updateConsentTemplate(id, payload) {
  return api.put(`/api/consent/templates/${id}`, payload);
}

export async function deleteConsentTemplate(id) {
  return api.delete(`/api/consent/templates/${id}`);
}

export async function downloadConsentTemplatePreview(id) {
  return api.get(`/api/consent/templates/${id}/preview`, { responseType: 'blob' });
}

/// Hazır PDF yükler ve künyesini döner (id, dosya adı, sayfa sayısı).
/// Dosya statik /uploads altına DEĞİL veritabanına yazılır; okuması da yetkilidir.
export async function uploadConsentDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/consent/documents', formData);
}

export async function downloadConsentDocument(documentId) {
  return api.get(`/api/consent/documents/${documentId}`, { responseType: 'blob' });
}

/// Kaydın dayandığı özgün belge — tablet imzadan önce bunu gösterir.
export async function downloadConsentFormDocument(formId) {
  return api.get(`/api/consent/forms/${formId}/document`, { responseType: 'blob' });
}

export async function fetchStudentConsentForms(studentProfileId) {
  const response = await api.get(`/api/consent/students/${studentProfileId}`);
  return Array.isArray(response) ? response : [];
}

export async function fetchConsentStatus(studentProfileId, params = {}) {
  return api.get(`/api/consent/students/${studentProfileId}/status`, { params });
}

export async function fetchAppointmentConsentStatus(appointmentId) {
  return api.get(`/api/consent/appointments/${appointmentId}/status`);
}

export async function fetchConsentForm(id) {
  return api.get(`/api/consent/forms/${id}`);
}

export async function createConsentForm(payload) {
  return api.post('/api/consent/forms', payload);
}

export async function updateConsentForm(id, payload) {
  return api.put(`/api/consent/forms/${id}`, payload);
}

export async function cancelConsentForm(id) {
  return api.delete(`/api/consent/forms/${id}`);
}

export async function downloadConsentFormPdf(id) {
  return api.get(`/api/consent/forms/${id}/pdf`, { responseType: 'blob' });
}

export async function dispatchConsentFormToStation(id, stationName, expiresInMinutes) {
  return api.post(`/api/consent/forms/${id}/session`, { stationName, expiresInMinutes });
}

export async function revokeConsentFormSession(id) {
  return api.delete(`/api/consent/forms/${id}/session`);
}

export async function fetchConsentStations() {
  const response = await api.get('/api/consent/stations');
  return Array.isArray(response) ? response : [];
}

/// Tablet yoklaması: bekleyen form yoksa sunucu 204 döner ve istemci null görür.
export async function pollConsentStation(station) {
  return api.get('/api/consent/station/pending', { params: { station } });
}

export async function signConsentForm(token, payload) {
  return api.post(`/api/consent/session/${token}/sign`, payload);
}
