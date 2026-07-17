import { api } from './client';

const UPLOAD_CHUNK_BYTES = 512 * 1024;
const UPLOAD_CHUNK_RETRIES = 3;

function isNotFoundError(error) {
  return /404/.test(String(error?.message || ''));
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function canUploadInChunks(file) {
  return file
    && typeof file.name === 'string'
    && typeof file.size === 'number'
    && typeof file.slice === 'function'
    && typeof file.arrayBuffer === 'function';
}

function createUploadId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.floor(Math.random() * 16) >> (Number(char) / 4))).toString(16)
  );
}

async function uploadFileInChunks(file, folder) {
  const uploadId = createUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_BYTES));
  let response = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * UPLOAD_CHUNK_BYTES;
    const end = Math.min(file.size, start + UPLOAD_CHUNK_BYTES);
    const chunk = file.slice(start, end);
    const base64Content = arrayBufferToBase64(await chunk.arrayBuffer());

    for (let attempt = 1; attempt <= UPLOAD_CHUNK_RETRIES; attempt += 1) {
      try {
        response = await api.post('/api/uploads/chunk', {
          uploadId,
          fileName: file.name,
          base64Content,
          contentType: file.type || 'application/octet-stream',
          folder,
          startByte: start,
          totalSize: file.size,
          chunkIndex,
          totalChunks,
        });
        break;
      } catch (error) {
        if (attempt === UPLOAD_CHUNK_RETRIES) {
          throw error;
        }
      }
    }
  }

  return response;
}

export async function fetchStudents() {
  const response = await api.get('/api/students');
  return response;
}

export async function fetchDrivingSchoolStatus() {
  return api.get('/api/driving-school/status');
}

// params: { from, to } (ISO). Verilmezse backend "bugün" davranışına düşer.
export async function fetchDrivingSchoolDashboard(params = {}) {
  return api.get('/api/driving-school/dashboard', { params });
}

export const fetchDrivingPermissions = () => api.get('/api/driving-school/permissions/me');
export const fetchDrivingPermissionCatalog = () => api.get('/api/driving-school/permissions/catalog');
export const fetchDrivingPackages = () => api.get('/api/driving-school/packages');
export const createDrivingPackage = (payload) => api.post('/api/driving-school/packages', payload);
export const fetchDrivingVehicles = () => api.get('/api/driving-school/vehicles');
export const createDrivingVehicle = (payload) => api.post('/api/driving-school/vehicles', payload);
export const fetchDrivingInstructors = () => api.get('/api/driving-school/instructors');
export const createDrivingInstructor = (payload) => api.post('/api/driving-school/instructors', payload);
export const fetchDrivingStudents = (params = {}) => api.get('/api/driving-school/students', { params });
export const createDrivingStudent = (payload) => api.post('/api/driving-school/students', payload);
// Kursiyer grupları (dönemler)
export const fetchDrivingStudentGroups = (params = {}) => api.get('/api/driving-school/student-groups', { params });
export const createDrivingStudentGroup = (payload) => api.post('/api/driving-school/student-groups', payload);
export const updateDrivingStudentGroup = (id, payload) => api.put(`/api/driving-school/student-groups/${id}`, payload);
export const assignDrivingStudentGroup = (payload) => api.post('/api/driving-school/students/assign-group', payload);
// MEBBİS dönem listesi: JSON (ekran) ve CSV (Türkçe Excel) aynı uçtan gelir.
export const fetchDrivingMebbisRoster = (groupId) => api.get(`/api/driving-school/student-groups/${groupId}/mebbis-roster`);
export const downloadDrivingMebbisRoster = (groupId) =>
  api.get(`/api/driving-school/student-groups/${groupId}/mebbis-roster`, { params: { format: 'csv' }, responseType: 'blob' });
export const fetchDrivingTheoryCurriculum = () => api.get('/api/driving-school/theory/curriculum');
export const fetchDrivingClassCompliance = (classId) => api.get(`/api/driving-school/theory/classes/${classId}/compliance`);
// Ders programı üreteci + program çizelgesi (PDF)
export const generateDrivingSchedule = (classId, payload) => api.post(`/api/driving-school/theory/classes/${classId}/generate-schedule`, payload);
export const downloadDrivingClassSchedule = (classId) =>
  api.get(`/api/driving-school/theory/classes/${classId}/schedule`, { params: { format: 'pdf' }, responseType: 'blob' });
// MEBBİS sertifika no + dönem kapanış raporu + giriş asistanı işareti
export const updateDrivingCertificateMebbisNo = (certificateId, mebbisCertificateNo) =>
  api.put(`/api/driving-school/graduation/certificates/${certificateId}/mebbis-no`, { mebbisCertificateNo });
export const downloadDrivingTermReport = (groupId) =>
  api.get(`/api/driving-school/student-groups/${groupId}/term-report`, { params: { format: 'pdf' }, responseType: 'blob' });
export const setDrivingMebbisEntered = (profileId, entered) =>
  api.put(`/api/driving-school/students/${profileId}/mebbis-entered`, { entered });
// Aday adayları (lead)
export const fetchDrivingLeads = (params = {}) => api.get('/api/driving-school/leads', { params });
export const createDrivingLead = (payload) => api.post('/api/driving-school/leads', payload);
export const updateDrivingLead = (id, payload) => api.put(`/api/driving-school/leads/${id}`, payload);
export const convertDrivingLead = (id, payload = {}) => api.post(`/api/driving-school/leads/${id}/convert`, payload);
// e-Sınav sonuçlarını toplu içe aktarma + NVİ kimlik doğrulama
export const importDrivingExamResults = (sessionId, rows) => api.post(`/api/driving-school/exams/sessions/${sessionId}/results/import`, { rows });
export const verifyDrivingIdentity = (payload) => api.post('/api/driving-school/students/verify-identity', payload);
// Sınav günü eşleşmesi + listesi ve resmî kursiyer formları (PDF)
export const assignDrivingExamCandidate = (candidateId, payload) => api.put(`/api/driving-school/exams/candidates/${candidateId}/assignment`, payload);
export const downloadDrivingExamRoster = (sessionId) =>
  api.get(`/api/driving-school/exams/sessions/${sessionId}/roster`, { params: { format: 'pdf' }, responseType: 'blob' });
export const downloadDrivingStudentForm = (profileId, formKey) =>
  api.get(`/api/driving-school/students/${profileId}/forms/${formKey}`, { responseType: 'blob' });
export const updateDrivingWorkingPermit = (instructorProfileId, payload) =>
  api.put(`/api/driving-school/instructors/${instructorProfileId}/working-permit`, payload);
