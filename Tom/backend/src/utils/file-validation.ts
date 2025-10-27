import { createReadStream } from 'fs';
import { fileTypeFromStream } from 'file-type';

/**
 * Valida o tipo MIME real de um arquivo (não apenas a extensão)
 * Previne ataques de upload de arquivos maliciosos com extensão falsa
 */
export async function validateFileType(
  filePath: string,
  allowedMimeTypes: string[]
): Promise<{ isValid: boolean; detectedType?: string; error?: string }> {
  try {
    const stream = createReadStream(filePath);
    const fileType = await fileTypeFromStream(stream);
    stream.destroy();

    if (!fileType) {
      return {
        isValid: false,
        error: 'Could not determine file type',
      };
    }

    const isValid = allowedMimeTypes.includes(fileType.mime);

    return {
      isValid,
      detectedType: fileType.mime,
      error: isValid ? undefined : `File type ${fileType.mime} is not allowed`,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Valida tamanho do arquivo
 */
export function validateFileSize(
  fileSize: number,
  maxSize: number
): { isValid: boolean; error?: string } {
  if (fileSize > maxSize) {
    return {
      isValid: false,
      error: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitiza nome de arquivo para prevenir path traversal
 */
export function sanitizeFileName(fileName: string): string {
  // Remove caracteres perigosos e path separators
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+/, '')
    .substring(0, 255); // Limite de nome de arquivo
}

/**
 * Tipos MIME seguros para cada categoria
 */
export const SAFE_MIME_TYPES = {
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  videos: [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
  ],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ],
  audio: [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
  ],
};

/**
 * Obtém todos os tipos MIME permitidos
 */
export function getAllowedMimeTypes(): string[] {
  return [
    ...SAFE_MIME_TYPES.images,
    ...SAFE_MIME_TYPES.videos,
    ...SAFE_MIME_TYPES.documents,
    ...SAFE_MIME_TYPES.audio,
  ];
}
