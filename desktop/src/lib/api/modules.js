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

// --- Service Tracking ---

export async function fetchServiceVehicles() {
  const response = await api.get('/api/service/vehicles');
  return Array.isArray(response) ? response : [];
}

export async function createServiceVehicle(payload) {
  return await api.post('/api/service/vehicles', payload);
}

export async function updateServiceVehicle(id, payload) {
  return await api.put(`/api/service/vehicles/${id}`, payload);
}

export async function deleteServiceVehicle(id) {
  await api.delete(`/api/service/vehicles/${id}`);
}

export async function fetchServiceDrivers() {
  const response = await api.get('/api/service/drivers');
  return Array.isArray(response) ? response : [];
}

export async function createServiceDriver(payload) {
  return await api.post('/api/service/drivers', payload);
}

export async function updateServiceDriver(id, payload) {
  return await api.put(`/api/service/drivers/${id}`, payload);
}

export async function deleteServiceDriver(id) {
  await api.delete(`/api/service/drivers/${id}`);
}

export async function fetchServiceRoutes(params = {}) {
  const response = await api.get('/api/service/routes', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function fetchServiceRouteDetail(id) {
  return await api.get(`/api/service/routes/${id}`);
}

export async function fetchServiceAssignments() {
  const response = await api.get('/api/service/assignments');
  return Array.isArray(response) ? response : [];
}

export async function createServiceRoute(payload) {
  return await api.post('/api/service/routes', {
    ...payload,
    startTime: normalizeServiceTime(payload.startTime),
    endTime: normalizeServiceTime(payload.endTime),
  });
}

export async function setServiceRouteActive(id, active) {
  return await api.patch(`/api/service/routes/${id}/${active ? 'activate' : 'deactivate'}`);
}

function normalizeServiceTime(value) {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
}

export async function createServiceRouteStop(routeId, payload) {
  return await api.post(`/api/service/routes/${routeId}/stops`, payload);
}

export async function updateServiceRouteStop(stopId, payload) {
  return await api.put(`/api/service/stops/${stopId}`, payload);
}

export async function deleteServiceRouteStop(stopId) {
  await api.delete(`/api/service/stops/${stopId}`);
}

export async function reorderServiceRouteStops(routeId, stops) {
  return await api.put(`/api/service/routes/${routeId}/stops/reorder`, { stops });
}

export async function searchServiceStudents(keyword) {
  const response = await api.get('/api/service/students/search', {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response) ? response : [];
}

export async function assignServiceStudent(payload) {
  return await api.post('/api/service/assignments', payload);
}

export async function deleteServiceAssignment(id) {
  await api.delete(`/api/service/assignments/${id}`);
}

export const getVehicles = fetchServiceVehicles;
export const getDrivers = fetchServiceDrivers;
export const getRoutes = fetchServiceRoutes;
export const assignStudentToRoute = assignServiceStudent;

export async function getAdminTransportDashboard() {
  const [vehicles, drivers, routes, assignments] = await Promise.all([
    fetchServiceVehicles(),
    fetchServiceDrivers(),
    fetchServiceRoutes(),
    fetchServiceAssignments(),
  ]);
  return {
    vehicles,
    drivers,
    routes,
    assignments,
    totals: {
      vehicles: vehicles.length,
      drivers: drivers.length,
      routes: routes.length,
      assignments: assignments.length,
      activeRoutes: routes.filter((route) => route.isActive).length,
      activeDrivers: drivers.filter((driver) => driver.isActive).length,
      activeVehicles: vehicles.filter((vehicle) => vehicle.isActive).length,
    },
  };
}

export async function fetchServiceDriverSelf() {
  return await api.get('/api/service/driver/me');
}

export async function arrivedSchoolRoute(tripId) {
  return await api.post(`/api/service/trips/${tripId}/arrived-school`);
}

export async function getDriverTodayRoute() {
  const response = await api.get('/api/service/driver/today-routes');
  return Array.isArray(response) ? response : [];
}

export async function getDriverStudentPickupList(routeId) {
  const response = await api.get(`/api/service/driver/routes/${routeId}/students`);
  return Array.isArray(response) ? response : [];
}

export async function startRoute(routeId) {
  return await api.post('/api/service/trips/start', { routeId });
}

export async function updateStudentBoardingStatus({ tripId, studentId, status }) {
  return await api.post('/api/service/attendance/mark', { tripId, studentId, status });
}

export async function completeRoute(tripId) {
  return await api.post(`/api/service/trips/${tripId}/completed`);
}

export async function getStudentTransportStatus() {
  const response = await api.get('/api/service/student/live-status');
  return Array.isArray(response) ? response : [];
}

export async function getParentChildrenTransportStatus() {
  const response = await api.get('/api/service/parent/live-status');
  return Array.isArray(response) ? response : [];
}

export async function notifyStudentAbsentToday(payload) {
  return await api.post('/api/service/parent/absence-request', payload);
}

export async function getLiveVehicleLocations() {
  const response = await api.get('/api/service/admin/live-status');
  return Array.isArray(response) ? response : [];
}

export async function fetchUserRoles() {
  const response = await api.get('/api/users/roles');
  return response;
}

export async function updateUserStatus(username, status) {
  const response = await api.put(`/api/users/${username}/status`, { status });
  return response;
}

// Pasif (deaktive) hesaplar — "Pasif Kayıtlar" ekranı.
export async function fetchPassiveAccounts() {
  const response = await api.get('/api/users/passive');
  return Array.isArray(response) ? response : [];
}

export async function assignPrimaryRole(username, primaryRole, departmentOrBranch) {
  const response = await api.put(`/api/users/${username}/primary-role`, { primaryRole, departmentOrBranch });
  return response;
}

export async function addExtraRole(username, roleName) {
  const response = await api.post(`/api/users/${username}/extra-roles`, { roleName });
  return response;
}

export async function undoRoleAssignment(username) {
  const response = await api.post(`/api/users/${username}/undo-role-assignment`);
  return response;
}

export async function updateRolePolicy(roleName, payload) {
  const response = await api.put(`/api/users/roles/${roleName}`, payload);
  return response;
}

// --- Accounting (extra) ---

export async function createSalary(payload) {
  const response = await api.post('/api/accounting/salaries', payload);
  return response;
}

export async function updateInstallment(id, payload) {
  const response = await api.put(`/api/accounting/installments/${id}`, payload);
  return response;
}

export async function markAllAccountingNotificationsRead() {
  const response = await api.put('/api/accounting/notifications/read-all');
  return response;
}

// --- Content (update) ---

export async function updateContent(id, payload) {
  const response = await api.put(`/api/contents/${id}`, payload);
  return response;
}

// --- Tenant Branding ---

export async function fetchTenantBranding(tenantId) {
  const response = await api.get('/api/platformconfigurations/branding', {
    params: tenantId ? { tenantId } : undefined,
  });
  if (!response) return null;
  // PayloadJson'u parse et
  if (response.payloadJson) {
    try {
      return JSON.parse(response.payloadJson);
    } catch {
      return null;
    }
  }
  return response;
}

export async function saveTenantBranding(tenantId, brandingPayload) {
  if (!tenantId) {
    throw new Error('Tenant branding kaydi icin tenantId zorunludur.');
  }

  return api.put('/api/platformconfigurations/branding', {
    logoUrl: brandingPayload?.logoUrl || '',
  });
}

export async function uploadTenantLogo(file) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/platformconfigurations/branding/logo', formData);
}

export async function removeTenantLogo() {
  return api.delete('/api/platformconfigurations/branding/logo');
}

// --- Exam / Question Solving ---

export async function startSolutionSession(payload) {
  const response = await api.post('/api/solution-sessions/start', payload);
  return response;
}

export async function fetchSolutionSession(sessionId) {
  const response = await api.get(`/api/solution-sessions/${sessionId}`);
  return response;
}

export async function saveSolutionAnswer(sessionId, payload) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/answers`, payload);
  return response;
}

export async function saveSolutionFlag(sessionId, payload) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/flags`, payload);
  return response;
}

