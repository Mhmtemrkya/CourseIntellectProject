import { api } from './client';
import type {
  CreateMeetingRequestRequest,
  MeetingAvailabilityCreateRequest,
  MeetingRequestDto,
} from '../../types/api/generated';

export interface MeetingRequestQuery {
  advisor?: string | null;
  parentName?: string | null;
}

export interface AdvisorQuery {
  advisor?: string | null;
  teacherName?: string | null;
}

export interface MeetingSlot {
  slot: string;
  advisor: string;
  onlineMeeting: boolean;
}

export interface MeetingAvailabilitySlot {
  id: string;
  advisor: string;
  slot: string;
  onlineMeeting: boolean;
  createdAtUtc: string;
}

export async function fetchMeetingRequests(params?: MeetingRequestQuery): Promise<MeetingRequestDto[] | null> {
  const response = await api.get<MeetingRequestDto[]>('/api/meetingrequests', {
    params,
  });
  return response;
}

export async function createMeetingRequest(payload: CreateMeetingRequestRequest): Promise<MeetingRequestDto | null> {
  const response = await api.post<MeetingRequestDto>('/api/meetingrequests', payload);
  return response;
}

export async function fetchMeetingSlots(params?: AdvisorQuery & { onlineMeeting?: boolean }): Promise<MeetingSlot[] | null> {
  const response = await api.get<MeetingSlot[]>('/api/meetingrequests/slots', {
    params,
  });
  return response;
}

export async function fetchMeetingAvailability(params?: AdvisorQuery): Promise<MeetingAvailabilitySlot[] | null> {
  const response = await api.get<MeetingAvailabilitySlot[]>('/api/meetingrequests/availability', {
    params,
  });
  return response;
}

export async function fetchMeetingAdvisors(): Promise<string[] | null> {
  const response = await api.get<string[]>('/api/meetingrequests/advisors');
  return response;
}

export async function createMeetingAvailability(payload: MeetingAvailabilityCreateRequest): Promise<MeetingAvailabilitySlot | null> {
  const response = await api.post<MeetingAvailabilitySlot>('/api/meetingrequests/availability', payload);
  return response;
}

export async function deleteMeetingAvailability(id: string): Promise<{ success: boolean; id: string } | null> {
  const response = await api.delete<{ success: boolean; id: string }>(`/api/meetingrequests/availability/${id}`);
  return response;
}

export async function updateMeetingRequestStatus(
  id: string,
  status: string,
  meetingLink: string | null = null,
): Promise<MeetingRequestDto | null> {
  const response = await api.put<MeetingRequestDto>(`/api/meetingrequests/${id}/status`, { status, meetingLink });
  return response;
}