export const fetchDrivingAppointments = (params = {}) => api.get('/api/driving-school/appointments', { params });
export const createDrivingAppointment = (payload) => api.post('/api/driving-school/appointments', payload);
export const fetchDrivingLessons = (params = {}) => api.get('/api/driving-school/lessons', { params });

// Raporlar: ekran, CSV ve PDF sunucudaki AYNI belgeden üretilir — istemci tarafında
// yeniden hesap yapma, yoksa üç çıktı ayrışır.
export const fetchDrivingReport = (reportKey, params = {}) =>
  api.get(`/api/driving-school/reports/${reportKey}`, { params });
export const downloadDrivingReport = (reportKey, format, params = {}) =>
  api.get(`/api/driving-school/reports/${reportKey}/export`, { params: { ...params, format }, responseType: 'blob' });
export const fetchDrivingCalendar = (params) => api.get('/api/driving-school/calendar', { params });
export const fetchDrivingEducationOverview = (params = {}) => api.get('/api/driving-school/education/overview', { params });
export const createDrivingTheoryClass = (payload) => api.post('/api/driving-school/theory/classes', payload);
export const enrollDrivingTheoryStudents = (id, studentProfileIds) => api.post(`/api/driving-school/theory/classes/${id}/students`, { studentProfileIds });
export const createDrivingTheorySession = (payload) => api.post('/api/driving-school/theory/sessions', payload);
export const fetchDrivingTheoryAttendance = (id) => api.get(`/api/driving-school/theory/sessions/${id}/attendance`);
export const saveDrivingTheoryAttendance = (id, items) => api.put(`/api/driving-school/theory/sessions/${id}/attendance`, { items });
export const createDrivingExamSession = (payload) => api.post('/api/driving-school/exams/sessions', payload);
export const addDrivingExamCandidates = (id, payload) => api.post(`/api/driving-school/exams/sessions/${id}/candidates`, payload);
export const enterDrivingExamResult = (id, payload) => api.post(`/api/driving-school/exams/candidates/${id}/result`, payload);
export const scheduleDrivingExamRetry = (id, payload) => api.post(`/api/driving-school/exams/candidates/${id}/retry`, payload);
export const fetchDrivingGraduationOverview = () => api.get('/api/driving-school/graduation/overview');
export const fetchDrivingGraduationChecklist = (profileId) => api.get(`/api/driving-school/graduation/students/${profileId}/checklist`);
export const graduateDrivingStudent = (profileId, note = '') => api.post(`/api/driving-school/graduation/students/${profileId}/graduate`, { note });
export const issueDrivingCertificate = (profileId, type) => api.post(`/api/driving-school/graduation/students/${profileId}/certificates`, { type });
export const updateDrivingCertificateDelivery = (id, payload) => api.put(`/api/driving-school/graduation/certificates/${id}/delivery`, payload);
export const downloadDrivingCertificate = (id) => api.get(`/api/driving-school/graduation/certificates/${id}/download`, { responseType: 'blob' });
export const fetchDrivingCertificateSettings = () => api.get('/api/driving-school/graduation/certificate-settings');
export const updateDrivingCertificateSettings = (payload) => api.put('/api/driving-school/graduation/certificate-settings', payload);
export const downloadDrivingCertificatePreview = () => api.get('/api/driving-school/graduation/certificate-settings/preview', { responseType: 'blob' });
export const approveDrivingCertificateSettings = (payload) => api.post('/api/driving-school/graduation/certificate-settings/approve', payload);
export const requestDrivingGraduationOverride = (profileId, payload) => api.post(`/api/driving-school/graduation/students/${profileId}/override-requests`, payload);
export const requestDrivingGraduationRevocation = (profileId, reason) => api.post(`/api/driving-school/graduation/students/${profileId}/revocation-requests`, { reason, checklistKeys: [] });
export const approveDrivingGraduationAction = (id, note = '') => api.post(`/api/driving-school/graduation/action-requests/${id}/approve`, { note });
export const rejectDrivingGraduationAction = (id, note) => api.post(`/api/driving-school/graduation/action-requests/${id}/reject`, { note });
export const reissueDrivingCertificate = (id, reason) => api.post(`/api/driving-school/graduation/certificates/${id}/reissue`, { reason });
export const revokeDrivingCertificate = (id, reason) => api.post(`/api/driving-school/graduation/certificates/${id}/revoke`, { reason });
export const fetchDrivingAppointmentRequests = (params = {}) => api.get('/api/driving-school/appointment-requests', { params });
export const decideDrivingAppointmentRequest = (id, payload) => api.put(`/api/driving-school/appointment-requests/${id}/decision`, payload);

// ─── Sürücü kursu finans işlemleri ────────────────────────────────────────────
export const updateDrivingExamFees = (profileId, payload) => api.put(`/api/driving-school/students/${profileId}/exam-fees`, payload);
export const fetchDrivingBranches = () => api.get('/api/driving-school/branches');
export const fetchDrivingCollectionList = (params = {}) => api.get('/api/driving-school/collection-list', { params });
export const fetchDrivingCharges = (profileId) => api.get(`/api/driving-school/students/${profileId}/charges`);
export const createDrivingCharge = (profileId, payload) => api.post(`/api/driving-school/students/${profileId}/charges`, payload);
export const recordDrivingPayment = (profileId, payload) => api.post(`/api/driving-school/students/${profileId}/payments`, payload);
export const refundDrivingCharge = (chargeId, payload) => api.post(`/api/driving-school/charges/${chargeId}/refund`, payload);
export const fetchDrivingFinanceSummary = (params = {}) => api.get('/api/driving-school/finance/summary', { params });

// ─── Öğretmen-araç ataması, izinler ve uygunluk öneri motoru ──────────────────
export const fetchDrivingAssignments = (params = {}) => api.get('/api/driving-school/instructor-vehicle-assignments', { params });
export const createDrivingAssignment = (payload) => api.post('/api/driving-school/instructor-vehicle-assignments', payload);
export const deactivateDrivingAssignment = (id) => api.delete(`/api/driving-school/instructor-vehicle-assignments/${id}`);
export const fetchDrivingWorkingHours = (instructorProfileId) => api.get(`/api/driving-school/instructors/${instructorProfileId}/working-hours`);
export const setDrivingWorkingHours = (instructorProfileId, payload) => api.put(`/api/driving-school/instructors/${instructorProfileId}/working-hours`, payload);
export const fetchDrivingLeaves = (params = {}) => api.get('/api/driving-school/instructor-leaves', { params });
export const createDrivingLeave = (payload) => api.post('/api/driving-school/instructor-leaves', payload);
export const deleteDrivingLeave = (id) => api.delete(`/api/driving-school/instructor-leaves/${id}`);
export const suggestDrivingInstructors = (params) => api.get('/api/driving-school/availability/instructors', { params });
export const suggestDrivingVehicles = (params) => api.get('/api/driving-school/availability/vehicles', { params });
export const checkDrivingAvailability = (payload) => api.post('/api/driving-school/availability/check', payload);

