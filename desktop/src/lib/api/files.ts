import { api } from './client';
import type { UploadedAssetDto } from '../../types/api/generated';

/** /api/uploads/chunk gövdesi (ChunkedFileUploadRequest). */
interface ChunkUploadPayload {
  uploadId: string;
  fileName: string;
  base64Content: string;
  contentType: string;
  folder: string | null | undefined;
  startByte: number;
  totalSize: number;
  chunkIndex: number;
  totalChunks: number;
}

const UPLOAD_CHUNK_BYTES = 512 * 1024;

const UPLOAD_CHUNK_RETRIES = 3;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function canUploadInChunks(file: unknown): file is File {
  return typeof file === 'object' && file !== null
    && 'name' in file && typeof file.name === 'string'
    && 'size' in file && typeof file.size === 'number'
    && 'slice' in file && typeof file.slice === 'function'
    && 'arrayBuffer' in file && typeof file.arrayBuffer === 'function';
}

function createUploadId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.floor(Math.random() * 16) >> (Number(char) / 4))).toString(16)
  );
}

async function uploadFileInChunks(file: File, folder: string | null | undefined): Promise<UploadedAssetDto | null> {
  const uploadId = createUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_BYTES));
  // Ara parçalar { uploadId, received, complete:false } döner; yalnız SON parçanın
  // yanıtı (yüklenen dosya) dışarı verilir.
  let response: UploadedAssetDto | null = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * UPLOAD_CHUNK_BYTES;
    const end = Math.min(file.size, start + UPLOAD_CHUNK_BYTES);
    const chunk = file.slice(start, end);
    const base64Content = arrayBufferToBase64(await chunk.arrayBuffer());

    for (let attempt = 1; attempt <= UPLOAD_CHUNK_RETRIES; attempt += 1) {
      try {
        const payload: ChunkUploadPayload = {
          uploadId,
          fileName: file.name,
          base64Content,
          contentType: file.type || 'application/octet-stream',
          folder,
          startByte: start,
          totalSize: file.size,
          chunkIndex,
          totalChunks,
        };
        response = await api.post<UploadedAssetDto>('/api/uploads/chunk', payload);
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

// --- File Uploads ---

export async function uploadFile(formData: FormData, folder?: string | null): Promise<UploadedAssetDto | null> {
  const file = formData?.get?.('file');
  if (canUploadInChunks(file) && file.size > UPLOAD_CHUNK_BYTES) {
    return uploadFileInChunks(file, folder);
  }

  if (folder && formData?.set) {
    formData.set('folder', folder);
  }
  const response = await api.post<UploadedAssetDto>('/api/uploads', formData, {
    params: folder ? { folder } : undefined,
  });
  return response;
}
