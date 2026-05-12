// Legacy TanStack Query API facade.
// Aktif sayfa kodları çoğunlukla lib/api/modules.js kullanıyor; bu dosya import
// edilirse de backend'in gerçek /api route standardına ve client.js'in direkt
// body döndürme davranışına uyumlu kalmalıdır.
import { api } from './client';

const withParams = (params) => ({ params });

// Auth Endpoints
export const authApi = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  logout: () => api.post('/api/auth/logout'),
  refresh: (refreshToken) => api.post('/api/auth/refresh', { refreshToken }),
  me: () => api.get('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
};

// Students Endpoints
export const studentsApi = {
  getAll: (params) => api.get('/api/students', withParams(params)),
  getById: (id) => api.get(`/api/students/${id}`),
  create: (data) => api.post('/api/students', data),
  update: (id, data) => api.put(`/api/students/${id}`, data),
  delete: (id) => api.delete(`/api/students/${id}`),
  getAttendance: (id, params) => api.get('/api/attendance', withParams({ ...(params || {}), studentId: id })),
  getExams: (id) => api.get('/api/examresults', withParams({ studentId: id })),
};

// Parents Endpoints
export const parentsApi = {
  getAll: (params) => api.get('/api/parents', withParams(params)),
  getById: (id) => api.get(`/api/parents/${id}`),
  create: (data) => api.post('/api/parents', data),
  update: (id, data) => api.put(`/api/parents/${id}`, data),
  delete: (id) => api.delete(`/api/parents/${id}`),
  linkStudent: (parentId, studentId) => api.post(`/api/parents/${parentId}/students/${studentId}`),
};

// Backend'de ayrı /teachers route'u yok; öğretmen dizini staff üzerinden gelir.
export const teachersApi = {
  getAll: (params) => api.get('/api/staff', withParams({ ...(params || {}), role: 'Teacher' })),
  getById: (id) => api.get(`/api/staff/${id}`),
  create: (data) => api.post('/api/staff', { ...data, role: data?.role || 'Teacher' }),
  update: (id, data) => api.put(`/api/staff/${id}`, data),
  delete: (id) => api.delete(`/api/staff/${id}`),
  getSchedule: (id) => api.get('/api/schedule', withParams({ teacherId: id })),
  getPendingQuestions: (id) => api.get('/api/questionthreads', withParams({ teacherId: id, status: 'pending' })),
};

// Classes Endpoints
export const classesApi = {
  getAll: (params) => api.get('/api/classes', withParams(params)),
  getById: (id) => api.get(`/api/classes/${id}`),
  create: (data) => api.post('/api/classes', data),
  update: (id, data) => api.put(`/api/classes/${id}`, data),
  delete: (id) => api.delete(`/api/classes/${id}`),
  getStudents: (id) => api.get('/api/students', withParams({ classId: id })),
  getSchedule: (id) => api.get('/api/schedule', withParams({ classId: id })),
};

// Schedule Endpoints — tek kaynak /api/schedule.
export const scheduleApi = {
  getByClass: (classId, params) => api.get('/api/schedule', withParams({ ...(params || {}), classId })),
  getByTeacher: (teacherId, params) => api.get('/api/schedule', withParams({ ...(params || {}), teacherId })),
  create: (data) => api.post('/api/schedule', data),
  update: (id, data) => api.put(`/api/schedule/${id}`, data),
  delete: (id) => api.delete(`/api/schedule/${id}`),
};

// Attendance Endpoints
export const attendanceApi = {
  getByLesson: (lessonId) => api.get('/api/attendance', withParams({ lessonId })),
  submit: (lessonId, data) => api.post('/api/attendance', { ...data, lessonId }),
  update: (id, status) => api.patch(`/api/attendance/${id}`, { status }),
  getReport: (params) => api.get('/api/attendance', withParams(params)),
};

// Content Endpoints
export const contentApi = {
  getAll: (params) => api.get('/api/contents', withParams(params)),
  getById: (id) => api.get(`/api/contents/${id}`),
  create: (data) => api.post('/api/contents', data),
  update: (id, data) => api.put(`/api/contents/${id}`, data),
  delete: (id) => api.delete(`/api/contents/${id}`),
  getUploadUrl: (filename, contentType) => api.post('/api/uploads/presign', { filename, contentType }),
  completeUpload: (id, data) => api.post(`/api/contents/${id}/complete`, data),
};

// Questions / threads Endpoints
export const questionsApi = {
  getAll: (params) => api.get('/api/questionthreads', withParams(params)),
  getById: (id) => api.get(`/api/questionthreads/${id}`),
  create: (data) => api.post('/api/questionthreads', data),
  answer: (id, answer) => api.post(`/api/questionthreads/${id}/replies`, { answer }),
  delete: (id) => api.delete(`/api/questionthreads/${id}`),
};

// Exams Endpoints — sınav akışları planned/exam sessions/results olarak ayrık.
export const examsApi = {
  getAll: (params) => api.get('/api/plannedexams', withParams(params)),
  getById: (id) => api.get(`/api/plannedexams/${id}`),
  create: (data) => api.post('/api/plannedexams', data),
  update: (id, data) => api.put(`/api/plannedexams/${id}`, data),
  delete: (id) => api.delete(`/api/plannedexams/${id}`),
  start: (id) => api.post('/api/examsessions', { plannedExamId: id }),
  getResults: (id) => api.get('/api/examresults', withParams({ plannedExamId: id })),
};

// Question Bank Endpoints
export const questionBankApi = {
  getAll: (params) => api.get('/api/questionbank', withParams(params)),
  getById: (id) => api.get(`/api/questionbank/${id}`),
  create: (data) => api.post('/api/questionbank', data),
  update: (id, data) => api.put(`/api/questionbank/${id}`, data),
  delete: (id) => api.delete(`/api/questionbank/${id}`),
};

// Reports Endpoints
export const reportsApi = {
  getAttendance: (params) => api.get('/api/reports/attendance', withParams(params)),
  getPerformance: (params) => api.get('/api/reports/performance', withParams(params)),
  getStudents: (params) => api.get('/api/reports/students', withParams(params)),
  getTeachers: (params) => api.get('/api/reports/teachers', withParams(params)),
  export: (type, params) => api.get(`/api/reports/${type}/export`, withParams(params)),
};

// Dashboard Endpoints
export const dashboardApi = {
  getStats: () => api.get('/api/dashboard/stats'),
  getTodayLessons: () => api.get('/api/schedule'),
  getActivities: () => api.get('/api/dashboard/activities'),
  getPendingQuestions: () => api.get('/api/questionthreads', withParams({ status: 'pending' })),
};

// Settings/Config Endpoints
export const settingsApi = {
  get: () => api.get('/api/appsettings'),
  update: (data) => api.put('/api/appsettings', data),
  testConnection: (url) => api.post('/api/system/test-connection', { url }),
};