// ─── Randevu durum makinesi ve ders hakkı defteri ─────────────────────────────
export const approveDrivingAppointment = (id) => api.post(`/api/driving-school/appointments/${id}/approve`, {});
export const checkInDrivingAppointment = (id) => api.post(`/api/driving-school/appointments/${id}/check-in`, {});
export const cancelDrivingAppointment = (id, reason) => api.post(`/api/driving-school/appointments/${id}/cancel`, { reason });
export const markDrivingAppointmentNoShow = (id, note) => api.post(`/api/driving-school/appointments/${id}/no-show`, { note });
export const rescheduleDrivingAppointment = (id, payload) => api.post(`/api/driving-school/appointments/${id}/reschedule`, payload);
export const fetchDrivingAppointmentHistory = (id) => api.get(`/api/driving-school/appointments/${id}/history`);
export const fetchDrivingLedger = (profileId) => api.get(`/api/driving-school/students/${profileId}/ledger`);
export const adjustDrivingLedger = (profileId, payload) => api.post(`/api/driving-school/students/${profileId}/ledger/adjust`, payload);
export const addDrivingExtraMinutes = (profileId, payload) => api.post(`/api/driving-school/students/${profileId}/ledger/extra-minutes`, payload);
export const fetchDrivingSettings = () => api.get('/api/driving-school/settings');
export const updateDrivingSettings = (payload) => api.put('/api/driving-school/settings', payload);

// ─── Kayıt sihirbazı, kurs dosyası ve öğrenci detay merkezi ───────────────────
export const checkDrivingIdentity = (identityNumber) => api.get('/api/driving-school/students/check-identity', { params: { identityNumber } });
export const checkDrivingPhone = (phone) => api.get('/api/driving-school/students/check-phone', { params: { phone } });
export const fetchDrivingInstallments = (profileId) => api.get(`/api/driving-school/students/${profileId}/installments`);
export const registerDrivingStudent = (payload) => api.post('/api/driving-school/students/wizard', payload);
export const fetchDrivingStudentDetail = (profileId) => api.get(`/api/driving-school/students/${profileId}/detail`);
export const updateDrivingStudentStatus = (profileId, payload) => api.post(`/api/driving-school/students/${profileId}/status`, payload);
export const fetchDrivingStudentDocuments = (profileId) => api.get(`/api/driving-school/students/${profileId}/documents`);
export const uploadDrivingStudentDocument = (profileId, payload) => api.post(`/api/driving-school/students/${profileId}/documents`, payload);
export const reviewDrivingStudentDocument = (documentId, payload) => api.post(`/api/driving-school/student-documents/${documentId}/review`, payload);
export const fetchDrivingRegistrationDrafts = () => api.get('/api/driving-school/registration-drafts');
export const saveDrivingRegistrationDraft = (payload) => api.put('/api/driving-school/registration-drafts', payload);
export const deleteDrivingRegistrationDraft = (id) => api.delete(`/api/driving-school/registration-drafts/${id}`);

export const fetchDrivingVehicleDocuments = (params = {}) => api.get('/api/driving-school/vehicle-documents', { params });
export const createDrivingVehicleDocument = (payload) => api.post('/api/driving-school/vehicle-documents', payload);
export const fetchDrivingVehicleServiceRecords = (params = {}) => api.get('/api/driving-school/vehicle-service-records', { params });
export const createDrivingVehicleServiceRecord = (payload) => api.post('/api/driving-school/vehicle-service-records', payload);
export const completeDrivingVehicleServiceRecord = (id, resolution) => api.post(`/api/driving-school/vehicle-service-records/${id}/complete`, { resolution });

