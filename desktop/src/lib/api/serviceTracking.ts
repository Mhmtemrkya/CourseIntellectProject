import { api } from './client';
import type {
  AdminServiceLiveTripDto,
  AssignedStudentResponse,
  CreateServiceAbsenceRequestRequest,
  CreateServiceDriverRequest,
  CreateServiceRouteRequest,
  CreateServiceRouteStopRequest,
  CreateServiceVehicleRequest,
  CreateStudentServiceAssignmentRequest,
  DriverRouteStudentDto,
  DriverTodayRouteDto,
  MarkServiceAttendanceRequest,
  ParentServiceStatusDto,
  ReorderStopItemRequest,
  ServiceAbsenceRequestDto,
  ServiceDriverDto,
  ServiceDriverSelfDto,
  ServiceRouteDetailResponse,
  ServiceRouteListDto,
  ServiceRouteStopDto,
  ServiceStudentSearchResultDto,
  ServiceTripDto,
  ServiceVehicleDto,
  UpdateServiceDriverRequest,
  UpdateServiceRouteStopRequest,
  UpdateServiceVehicleRequest,
} from '../../types/api/generated';

// --- Service Tracking ---

export async function fetchServiceVehicles(): Promise<ServiceVehicleDto[]> {
  const response = await api.get<ServiceVehicleDto[]>('/api/service/vehicles');
  return Array.isArray(response) ? response : [];
}

export async function createServiceVehicle(payload: CreateServiceVehicleRequest): Promise<ServiceVehicleDto | null> {
  return await api.post<ServiceVehicleDto>('/api/service/vehicles', payload);
}

export async function updateServiceVehicle(id: string, payload: UpdateServiceVehicleRequest): Promise<ServiceVehicleDto | null> {
  return await api.put<ServiceVehicleDto>(`/api/service/vehicles/${id}`, payload);
}

export async function deleteServiceVehicle(id: string): Promise<void> {
  await api.delete(`/api/service/vehicles/${id}`);
}

export async function fetchServiceDrivers(): Promise<ServiceDriverDto[]> {
  const response = await api.get<ServiceDriverDto[]>('/api/service/drivers');
  return Array.isArray(response) ? response : [];
}

export async function createServiceDriver(payload: CreateServiceDriverRequest): Promise<ServiceDriverDto | null> {
  return await api.post<ServiceDriverDto>('/api/service/drivers', payload);
}

export async function updateServiceDriver(id: string, payload: UpdateServiceDriverRequest): Promise<ServiceDriverDto | null> {
  return await api.put<ServiceDriverDto>(`/api/service/drivers/${id}`, payload);
}

export async function deleteServiceDriver(id: string): Promise<void> {
  await api.delete(`/api/service/drivers/${id}`);
}

export interface ServiceRouteQuery {
  isActive?: boolean | null;
  routeType?: string | null;
}

