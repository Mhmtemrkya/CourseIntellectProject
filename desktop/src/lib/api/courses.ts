import { api } from './client';
import type { CourseDto, CreateCourseRequest, UpdateCourseRequest } from '../../types/api/generated';

export interface CourseQuery {
  search?: string | null;
  isActive?: boolean | null;
}

export async function fetchCourses(params: CourseQuery = {}): Promise<CourseDto[] | null> {
  const response = await api.get<CourseDto[]>('/api/courses', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return response;
}

export async function createCourse(payload: CreateCourseRequest): Promise<CourseDto | null> {
  const response = await api.post<CourseDto>('/api/courses', payload);
  return response;
}

export async function updateCourse(id: string, payload: UpdateCourseRequest): Promise<CourseDto | null> {
  const response = await api.put<CourseDto>(`/api/courses/${id}`, payload);
  return response;
}

export async function deleteCourse(id: string): Promise<void> {
  await api.delete(`/api/courses/${id}`);
}
