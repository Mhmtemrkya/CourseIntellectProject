import { api } from './client';

function isNotFoundError(error) {
  return /404/.test(String(error?.message || ''));
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

export async function fetchStudents() {
  const response = await api.get('/api/students');
  return response;
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

export async function createStudent(payload) {
  const response = await api.post('/api/students', payload);
  return response;
}

export async function fetchStaff(role) {
  const response = await api.get('/api/staff', {
    params: role ? { role } : undefined,
  });
  return response;
}

export async function createStaff(payload) {
  const response = await api.post('/api/staff', payload);
  return response;
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

export async function updateMeetingRequestStatus(id, status) {
  const response = await api.put(`/api/meetingrequests/${id}/status`, { status });
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
  const isDesktopLike = typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__);
  const file = formData?.get?.('file');

  if (isDesktopLike && file instanceof File) {
    const response = await api.post('/api/uploads/json', {
      fileName: file.name,
      base64Content: await fileToBase64(file),
      contentType: file.type || 'application/octet-stream',
    }, {
      params: folder ? { folder } : undefined,
    });
    return response;
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
