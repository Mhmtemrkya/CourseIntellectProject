// Legacy TanStack Query hook katmanı.
// Aktif sayfa kodları çoğunlukla lib/api/modules.js + sayfa içi fetch kullanıyor.
// Bu hook'lar import edilirse de client.js'in direkt body döndürme davranışına
// unwrapApiBody ile uyumlu çalışır; endpoints.js de /api route standardına hizalıdır.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  studentsApi,
  parentsApi,
  teachersApi,
  classesApi,
  scheduleApi,
  attendanceApi,
  contentApi,
  questionsApi,
  examsApi,
  dashboardApi,
  reportsApi,
} from '../lib/api/endpoints';

const unwrapApiBody = (response) => (response && Object.prototype.hasOwnProperty.call(response, 'data') ? response.data : response);

// Query Keys
export const queryKeys = {
  students: ['students'],
  student: (id) => ['students', id],
  parents: ['parents'],
  parent: (id) => ['parents', id],
  teachers: ['teachers'],
  teacher: (id) => ['teachers', id],
  classes: ['classes'],
  class: (id) => ['classes', id],
  schedule: ['schedule'],
  scheduleByClass: (classId) => ['schedule', 'class', classId],
  attendance: ['attendance'],
  content: ['content'],
  questions: ['questions'],
  exams: ['exams'],
  dashboard: ['dashboard'],
  reports: ['reports'],
};

// ============ STUDENTS ============
export const useStudents = (params) => {
  return useQuery({
    queryKey: [...queryKeys.students, params],
    queryFn: () => studentsApi.getAll(params).then(unwrapApiBody),
  });
};

export const useStudent = (id) => {
  return useQuery({
    queryKey: queryKeys.student(id),
    queryFn: () => studentsApi.getById(id).then(unwrapApiBody),
    enabled: !!id,
  });
};

export const useCreateStudent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => studentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students });
    },
  });
};

export const useUpdateStudent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => studentsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students });
      queryClient.invalidateQueries({ queryKey: queryKeys.student(id) });
    },
  });
};

export const useDeleteStudent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students });
    },
  });
};

// ============ PARENTS ============
export const useParents = (params) => {
  return useQuery({
    queryKey: [...queryKeys.parents, params],
    queryFn: () => parentsApi.getAll(params).then(unwrapApiBody),
  });
};

export const useParent = (id) => {
  return useQuery({
    queryKey: queryKeys.parent(id),
    queryFn: () => parentsApi.getById(id).then(unwrapApiBody),
    enabled: !!id,
  });
};

export const useCreateParent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => parentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parents });
    },
  });
};

// ============ TEACHERS ============
export const useTeachers = (params) => {
  return useQuery({
    queryKey: [...queryKeys.teachers, params],
    queryFn: () => teachersApi.getAll(params).then(unwrapApiBody),
  });
};

export const useTeacher = (id) => {
  return useQuery({
    queryKey: queryKeys.teacher(id),
    queryFn: () => teachersApi.getById(id).then(unwrapApiBody),
    enabled: !!id,
  });
};

export const useCreateTeacher = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => teachersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers });
    },
  });
};

// ============ CLASSES ============
export const useClasses = (params) => {
  return useQuery({
    queryKey: [...queryKeys.classes, params],
    queryFn: () => classesApi.getAll(params).then(unwrapApiBody),
  });
};

export const useClass = (id) => {
  return useQuery({
    queryKey: queryKeys.class(id),
    queryFn: () => classesApi.getById(id).then(unwrapApiBody),
    enabled: !!id,
  });
};

export const useCreateClass = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => classesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.classes });
    },
  });
};

// ============ SCHEDULE ============
export const useScheduleByClass = (classId, params) => {
  return useQuery({
    queryKey: [...queryKeys.scheduleByClass(classId), params],
    queryFn: () => scheduleApi.getByClass(classId, params).then(unwrapApiBody),
    enabled: !!classId,
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => scheduleApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule });
    },
  });
};

// ============ ATTENDANCE ============
export const useAttendanceByLesson = (lessonId) => {
  return useQuery({
    queryKey: [...queryKeys.attendance, lessonId],
    queryFn: () => attendanceApi.getByLesson(lessonId).then(unwrapApiBody),
    enabled: !!lessonId,
  });
};

export const useSubmitAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, data }) => attendanceApi.submit(lessonId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance });
    },
  });
};

// ============ CONTENT ============
export const useContent = (params) => {
  return useQuery({
    queryKey: [...queryKeys.content, params],
    queryFn: () => contentApi.getAll(params).then(unwrapApiBody),
  });
};

export const useCreateContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => contentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content });
    },
  });
};

// ============ QUESTIONS ============
export const useQuestions = (params) => {
  return useQuery({
    queryKey: [...queryKeys.questions, params],
    queryFn: () => questionsApi.getAll(params).then(unwrapApiBody),
  });
};

export const useAnswerQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }) => questionsApi.answer(id, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
    },
  });
};

// ============ EXAMS ============
export const useExams = (params) => {
  return useQuery({
    queryKey: [...queryKeys.exams, params],
    queryFn: () => examsApi.getAll(params).then(unwrapApiBody),
  });
};

export const useCreateExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => examsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exams });
    },
  });
};

// ============ DASHBOARD ============
export const useDashboardStats = () => {
  return useQuery({
    queryKey: [...queryKeys.dashboard, 'stats'],
    queryFn: () => dashboardApi.getStats().then(unwrapApiBody),
    staleTime: 30000, // 30 seconds
  });
};

export const useTodayLessons = () => {
  return useQuery({
    queryKey: [...queryKeys.dashboard, 'today-lessons'],
    queryFn: () => dashboardApi.getTodayLessons().then(unwrapApiBody),
    staleTime: 60000, // 1 minute
  });
};

export const useActivities = () => {
  return useQuery({
    queryKey: [...queryKeys.dashboard, 'activities'],
    queryFn: () => dashboardApi.getActivities().then(unwrapApiBody),
  });
};

// ============ REPORTS ============
export const useAttendanceReport = (params) => {
  return useQuery({
    queryKey: [...queryKeys.reports, 'attendance', params],
    queryFn: () => reportsApi.getAttendance(params).then(unwrapApiBody),
  });
};

export const usePerformanceReport = (params) => {
  return useQuery({
    queryKey: [...queryKeys.reports, 'performance', params],
    queryFn: () => reportsApi.getPerformance(params).then(unwrapApiBody),
  });
};
