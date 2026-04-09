const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const VIDEO_EXTENSIONS = ['mp4', 'mov']

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime']

function getExtension(value) {
  const parts = String(value ?? '').split('.')
  return parts.length > 1 ? parts.at(-1).toLowerCase() : ''
}

function sanitizeFileName(fileName) {
  return String(fileName ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '')
}

function normalizeStoredEntry(entry) {
  if (typeof entry === 'string') {
    return entry
  }

  if (entry && typeof entry === 'object') {
    if (typeof entry.path === 'string') return entry.path
    if (typeof entry.url === 'string') return entry.url
  }

  return ''
}

export function normalizeVisitFileUrls(fileUrls) {
  if (!Array.isArray(fileUrls)) return []

  return fileUrls
    .map(normalizeStoredEntry)
    .filter(Boolean)
}

export function isImagePath(path) {
  const extension = getExtension(path)
  return IMAGE_EXTENSIONS.includes(extension)
}

export function isVideoPath(path) {
  const extension = getExtension(path)
  return VIDEO_EXTENSIONS.includes(extension)
}

export function getFilePointsFromPath(path) {
  if (isImagePath(path)) return 5
  if (isVideoPath(path)) return 10
  return 0
}

export function getFilePointsFromFile(file) {
  const type = String(file?.type ?? '')
  const extension = getExtension(file?.name)

  if (IMAGE_MIME_TYPES.includes(type) || IMAGE_EXTENSIONS.includes(extension)) {
    return 5
  }

  if (VIDEO_MIME_TYPES.includes(type) || VIDEO_EXTENSIONS.includes(extension)) {
    return 10
  }

  return 0
}

export function validateVisitFile(file) {
  const extension = getExtension(file?.name)
  const mimeType = String(file?.type ?? '')
  const isImage = IMAGE_MIME_TYPES.includes(mimeType) || IMAGE_EXTENSIONS.includes(extension)
  const isVideo = VIDEO_MIME_TYPES.includes(mimeType) || VIDEO_EXTENSIONS.includes(extension)

  if (!isImage && !isVideo) {
    return 'نوع الملف غير مدعوم. الرجاء رفع JPG, PNG, WEBP, MP4, MOV فقط.'
  }

  if (Number(file?.size ?? 0) > MAX_FILE_SIZE_BYTES) {
    return 'الحجم الأقصى: 50MB لكل ملف.'
  }

  return ''
}

export function getDisplayFileName(path) {
  const rawName = String(path ?? '').split('/').at(-1) ?? ''
  const underscoreIndex = rawName.indexOf('_')
  const cleaned = underscoreIndex > -1 ? rawName.slice(underscoreIndex + 1) : rawName
  return decodeURIComponent(cleaned)
}

export function buildVisitStoragePath(visitId, fileName) {
  const safeName = sanitizeFileName(fileName)
  const timestamp = Date.now()
  return `visits/${visitId}/${timestamp}_${safeName}`
}

export const visitFileRules = {
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  acceptedTypesHint: 'الصور: JPG, PNG, WEBP | الفيديو: MP4, MOV',
  maxSizeHint: 'الحجم الأقصى: 50MB لكل ملف',
}
