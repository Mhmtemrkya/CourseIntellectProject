import { api } from './client';
import type {
  ContentCommentDto,
  ContentDto,
  ContentEngagementResponse,
  ContentExtrasState,
  ContentUserState,
  CreateContentRequest,
  MyContentStateDto,
  SaveContentExtrasRequest,
  SaveContentUserStateRequest,
} from '../../types/api/generated';

export async function fetchContents(visibleOnly?: boolean): Promise<ContentDto[] | null> {
  const response = await api.get<ContentDto[]>('/api/contents', {
    params: { visibleOnly },
  });
  return response;
}

export async function createContent(payload: CreateContentRequest): Promise<ContentDto | null> {
  const response = await api.post<ContentDto>('/api/contents', payload);
  return response;
}

export async function deleteContent(id: string): Promise<void> {
  await api.delete(`/api/contents/${id}`);
}

export async function updateContentStatus(id: string, publishStatus: string): Promise<ContentDto | null> {
  const response = await api.put<ContentDto>(`/api/contents/${id}/status`, { publishStatus });
  return response;
}

export async function fetchMyContentEngagement(): Promise<MyContentStateDto[] | null> {
  return await api.get<MyContentStateDto[]>('/api/contents/my-engagement');
}

export async function fetchContentEngagement(contentId: string | null | undefined): Promise<ContentEngagementResponse | null> {
  if (!contentId) return null;
  return await api.get<ContentEngagementResponse>(`/api/contents/${contentId}/engagement`);
}

export async function saveContentUserState(contentId: string, payload: SaveContentUserStateRequest): Promise<ContentUserState | null> {
  return await api.put<ContentUserState>(`/api/contents/${contentId}/engagement/state`, payload);
}

export async function saveContentExtras(contentId: string, payload: SaveContentExtrasRequest): Promise<ContentExtrasState | null> {
  return await api.put<ContentExtrasState>(`/api/contents/${contentId}/engagement/extras`, payload);
}

export async function addContentComment(contentId: string, message: string): Promise<ContentCommentDto[] | null> {
  return await api.post<ContentCommentDto[]>(`/api/contents/${contentId}/engagement/comments`, { message });
}
