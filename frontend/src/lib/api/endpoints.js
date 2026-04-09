// CourseIntellect API Endpoints
import { api } from './client';

// Auth Endpoints
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// Students Endpoints
export const studentsApi = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  getAttendance: (id, params) => api.get(`/students/${id}/attendance`, { params }),
  getExams: (id) => api.get(`/students/${id}/exams`),
};

// Parents Endpoints
export const parentsApi = {
  getAll: (params) => api.get('/parents', { params }),
  getById: (id) => api.get(`/parents/${id}`),
  create: (data) => api.post('/parents', data),
  update: (id, data) => api.put(`/parents/${id}`, data),
  delete: (id) => api.delete(`/parents/${id}`),
  linkStudent: (parentId, studentId) => api.post(`/parents/${parentId}/students/${studentId}`),
};

// Teachers Endpoints
export const teachersApi = {
  getAll: (params) => api.get('/teachers', { params }),
  getById: (id) => api.get(`/teachers/${id}`),
  create: (data) => api.post('/teachers', data),
  update: (id, data) => api.put(`/teachers/${id}`, data),
  delete: (id) => api.delete(`/teachers/${id}`),
  getSchedule: (id) => api.get(`/teachers/${id}/schedule`),
  getPendingQuestions: (id) => api.get(`/teachers/${id}/questions/pending`),
};

// Classes Endpoints
export const classesApi = {
  getAll: (params) => api.get('/classes', { params }),
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`),
  getStudents: (id) => api.get(`/classes/${id}/students`),
  getSchedule: (id) => api.get(`/classes/${id}/schedule`),
};

// Schedule Endpoints
export const scheduleApi = {
  getByClass: (classId, params) => api.get(`/schedule/class/${classId}`, { params }),
  getByTeacher: (teacherId, params) => api.get(`/schedule/teacher/${teacherId}`, { params }),
  create: (data) => api.post('/schedule', data),
  update: (id, data) => api.put(`/schedule/${id}`, data),
  delete: (id) => api.delete(`/schedule/${id}`),
};

// Attendance Endpoints
export const attendanceApi = {
  getByLesson: (lessonId) => api.get(`/attendance/lesson/${lessonId}`),
  submit: (lessonId, data) => api.post(`/attendance/lesson/${lessonId}`, data),
  update: (id, status) => api.patch(`/attendance/${id}`, { status }),
  getReport: (params) => api.get('/attendance/report', { params }),
};

// Content Endpoints
export const contentApi = {
  getAll: (params) => api.get('/content', { params }),
  getById: (id) => api.get(`/content/${id}`),
  create: (data) => api.post('/content', data),
  update: (id, data) => api.put(`/content/${id}`, data),
  delete: (id) => api.delete(`/content/${id}`),
  getUploadUrl: (filename, contentType) => 
    api.post('/content/upload-url', { filename, contentType }),
  completeUpload: (id, data) => api.post(`/content/${id}/complete`, data),
};

// Questions Endpoints
export const questionsApi = {
  getAll: (params) => api.get('/questions', { params }),
  getById: (id) => api.get(`/questions/${id}`),
  create: (data) => api.post('/questions', data),
  answer: (id, answer) => api.post(`/questions/${id}/answer`, { answer }),
  delete: (id) => api.delete(`/questions/${id}`),
};

// Exams Endpoints
export const examsApi = {
  getAll: (params) => api.get('/exams', { params }),
  getById: (id) => api.get(`/exams/${id}`),
  create: (data) => api.post('/exams', data),
  update: (id, data) => api.put(`/exams/${id}`, data),
  delete: (id) => api.delete(`/exams/${id}`),
  start: (id) => api.post(`/exams/${id}/start`),
  getResults: (id) => api.get(`/exams/${id}/results`),
};

// Question Bank Endpoints
export const questionBankApi = {
  getAll: (params) => api.get('/question-bank', { params }),
  getById: (id) => api.get(`/question-bank/${id}`),
  create: (data) => api.post('/question-bank', data),
  update: (id, data) => api.put(`/question-bank/${id}`, data),
  delete: (id) => api.delete(`/question-bank/${id}`),
};

// Reports Endpoints
export const reportsApi = {
  getAttendance: (params) => api.get('/reports/attendance', { params }),
  getPerformance: (params) => api.get('/reports/performance', { params }),
  getStudents: (params) => api.get('/reports/students', { params }),
  getTeachers: (params) => api.get('/reports/teachers', { params }),
  export: (type, params) => api.get(`/reports/${type}/export`, { 
    params,
    responseType: 'blob',
  }),
};

// Dashboard Endpoints
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getTodayLessons: () => api.get('/dashboard/today-lessons'),
  getActivities: () => api.get('/dashboard/activities'),
  getPendingQuestions: () => api.get('/dashboard/pending-questions'),
};

// Settings/Config Endpoints
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  testConnection: (url) => api.post('/settings/test-connection', { url }),
};