function normalizeForMatch(value = '') {
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
let cachedMyClassName;
export async function getMyClassName(user) {
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
export function classMatchesMine(itemClassName, myClassName) {
  const mine = normalizeForMatch(myClassName);
  const target = normalizeForMatch(itemClassName);
  if (!target || target === 'tum siniflar' || target === 'tumu' || target === 'genel' || target === 'tum') return true;
  if (!mine) return false;
  return target
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .some((part) => part === mine);
}

export async function changePassword({ currentPassword, newPassword }) {
  const payload = {
    currentPassword: currentPassword || null,
    newPassword,
  };
  return await api.post('/api/auth/change-password', payload);
}

export async function requestPasswordReset(email) {
  return await api.post('/api/auth/forgot-password', { email });
}

export async function fetchPasswordResetRequests(status = 'Pending') {
  const response = await api.get('/api/auth/password-reset-requests', {
    params: status && status !== 'All' ? { status } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function reviewPasswordResetRequest(id, { approved, note = '' }) {
  return await api.post(`/api/auth/password-reset-requests/${id}/review`, {
    approved,
    note,
  });
}

export async function createParent({ fullName, phone, email }) {
  return await api.post('/api/parents', {
    fullName,
    phone: phone || '',
    email: email || '',
  });
}

export async function fetchReportStudents(params) {
  try {
    const response = await api.get('/api/reports/students', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

export async function fetchTeacherReportAnalytics(params) {
  try {
    const response = await api.get('/api/reports/teacher-analytics', {
      params,
    });
    return response || { classReports: [], topics: [] };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { classReports: [], topics: [] };
    }
    throw error;
  }
}

export async function fetchClasses() {
  const response = await api.get('/api/classes');
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.classes)) {
    return response.classes;
  }
  return [];
}

export async function createClass(payload) {
  const name = typeof payload === 'string' ? payload : payload?.name;
  const response = await api.post('/api/classes', { name });
  return response;
}

export async function createCompleteClass(payload) {
  const response = await api.post('/api/classes/create-complete', payload);
  return response;
}

/** transferTo verilirse öğrenciler o sınıfa taşınır; verilmezse sınıfsız kalıp pasife alınır. */
export async function deleteClass(className, transferTo = '') {
  const query = transferTo ? `?transferTo=${encodeURIComponent(transferTo)}` : '';
  return api.delete(`/api/classes/${encodeURIComponent(className)}${query}`);
}

export async function updateClassAssignments(className, payload) {
  const response = await api.put(`/api/classes/${encodeURIComponent(className)}/assignments`, payload);
  return response;
}

export async function fetchScheduleEntries() {
  const response = await api.get('/api/schedule');
  return response;
}

export async function createScheduleEntry(payload) {
  const response = await api.post('/api/schedule', payload);
  return response;
}

export async function updateScheduleEntry(id, payload) {
  const response = await api.put(`/api/schedule/${id}`, payload);
  return response;
}

export async function deleteScheduleEntry(id) {
  await api.delete(`/api/schedule/${id}`);
}

// ============ Live Room Sessions ============
// Backend canlı ders modeli. Announcement LIVE_LESSON parse'ı yerine bu
// endpoint'ler kullanılır. Tenant scope backend tarafında uygulanır.
export async function fetchLiveRoomSessions(params = {}) {
  const response = await api.get('/api/liveroomsessions', { params });
  return Array.isArray(response) ? response : [];
}

export async function openLiveRoomSession(payload) {
  const response = await api.post('/api/liveroomsessions/open', payload);
  return response;
}

export async function endLiveRoomSession(id) {
  const response = await api.post(`/api/liveroomsessions/${id}/end`);
  return response;
}

// ============ User Preferences ============
// Kullanıcıya özel ayarlar (bildirim tercihleri vb.) backend'de
// PlatformConfigurations tablosunda saklanır. localStorage yerine bu kullanılır.
export async function fetchUserPreferences() {
  const response = await api.get('/api/user-preferences');
  return response?.preferences ?? {};
}

export async function saveUserPreferences(preferences) {
  const response = await api.put('/api/user-preferences', preferences ?? {});
  return response?.preferences ?? {};
}

// ============ Overdue Rules ============
// Finansta otomatik hatırlatma kuralları tenant bazlı backend'de tutulur.
export async function fetchOverdueRules() {
  const response = await api.get('/api/overdue-rules');
  return Array.isArray(response?.rules) ? response.rules : [];
}

export async function saveOverdueRules(rules) {
  const response = await api.put('/api/overdue-rules', { rules: Array.isArray(rules) ? rules : [] });
  return Array.isArray(response?.rules) ? response.rules : [];
}

// ============ Excuse Requests ============
// Veli mazeret bildirimleri tenant scope'lu kalıcı saklanır.
export async function fetchExcuseRequests() {
  const response = await api.get('/api/excuse-requests');
  return Array.isArray(response) ? response : [];
}

export async function fetchMyExcuseRequests() {
  const response = await api.get('/api/excuse-requests/my');
  return Array.isArray(response) ? response : [];
}

export async function createExcuseRequest(payload) {
  const response = await api.post('/api/excuse-requests', payload);
  return response;
}

export async function decideExcuseRequest(id, payload) {
  const response = await api.put(`/api/excuse-requests/${id}/decision`, payload);
  return response;
}

// ============ Attendance QR Sessions ============
// Öğretmen QR yoklama oturumları. LIVE_LESSON announcement parse'ı yerine kullanılır.
export async function fetchAttendanceQrSessions(params = {}) {
  const response = await api.get('/api/attendance-qr-sessions', { params });
  return Array.isArray(response) ? response : [];
}

export async function fetchActiveAttendanceQrSessions(params = {}) {
  const response = await api.get('/api/attendance-qr-sessions/active', { params });
  return Array.isArray(response) ? response : [];
}

export async function openAttendanceQrSession(payload) {
  const response = await api.post('/api/attendance-qr-sessions/open', payload);
  return response;
}

export async function checkInAttendanceQrSession(payload) {
  const response = await api.post('/api/attendance-qr-sessions/check-in', payload);
  return response;
}

export async function closeAttendanceQrSession(id) {
  const response = await api.post(`/api/attendance-qr-sessions/${id}/close`);
  return response;
}

export async function createStudent(payload, branchId) {
  const config = branchId ? { headers: { 'X-Branch-Filter': branchId } } : undefined;
  const response = await api.post('/api/students', payload, config);
  return response;
}

export async function createEnrollment(payload) {
  const response = await api.post('/api/student-finance/enrollments', payload);
  return response;
}

export async function fetchStudentFinanceAccount(params) {
  const response = await api.get('/api/student-finance/account', { params });
  return response;
}

export async function recordFinancePayment(payload) {
  const response = await api.post('/api/student-finance/payments', payload);
  return response;
}

export async function fetchFinanceSummaries(className) {
  const response = await api.get('/api/student-finance/summaries', {
    params: className ? { className } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function fetchFinanceDashboard(className) {
  const response = await api.get('/api/student-finance/dashboard', {
    params: className ? { className } : undefined,
  });
  return response;
}

export async function refundFinancePayment(payload) {
  const response = await api.post('/api/student-finance/refunds', payload);
  return response;
}

export async function sendFinanceReminders(upcomingWindowDays = 7) {
  const response = await api.post('/api/student-finance/reminders', null, {
    params: { upcomingWindowDays },
  });
  return response;
}

export async function backfillFinanceInstallments() {
  const response = await api.post('/api/student-finance/backfill-installments');
  return response;
}

// Geçmiş "Peşinat" yöntemli kayıt peşinatlarını tek seferde "Nakit"e çevirir.
export async function backfillDownPaymentMethod() {
  const response = await api.post('/api/student-finance/backfill-downpayment-method');
  return response;
}

export async function createFinancePaymentIntent(payload) {
  const response = await api.post('/api/student-finance/payments/intent', payload);
  return response;
}

export async function confirmFinancePayment(payload) {
  const response = await api.post('/api/student-finance/payments/confirm', payload);
  return response;
}

export async function reconcileFinance(payload) {
  const response = await api.post('/api/student-finance/reconciliation', payload);
  return response;
}

export async function issueFinanceEInvoice(payload) {
  const response = await api.post('/api/student-finance/e-invoice/issue', payload);
  return response;
}

export async function calculatePayroll(payload) {
  const response = await api.post('/api/student-finance/payroll/calculate', payload);
  return response;
}

export async function updateStudent(id, payload) {
  const response = await api.put(`/api/students/${id}`, payload);
  return response;
}

export async function fetchStaff(role) {
  const response = await api.get('/api/staff', {
    params: role ? { role } : undefined,
  });
  return response;
}

export async function createStaff(payload, branchId) {
  const config = branchId ? { headers: { 'X-Branch-Filter': branchId } } : undefined;
  const response = await api.post('/api/staff', payload, config);
  return response;
}

export async function deleteStaffUser(userId) {
  await api.delete(`/api/staff/users/${userId}`);
}

export async function fetchCourses(params = {}) {
  const response = await api.get('/api/courses', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return response;
}

export async function createCourse(payload) {
  const response = await api.post('/api/courses', payload);
  return response;
}

export async function updateCourse(id, payload) {
  const response = await api.put(`/api/courses/${id}`, payload);
  return response;
}

export async function deleteCourse(id) {
  await api.delete(`/api/courses/${id}`);
}

export async function updateStaff(staffId, payload) {
  const response = await api.put(`/api/staff/${staffId}`, payload);
  return response;
}

export async function fetchAnnouncements(audienceOrOptions, maybeOptions = {}) {
  const options = typeof audienceOrOptions === 'string'
    ? { ...maybeOptions, audience: audienceOrOptions }
    : { ...(audienceOrOptions || {}) };
  const response = await api.get('/api/announcements', {
    params: Object.keys(options).length > 0 ? options : undefined,
  });
  return response;
}

export async function createAnnouncement(payload) {
  const response = await api.post('/api/announcements', payload);
  return response;
}

export async function deleteAnnouncement(id) {
  await api.delete(`/api/announcements/${id}`);
}

export async function fetchNotifications(targetRole) {
  const response = await api.get('/api/notifications', {
    params: targetRole ? { targetRole } : undefined,
  });
  return response;
}

export async function createNotification(payload) {
  const response = await api.post('/api/notifications', payload);
  return response;
}

export async function fetchPlatformConfigurations(configurationType) {
  const response = await api.get('/api/platformconfigurations', {
    params: configurationType ? { configurationType } : undefined,
  });
  return response;
}

export async function upsertPlatformConfiguration(payload) {
  const response = await api.put('/api/platformconfigurations', payload);
  return response;
}

export async function fetchApprovals(params) {
  const response = await api.get('/api/approvals', { params });
  return Array.isArray(response) ? response : [];
}

export async function createApproval(payload) {
  const response = await api.post('/api/approvals', payload);
  return response;
}

export async function fetchMyApprovals() {
  const response = await api.get('/api/approvals/mine');
  return Array.isArray(response) ? response : [];
}

export async function decideApproval(id, payload) {
  const response = await api.post(`/api/approvals/${id}/decide`, payload);
  return response;
}

export async function fetchAuditLogs(params) {
  const response = await api.get('/api/audit-logs', { params });
  return Array.isArray(response) ? response : [];
}

// Gelişmiş denetim görünümü: kategori/şube/tarih/arama + sayfalama.
export async function fetchAuditLogsPaged(params) {
  const response = await api.get('/api/audit-logs/paged', { params });
  return response && Array.isArray(response.items)
    ? response
    : { items: [], totalCount: 0, skip: 0, take: 0 };
}

// Kurum yöneticisi için şube bazında log özeti.
export async function fetchAuditBranchSummary() {
  const response = await api.get('/api/audit-logs/branch-summary');
  return Array.isArray(response) ? response : [];
}

// Platform (geliştirici) denetim merkezi.
export async function fetchPlatformAuditOverview() {
  const response = await api.get('/api/platformops/audit/overview');
  return Array.isArray(response) ? response : [];
}

export async function fetchPlatformAuditTenantBranches(tenantId) {
  const response = await api.get(`/api/platformops/audit/tenants/${tenantId}/branches`);
  return Array.isArray(response) ? response : [];
}

export async function fetchPlatformAuditLogs(params) {
  const response = await api.get('/api/platformops/audit/logs', { params });
  return response && Array.isArray(response.items)
    ? response
    : { items: [], totalCount: 0, skip: 0, take: 0 };
}

// Veli hesapları (durum + bağlı öğrenciler) — pasifleştirme yönetimi.
export async function fetchParentAccounts() {
  const response = await api.get('/api/parents/accounts');
  return Array.isArray(response) ? response : [];
}

export async function fetchParentAcademic() {
  const response = await api.get('/api/parent/academic/children');
  return Array.isArray(response) ? response : [];
}

export async function fetchParentChildrenFinance() {
  const response = await api.get('/api/parent/finance/children');
  return Array.isArray(response) ? response : [];
}

export async function parentPay(payload) {
  const response = await api.post('/api/parent/finance/pay', payload);
  return response;
}

export async function fetchOrgUnits() {
  const response = await api.get('/api/org-units');
  return Array.isArray(response) ? response : [];
}

// Context switcher verisi: kullanıcının erişebildiği kurum/şube ağacı + aktif bağlam.
export async function fetchMyScope() {
  return api.get('/api/my-scope');
}

// Konsolide roll-up: erişilebilir tüm kurumların özet metrikleri + genel toplam.
export async function fetchMyScopeRollup() {
  return api.get('/api/my-scope/rollup');
}

// Şube sorumlusu adayları (personel + kurum yöneticileri, yalnız aktifler).
export async function fetchManagerCandidates() {
  const response = await api.get('/api/org-units/manager-candidates');
  return Array.isArray(response) ? response : [];
}

// Birimi pasif/aktif yapar (pasif birim seçim listelerinde görünmez, veri silinmez).
export async function setOrgUnitActive(id, isActive) {
  return api.put(`/api/org-units/${id}/active`, { isActive });
}

// Var olan kullanıcının rol/şube/özel rol atamasını günceller (ev grant'ı yenilenir).
export async function updateStaffAssignment(userId, payload) {
  return api.put(`/api/staff/users/${userId}/assignment`, payload);
}

// ── Özel roller (kurum yöneticisi tanımlar; modül erişimi API'de zorlanır) ──
export async function fetchCustomRoles() { return api.get('/api/custom-roles'); }
export async function fetchMyCustomRole() { return api.get('/api/custom-roles/my'); }
export async function createCustomRole(payload) { return api.post('/api/custom-roles', payload); }
export async function updateCustomRole(id, payload) { return api.put(`/api/custom-roles/${id}`, payload); }
export async function deleteCustomRole(id) { return api.delete(`/api/custom-roles/${id}`); }

// ── Kapsam yönetimi (platform admin): grup ağacı + kurum→grup + kullanıcı grant'ları ──
export async function fetchScopeGroups() { return api.get('/api/scope-admin/groups'); }
export async function createScopeGroup(payload) { return api.post('/api/scope-admin/groups', payload); }
export async function deleteScopeGroup(id) { return api.delete(`/api/scope-admin/groups/${id}`); }
export async function fetchScopeTenants() { return api.get('/api/scope-admin/tenants'); }
export async function assignTenantGroup(tenantId, groupId) {
  return api.put(`/api/scope-admin/tenants/${tenantId}/group`, { groupId: groupId || null });
}
export async function searchScopeUsers(search) {
  return api.get('/api/scope-admin/users', { params: search ? { search } : undefined });
}
export async function fetchUserGrants(userId) { return api.get(`/api/scope-admin/users/${userId}/grants`); }
export async function addUserGrant(userId, payload) { return api.post(`/api/scope-admin/users/${userId}/grants`, payload); }
export async function removeUserGrant(grantId) { return api.delete(`/api/scope-admin/grants/${grantId}`); }

export async function createOrgUnit(payload) {
  const response = await api.post('/api/org-units', payload);
  return response;
}

export async function updateOrgUnit(id, payload) {
  const response = await api.put(`/api/org-units/${id}`, payload);
  return response;
}

export async function backfillBranch(branchId) {
  const response = await api.post('/api/org-units/backfill-branch', null, { params: { branchId } });
  return response;
}

export async function deleteOrgUnit(id) {
  await api.delete(`/api/org-units/${id}`);
}

export async function fetchAdminOverview() {
  const response = await api.get('/api/admin/overview');
  return response || {};
}

export async function fetchAdminTasks(params) {
  const response = await api.get('/api/admin-tasks', { params });
  return Array.isArray(response) ? response : [];
}

export async function fetchMyAdminTasks() {
  const response = await api.get('/api/admin-tasks/mine');
  return Array.isArray(response) ? response : [];
}

export async function createAdminTask(payload) {
  const response = await api.post('/api/admin-tasks', payload);
  return response;
}

export async function updateAdminTaskStatus(id, status, reason = null) {
  const response = await api.post(`/api/admin-tasks/${id}/status`, { status, reason });
  return response;
}

export async function fetchAdminDocuments(params) {
  const response = await api.get('/api/admin-documents', { params });
  return Array.isArray(response) ? response : [];
}

export async function createAdminDocument(payload) {
  const response = await api.post('/api/admin-documents', payload);
  return response;
}

export async function archiveAdminDocument(id) {
  const response = await api.post(`/api/admin-documents/${id}/archive`);
  return response;
}

export async function fetchLeaves(params) {
  const response = await api.get('/api/staff-hr/leaves', { params });
  return Array.isArray(response) ? response : [];
}

export async function createLeave(payload) {
  const response = await api.post('/api/staff-hr/leaves', payload);
  return response;
}

export async function decideLeave(id, payload) {
  const response = await api.post(`/api/staff-hr/leaves/${id}/decide`, payload);
  return response;
}

export async function fetchLeaveBalance(staffName) {
  const response = await api.get('/api/staff-hr/leave-balance', { params: { staffName } });
  return response;
}

export async function fetchStaffAssets(params) {
  const response = await api.get('/api/staff-hr/assets', { params });
  return Array.isArray(response) ? response : [];
}

export async function assignStaffAsset(payload) {
  const response = await api.post('/api/staff-hr/assets', payload);
  return response;
}

export async function returnStaffAsset(id) {
  const response = await api.post(`/api/staff-hr/assets/${id}/return`);
  return response;
}

export async function fetchAppSettings(category) {
  const response = await api.get('/api/appsettings', {
    params: category ? { category } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function saveAppSettings(items) {
  const response = await api.put('/api/appsettings', items);
  return Array.isArray(response) ? response : [];
}

export async function fetchMySupportTickets() {
  const response = await api.get('/api/support-tickets/mine');
  return response;
}

// Kurum sahibi tarafı (tenant-side) — admin tarafı için createSupportTicket var
export async function createMySupportTicket(payload) {
  const response = await api.post('/api/support-tickets', payload);
  return response;
}

export async function fetchSystemStatus() {
  // Public endpoint — token gönderme zorunlu değil
  const response = await api.get('/api/system/status');
  return response;
}

export async function setSystemMaintenance({ enabled, message }) {
  const response = await api.put('/api/system/maintenance', {
    enabled: Boolean(enabled),
    message: message || null,
  });
  return response;
}

export async function fetchPlatformSubscriptionInvoices(params = {}) {
  const response = await api.get('/api/platformsubscriptions', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return response;
}

export async function fetchMyPlatformSubscriptionInvoices() {
  const response = await api.get('/api/platformsubscriptions/mine');
  return response;
}

export async function purchasePlatformSubscription(payload) {
  const response = await api.post('/api/platformsubscriptions/purchase', payload);
  return response;
}

export async function markPlatformInvoicePaid(invoiceId, payload = {}) {
  const response = await api.put(`/api/platformsubscriptions/${invoiceId}/pay`, payload);
  return response;
}

export async function cancelPlatformInvoice(invoiceId, payload = {}) {
  const response = await api.put(`/api/platformsubscriptions/${invoiceId}/cancel`, payload);
  return response;
}

export async function fetchSiteContentSection(sectionKey, language = 'tr') {
  try {
    const response = await api.get(`/api/sitecontents/${sectionKey}`, {
      params: { language },
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function updateSiteContentSection(sectionKey, { language = 'tr', content, publish = true }) {
  const response = await api.put(`/api/sitecontents/${sectionKey}`, {
    language,
    content,
    publish,
  });
  return response;
}

export async function fetchPlatformTenants() {
  const response = await api.get('/api/platformops/tenants');
  return response;
}

export async function fetchTenantFeatures(tenantId) {
  const response = await api.get(`/api/tenant-features/tenants/${tenantId}`);
  return response;
}

export async function saveTenantFeatures(tenantId, features) {
  const response = await api.put(`/api/tenant-features/tenants/${tenantId}`, { features });
  return response;
}

export async function fetchMyTenantFeatures() {
  const response = await api.get('/api/tenant-features/my');
  return response;
}

// ─── Paket yetkileri (paket → rol → sayfa → işlem) ──────────────────────────

export async function fetchPlatformPackages() {
  const response = await api.get('/api/platform-packages');
  return response;
}

export async function savePlatformPackage(packageId, payload) {
  const response = await api.put(`/api/platform-packages/${encodeURIComponent(packageId)}`, payload);
  return response;
}

export async function deletePlatformPackage(packageId) {
  await api.delete(`/api/platform-packages/${encodeURIComponent(packageId)}`);
}

export async function fetchMyEntitlements() {
  const response = await api.get('/api/platform-packages/my-entitlements');
  return response;
}

export async function fetchPlatformOverview() {
  const response = await api.get('/api/platformops/overview');
  return response;
}

export async function upsertPlatformTenant(payload, id) {
  const response = await api.put('/api/platformops/tenants', payload, {
    params: id ? { id } : undefined,
  });
  return response;
}

export async function approveTenant(id) {
  const response = await api.put(`/api/platformops/tenants/${id}/approve`);
  return response;
}

export async function rejectTenant(id) {
  const response = await api.put(`/api/platformops/tenants/${id}/reject`);
  return response;
}

export async function fetchSupportTickets() {
  const response = await api.get('/api/platformops/support-tickets');
  return response;
}

export async function createSupportTicket(payload) {
  const response = await api.post('/api/platformops/support-tickets', payload);
  return response;
}

export async function updateSupportTicket(id, payload) {
  const response = await api.put(`/api/platformops/support-tickets/${id}`, payload);
  return response;
}

export async function fetchThreads() {
  const response = await api.get('/api/messages/threads');
  return response;
}

export async function fetchThreadMessages(threadId) {
  const response = await api.get(`/api/messages/threads/${threadId}`);
  return response;
}

export async function createThread(payload) {
  const response = await api.post('/api/messages/threads', payload);
  return response;
}

export async function sendThreadMessage(threadId, payload) {
  const response = await api.post(`/api/messages/threads/${threadId}/messages`, payload);
  return response;
}

export async function deleteThreadMessageForMe(threadId, messageId) {
  await api.delete(`/api/messages/threads/${threadId}/messages/${messageId}/me`);
}

export async function fetchContents(visibleOnly) {
  const response = await api.get('/api/contents', {
    params: { visibleOnly },
  });
  return response;
}

export async function createContent(payload) {
  const response = await api.post('/api/contents', payload);
  return response;
}

export async function deleteContent(id) {
  await api.delete(`/api/contents/${id}`);
}

export async function updateContentStatus(id, publishStatus) {
  const response = await api.put(`/api/contents/${id}/status`, { publishStatus });
  return response;
}

export async function fetchMyContentEngagement() {
  return await api.get('/api/contents/my-engagement');
}

export async function fetchContentEngagement(contentId) {
  if (!contentId) return null;
  return await api.get(`/api/contents/${contentId}/engagement`);
}

export async function saveContentUserState(contentId, payload) {
  return await api.put(`/api/contents/${contentId}/engagement/state`, payload);
}

export async function saveContentExtras(contentId, payload) {
  return await api.put(`/api/contents/${contentId}/engagement/extras`, payload);
}

export async function addContentComment(contentId, message) {
  return await api.post(`/api/contents/${contentId}/engagement/comments`, { message });
}

export async function fetchHomework() {
  const response = await api.get('/api/homework');
  return response;
}

export async function createHomework(payload) {
  const response = await api.post('/api/homework', payload);
  return response;
}

export async function deleteHomework(id) {
  await api.delete(`/api/homework/${id}`);
}

export async function submitHomework(id, payload) {
  const response = await api.post(`/api/homework/${id}/submit`, payload);
  return response;
}

export async function fetchExamResults(params) {
  const response = await api.get('/api/examresults', {
    params,
  });
  return response;
}

export async function createExamResult(payload) {
  const response = await api.post('/api/examresults', payload);
  return response;
}

export async function fetchAttendance(params) {
  const response = await api.get('/api/attendance', {
    params,
  });
  return response;
}

export async function saveAttendance(payload) {
  const response = await api.post('/api/attendance', payload);
  return response;
}

export async function deleteAttendanceRecord(id) {
  await api.delete(`/api/attendance/${id}`);
}

export async function fetchAdminAnalytics({ period = 'week', from, to } = {}) {
  const params = { period };
  if (from) params.from = from;
  if (to) params.to = to;
  const response = await api.get('/api/admin/analytics', { params });
  return response;
}

export async function fetchAccountingDashboard() {
  const response = await api.get('/api/accounting/dashboard');
  return response;
}

export async function fetchAccountingBenefits() {
  const response = await api.get('/api/accounting/benefits');
  return response;
}

export async function createAccountingBenefit(payload) {
  const response = await api.post('/api/accounting/benefits', payload);
  return response;
}

export async function createCollection(payload) {
  const response = await api.post('/api/accounting/collections', payload);
  return response;
}

export async function updateCollection(id, payload) {
  const response = await api.put(`/api/accounting/collections/${id}`, payload);
  return response;
}

export async function deleteCollection(id) {
  await api.delete(`/api/accounting/collections/${id}`);
}

export async function createInvoice(payload) {
  const response = await api.post('/api/accounting/invoices', payload);
  return response;
}

export async function createInstallment(payload) {
  const response = await api.post('/api/accounting/installments', payload);
  return response;
}

export async function updateApprovalStatus(id, status) {
  const response = await api.put(`/api/accounting/approvals/${id}/status`, { status });
  return response;
}

export async function createAccountingNotification(payload) {
  const response = await api.post('/api/accounting/notifications', payload);
  return response;
}

export async function sendBulkAccountingReminders() {
  const response = await api.post('/api/accounting/bulk-reminders');
  return response;
}

export async function fetchQuestionBank(className) {
  const response = await api.get('/api/questionbank', {
    params: className ? { className } : undefined,
  });
  return response;
}

export async function uploadQuestionImportFile(formData) {
  const response = await api.post('/api/question-import/upload', formData);
  return response;
}

export async function fetchQuestionImportJob(importId) {
  const response = await api.get(`/api/question-import/${importId}`);
  return response;
}

export async function fetchQuestionImportHistory() {
  const response = await api.get('/api/question-import/history');
  return Array.isArray(response) ? response : [];
}

export async function updateQuestionImportQuestion(importId, questionId, payload) {
  const response = await api.put(`/api/question-import/${importId}/questions/${questionId}`, payload);
  return response;
}

export async function deleteQuestionImportQuestion(importId, questionId) {
  await api.delete(`/api/question-import/${importId}/questions/${questionId}`);
}

export async function duplicateQuestionImportQuestion(importId, questionId) {
  const response = await api.post(`/api/question-import/${importId}/questions/${questionId}/duplicate`);
  return response;
}

export async function bulkUpdateQuestionImport(importId, payload) {
  const response = await api.post(`/api/question-import/${importId}/bulk-update`, payload);
  return response;
}

export async function commitQuestionImport(importId, payload) {
  const response = await api.post(`/api/question-import/${importId}/commit`, payload);
  return response;
}

export async function deleteQuestionImportJob(importId) {
  await api.delete(`/api/question-import/${importId}`);
}

export async function fetchTeacherWeeklyReportBootstrap(params) {
  try {
    const response = await api.get('/api/reports/teacher-weekly/bootstrap', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return { classes: [], subjects: [], students: [] };
    }
    throw error;
  }
}

export async function createTeacherWeeklyReport(payload) {
  try {
    const response = await api.post('/api/reports/teacher-weekly', payload);
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error('Haftalık rapor servisi bu backend oturumunda bulunamadı. Backend’i güncel kodla yeniden başlat.');
    }
    throw error;
  }
}

export async function fetchTeacherWeeklyReportsForTeacher(params) {
  try {
    const response = await api.get('/api/reports/teacher-weekly/teacher', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

export async function fetchTeacherWeeklyReportsForParent(params) {
  try {
    const response = await api.get('/api/reports/teacher-weekly/parent', {
      params,
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

export async function fetchQuestionPracticeAttempts(studentUsername) {
  const response = await api.get('/api/questionbank/attempts', {
    params: studentUsername ? { studentUsername } : undefined,
  });
  return response;
}

export async function createQuestionBankItem(payload) {
  const response = await api.post('/api/questionbank', payload);
  return response;
}

export async function updateQuestionBankItem(id, payload) {
  const response = await api.put(`/api/questionbank/${id}`, payload);
  return response;
}

export async function deleteQuestionBankItem(id) {
  await api.delete(`/api/questionbank/${id}`);
}

export async function incrementQuestionUsage(id) {
  const response = await api.post(`/api/questionbank/${id}/usage`);
  return response;
}

export async function submitQuestionPracticeAttempt(id, payload) {
  const response = await api.post(`/api/questionbank/${id}/attempts`, payload);
  return response;
}

export async function fetchQuestionPracticeStats(params) {
  const response = await api.get('/api/questionbank/attempts/stats', { params });
  return response;
}

export async function fetchWrongAnswers(params) {
  const response = await api.get('/api/wronganswers', {
    params,
  });
  return response;
}

export async function clearWrongAnswers(params) {
  await api.delete('/api/wronganswers', {
    params,
  });
}

export async function fetchMeetingRequests(params) {
  const response = await api.get('/api/meetingrequests', {
    params,
  });
  return response;
}

export async function createMeetingRequest(payload) {
  const response = await api.post('/api/meetingrequests', payload);
  return response;
}

export async function fetchMeetingSlots(params) {
  const response = await api.get('/api/meetingrequests/slots', {
    params,
  });
  return response;
}

export async function fetchMeetingAvailability(params) {
  const response = await api.get('/api/meetingrequests/availability', {
    params,
  });
  return response;
}

export async function fetchMeetingAdvisors() {
  const response = await api.get('/api/meetingrequests/advisors');
  return response;
}

export async function createMeetingAvailability(payload) {
  const response = await api.post('/api/meetingrequests/availability', payload);
  return response;
}

export async function deleteMeetingAvailability(id) {
  const response = await api.delete(`/api/meetingrequests/availability/${id}`);
  return response;
}

export async function updateMeetingRequestStatus(id, status, meetingLink = null) {
  const response = await api.put(`/api/meetingrequests/${id}/status`, { status, meetingLink });
  return response;
}

export async function fetchQuestionThreads() {
  const response = await api.get('/api/questionthreads');
  return response;
}

export async function createQuestionThread(payload) {
  const response = await api.post('/api/questionthreads', payload);
  return response;
}

export async function replyQuestionThread(id, payload) {
  const response = await api.post(`/api/questionthreads/${id}/replies`, payload);
  return response;
}

// --- Study Plans ---

export async function fetchStudyPlan() {
  const response = await api.get('/api/studyplans');
  return response;
}

export async function saveStudyPlan(payload) {
  const response = await api.put('/api/studyplans', payload);
  return response;
}

export async function addStudyPlanXp(amount) {
  const response = await api.post('/api/studyplans/xp', { amount });
  return response;
}

export async function addStudyPlanItem(item) {
  const response = await api.post('/api/studyplans/items', { item });
  return response;
}

export async function setStudyPlanItemDone(itemId, done) {
  const response = await api.patch(`/api/studyplans/items/${itemId}/done`, { done });
  return response;
}

export async function deleteStudyPlanItem(itemId) {
  const response = await api.delete(`/api/studyplans/items/${itemId}`);
  return response;
}

export async function fetchPlannedExams(params) {
  const response = await api.get('/api/plannedexams', { params });
  return response;
}

export async function createPlannedExam(payload) {
  const response = await api.post('/api/plannedexams', payload);
  return response;
}

export async function deletePlannedExam(id) {
  const response = await api.delete(`/api/plannedexams/${id}`);
  return response;
}

export async function fetchPlannedExamSubmissions(id) {
  const response = await api.get(`/api/plannedexams/${id}/submissions`);
  return response;
}

export async function checkinPlannedExam(id, payload) {
  const response = await api.post(`/api/plannedexams/${id}/checkin`, payload);
  return response;
}

export async function fetchPlannedExamAttendance(id) {
  const response = await api.get(`/api/plannedexams/${id}/attendance`);
  return response;
}

export async function savePlannedExamAttendance(id, payload) {
  const response = await api.post(`/api/plannedexams/${id}/attendance`, payload);
  return response;
}

export async function fetchMyExamPapers(params) {
  const response = await api.get('/api/solution-sessions/my-papers', { params });
  return response;
}

export async function startExamSession(payload) {
  const response = await api.post('/api/examsessions/start', payload);
  return response;
}

export async function submitExamSessionAnswer(sessionId, payload) {
  const response = await api.post(`/api/examsessions/${sessionId}/answers`, payload);
  return response;
}

export async function completeExamSession(sessionId) {
  const response = await api.post(`/api/examsessions/${sessionId}/complete`);
  return response;
}

export async function approveExamSubmission(sessionId) {
  const response = await api.post(`/api/examsessions/${sessionId}/approve`);
  return response;
}

// --- Staff (Accounting) ---

export async function createStaffAccounting(payload) {
  const response = await api.post('/api/staff/accounting', payload);
  return response;
}

// --- Notifications (mark read) ---

export async function markNotificationRead(id) {
  const response = await api.put(`/api/notifications/${id}/read`);
  return response;
}

// --- File Uploads ---

export async function uploadFile(formData, folder) {
  const file = formData?.get?.('file');
  if (canUploadInChunks(file) && file.size > UPLOAD_CHUNK_BYTES) {
    return uploadFileInChunks(file, folder);
  }

  if (folder && formData?.set) {
    formData.set('folder', folder);
  }
  const response = await api.post('/api/uploads', formData, {
    params: folder ? { folder } : undefined,
  });
  return response;
}

// --- User Directory (Admin) ---

export async function fetchUsers(page = 1, pageSize = 200) {
  const response = await api.get('/api/users', { params: { page, pageSize } });
  return response;
}

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

  return upsertPlatformConfiguration({
    configurationType: 'tenant-customization',
    scopeKey: tenantId,
    displayName: `SA_TENANT_CUSTOMIZATION::${tenantId}`,
    payloadJson: JSON.stringify(brandingPayload),
  });
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
