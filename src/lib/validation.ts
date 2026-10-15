export const PLATFORM_EXTENSIONS = [
  'pdf',
  'docx',
  'zip',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'py',
  'ipynb',
  'csv',
  'html',
] as const

export type PlatformExtension = (typeof PLATFORM_EXTENSIONS)[number]

export const PLATFORM_MAX_BYTES = 20 * 1024 * 1024

export const MIME_BY_EXTENSION: Record<PlatformExtension, readonly string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  py: ['text/x-python', 'text/plain', 'text/x-python-script'],
  ipynb: ['application/json', 'application/x-ipynb+json'],
  csv: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  html: ['text/html'],
}

export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? ''
  const withoutNull = base.replaceAll('\0', '')
  let cleaned = withoutNull.replace(/[^A-Za-z0-9._ -]/g, '_')
  cleaned = cleaned.replace(/_+/g, '_').replace(/^[\s.]+|[\s.]+$/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('invalid filename')
  }
  if (cleaned.length > 120) cleaned = cleaned.slice(0, 120).replace(/[\s.]+$/g, '')
  if (!cleaned) throw new Error('invalid filename')
  return cleaned
}

export function canonicalMime(filename: string, browserType: string): string {
  const extension = extensionOf(filename)
  if (!isPlatformExtension(extension)) return browserType
  const allowed = MIME_BY_EXTENSION[extension]
  if (browserType && allowed.includes(browserType)) return browserType
  return allowed[0] ?? browserType
}

export function isPlatformExtension(value: string): value is PlatformExtension {
  return (PLATFORM_EXTENSIONS as readonly string[]).includes(value)
}

export function validateChosenFile(
  file: { name: string; size: number },
  assignment: { allowed_extensions: string[]; max_file_size_bytes: number },
): string | null {
  if (file.size < 1) return 'Choose a non-empty file.'
  if (file.size > assignment.max_file_size_bytes) {
    return `This file is larger than the ${formatBytes(assignment.max_file_size_bytes)} limit.`
  }
  if (file.size > PLATFORM_MAX_BYTES) return 'Files must be 20 MB or smaller.'
  let safeName: string
  try {
    safeName = sanitizeFilename(file.name)
  } catch {
    return 'Rename the file using letters, numbers, dots, spaces, or hyphens.'
  }
  const extension = extensionOf(safeName)
  if (!assignment.allowed_extensions.includes(extension)) {
    return 'This file type is not accepted for this assignment.'
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
