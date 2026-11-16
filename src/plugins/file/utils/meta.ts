const MIME_EXTENSIONS: Record<string, string> = {
  'application/gzip': 'gz',
  'application/json': 'json',
  'application/msword': 'doc',
  'application/pdf': 'pdf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/x-tar': 'tar',
  'application/xml': 'xml',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const MAX_EXTENSION_LENGTH = 10;

export function getFileExtension(name?: string): string | undefined {
  if (!name) return undefined;
  const index = name.lastIndexOf('.');
  if (index <= 0 || index === name.length - 1) return undefined;
  const ext = name.slice(index + 1).toLowerCase();
  if (ext.length > MAX_EXTENSION_LENGTH || !/^[\da-z]+$/.test(ext)) return undefined;
  return ext;
}

export function getExtensionFromMimeType(mimeType?: string): string | undefined {
  if (!mimeType) return undefined;
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_EXTENSIONS[normalized];
}

export function getFileIconName(file: { ext?: string; mimeType?: string; name: string }): string {
  if (getFileExtension(file.name)) return file.name;
  const ext = file.ext || getExtensionFromMimeType(file.mimeType);
  return ext ? `${file.name}.${ext}` : file.name;
}