export async function fetchServiceRoutes(params: ServiceRouteQuery = {}): Promise<ServiceRouteListDto[]> {
  const response = await api.get<ServiceRouteListDto[]>('/api/service/routes', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function fetchServiceRouteDetail(id: string): Promise<ServiceRouteDetailResponse | null> {
  return await api.get<ServiceRouteDetailResponse>(`/api/service/routes/${id}`);
}

export async function fetchServiceAssignments(): Promise<AssignedStudentResponse[]> {
  const response = await api.get<AssignedStudentResponse[]>('/api/service/assignments');
  return Array.isArray(response) ? response : [];
}

/** Saat alanları "HH:mm" girilse de sunucuya "HH:mm:ss" (TimeSpan) gider. */
type ServiceRouteInput = Omit<CreateServiceRouteRequest, 'startTime' | 'endTime'> & {
  startTime?: string | null;
  endTime?: string | null;
};

export async function createServiceRoute(payload: ServiceRouteInput): Promise<ServiceRouteDetailResponse | null> {
  return await api.post<ServiceRouteDetailResponse>('/api/service/routes', {
    ...payload,
    startTime: normalizeServiceTime(payload.startTime),
    endTime: normalizeServiceTime(payload.endTime),
  });
}

export async function setServiceRouteActive(id: string, active: boolean): Promise<ServiceRouteDetailResponse | null> {
  return await api.patch<ServiceRouteDetailResponse>(`/api/service/routes/${id}/${active ? 'activate' : 'deactivate'}`);
}

function normalizeServiceTime(value: unknown): string {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
}

export async function createServiceRouteStop(routeId: string, payload: CreateServiceRouteStopRequest): Promise<ServiceRouteStopDto | null> {
  return await api.post<ServiceRouteStopDto>(`/api/service/routes/${routeId}/stops`, payload);
}

export async function updateServiceRouteStop(stopId: string, payload: UpdateServiceRouteStopRequest): Promise<ServiceRouteStopDto | null> {
  return await api.put<ServiceRouteStopDto>(`/api/service/stops/${stopId}`, payload);
}

export async function deleteServiceRouteStop(stopId: string): Promise<void> {
  await api.delete(`/api/service/stops/${stopId}`);
}

export async function reorderServiceRouteStops(routeId: string, stops: ReorderStopItemRequest[]): Promise<ServiceRouteStopDto[] | null> {
  return await api.put<ServiceRouteStopDto[]>(`/api/service/routes/${routeId}/stops/reorder`, { stops });
}

export async function searchServiceStudents(keyword?: string | null): Promise<ServiceStudentSearchResultDto[]> {
  const response = await api.get<ServiceStudentSearchResultDto[]>('/api/service/students/search', {
    params: { keyword: keyword || '' },
  });
  return Array.isArray(response) ? response : [];
}

export async function assignServiceStudent(payload: CreateStudentServiceAssignmentRequest): Promise<AssignedStudentResponse | null> {
  return await api.post<AssignedStudentResponse>('/api/service/assignments', payload);
}

export async function deleteServiceAssignment(id: string): Promise<void> {
  await api.delete(`/api/service/assignments/${id}`);
}

export async function fetchServiceDriverSelf(): Promise<ServiceDriverSelfDto | null> {
  return await api.get<ServiceDriverSelfDto>('/api/service/driver/me');
}

export async function arrivedSchoolRoute(tripId: string): Promise<ServiceTripDto | null> {
  return await api.post<ServiceTripDto>(`/api/service/trips/${tripId}/arrived-school`);
}

export async function getDriverTodayRoute(): Promise<DriverTodayRouteDto[]> {
  const response = await api.get<DriverTodayRouteDto[]>('/api/service/driver/today-routes');
  return Array.isArray(response) ? response : [];
}

export async function getDriverStudentPickupList(routeId: string): Promise<DriverRouteStudentDto[]> {
  const response = await api.get<DriverRouteStudentDto[]>(`/api/service/driver/routes/${routeId}/students`);
  return Array.isArray(response) ? response : [];
}

export async function startRoute(routeId: string): Promise<ServiceTripDto | null> {
  return await api.post<ServiceTripDto>('/api/service/trips/start', { routeId });
}

export async function updateStudentBoardingStatus(
  { tripId, studentId, status }: Pick<MarkServiceAttendanceRequest, 'tripId' | 'studentId' | 'status'>,
): Promise<DriverRouteStudentDto | null> {
  return await api.post<DriverRouteStudentDto>('/api/service/attendance/mark', { tripId, studentId, status });
}

export async function completeRoute(tripId: string): Promise<ServiceTripDto | null> {
  return await api.post<ServiceTripDto>(`/api/service/trips/${tripId}/completed`);
}

export async function getStudentTransportStatus(): Promise<ParentServiceStatusDto[]> {
  const response = await api.get<ParentServiceStatusDto[]>('/api/service/student/live-status');
  return Array.isArray(response) ? response : [];
}

export async function getParentChildrenTransportStatus(): Promise<ParentServiceStatusDto[]> {
  const response = await api.get<ParentServiceStatusDto[]>('/api/service/parent/live-status');
  return Array.isArray(response) ? response : [];
}

export async function notifyStudentAbsentToday(payload: CreateServiceAbsenceRequestRequest): Promise<ServiceAbsenceRequestDto | null> {
  return await api.post<ServiceAbsenceRequestDto>('/api/service/parent/absence-request', payload);
}

export async function getLiveVehicleLocations(): Promise<AdminServiceLiveTripDto[]> {
  const response = await api.get<AdminServiceLiveTripDto[]>('/api/service/admin/live-status');
  return Array.isArray(response) ? response : [];
}