export async function saveSolutionNote(sessionId, payload) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/notes`, payload);
  return response;
}

export async function saveSolutionCanvasStroke(sessionId, payload) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/canvas/strokes`, payload);
  return response;
}

export async function saveSolutionCanvasSnapshot(sessionId, payload) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/canvas/snapshot`, payload);
  return response;
}

export async function completeSolutionSession(sessionId) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/complete`);
  return response;
}

export async function queueSolutionPdf(sessionId) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/pdf`);
  return response;
}

export async function addSolutionTeacherReview(sessionId, payload) {
  const response = await api.post(`/api/solution-sessions/${sessionId}/reviews`, payload);
  return response;
}

export async function fetchTeacherPdfReports() {
  const response = await api.get('/api/teacher/pdf-reports');
  return Array.isArray(response) ? response : [];
}

// --- Öğretmen Nöbetleri ---
export async function createDuty(payload) {
  const response = await api.post('/api/duties', payload);
  return response;
}

export async function fetchMyDuties(scope) {
  const response = await api.get('/api/duties/mine', { params: scope ? { scope } : undefined });
  return Array.isArray(response) ? response : [];
}

export async function fetchMyDutyStats() {
  const response = await api.get('/api/duties/mine/stats');
  return response;
}

export async function fetchDuties(params) {
  const response = await api.get('/api/duties', { params });
  return Array.isArray(response) ? response : [];
}

export async function fetchDutyLoad(monthStart) {
  const response = await api.get('/api/duties/load', { params: monthStart ? { monthStart } : undefined });
  return Array.isArray(response) ? response : [];
}

export async function updateDuty(id, payload) {
  const response = await api.put(`/api/duties/${id}`, payload);
  return response;
}

export async function setDutyStatus(id, status) {
  const response = await api.post(`/api/duties/${id}/status`, { status });
  return response;
}

export async function deleteDuty(id) {
  await api.delete(`/api/duties/${id}`);
}

export async function cancelDutySeries(groupId) {
  const response = await api.post(`/api/duties/group/${groupId}/cancel`);
  return response;
}

// --- Öğretmen Ders Programı (timetable) ---
export async function fetchTeacherTimetable(params) {
  const response = await api.get('/api/timetable', { params });
  return Array.isArray(response) ? response : [];
}

export async function setTeacherTimetable(payload) {
  const response = await api.post('/api/timetable', payload);
  return Array.isArray(response) ? response : [];
}

export async function deleteTimetableSlot(id) {
  await api.delete(`/api/timetable/${id}`);
}

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
