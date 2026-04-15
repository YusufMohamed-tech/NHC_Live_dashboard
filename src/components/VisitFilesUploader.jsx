import {
  FileImage,
  FileVideo,
  LoaderCircle,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  buildVisitStoragePath,
  getDisplayFileName,
  getFilePointsFromFile,
  getFilePointsFromPath,
  isImagePath,
  isVideoPath,
  normalizeVisitFileUrls,
  validateVisitFile,
  visitFileRules,
} from '../utils/visitFiles'

const VISIT_FILES_BUCKET = 'visit-files'
const SHOW_POINTS_SECTION = import.meta.env.DEV

function Toast({ type, message }) {
  if (!message) return null

  const styles =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-rose-200 bg-rose-50 text-rose-700'

  return (
    <div className="fixed end-4 top-4 z-50">
      <div className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-lg ${styles}`}>
        {message}
      </div>
    </div>
  )
}

export default function VisitFilesUploader({ visit, onSaveFiles }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState({ type: '', message: '' })
  const [imagePreviewUrls, setImagePreviewUrls] = useState({})

  const filePaths = useMemo(
    () => normalizeVisitFileUrls(visit?.file_urls),
    [visit?.file_urls],
  )

  useEffect(() => {
    let cancelled = false

    async function loadPreviews() {
      const imagePaths = filePaths.filter((path) => isImagePath(path))

      if (imagePaths.length === 0) {
        if (!cancelled) {
          setImagePreviewUrls({})
        }
        return
      }

      const entries = await Promise.all(
        imagePaths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from(VISIT_FILES_BUCKET)
            .createSignedUrl(path, 60 * 60)

          if (error || !data?.signedUrl) {
            return [path, '']
          }

          return [path, data.signedUrl]
        }),
      )

      if (!cancelled) {
        setImagePreviewUrls(Object.fromEntries(entries))
      }
    }

    loadPreviews()

    return () => {
      cancelled = true
    }
  }, [filePaths])

  useEffect(() => {
    if (!toast.message) return undefined

    const timeout = window.setTimeout(() => {
      setToast({ type: '', message: '' })
    }, 2600)

    return () => window.clearTimeout(timeout)
  }, [toast])

  const openFilePicker = () => {
    if (isUploading) return
    inputRef.current?.click()
  }

  const showUploadError = () => {
    setToast({ type: 'error', message: 'فشل رفع الملف، حاول مرة أخرى' })
  }

  const handleUpload = async (fileList) => {
    const selectedFiles = Array.from(fileList ?? [])
    if (!selectedFiles.length || !visit?.id || isUploading) return

    const invalidMessage = selectedFiles.map(validateVisitFile).find(Boolean)
    if (invalidMessage) {
      setToast({ type: 'error', message: invalidMessage })
      return
    }

    setIsUploading(true)
    setUploadProgress(5)

    const uploadedPaths = []
    let pointsDelta = 0

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        const filePath = buildVisitStoragePath(visit.id, file.name)

        setUploadProgress(Math.round((index / selectedFiles.length) * 85) + 10)

        const { error: uploadError } = await supabase.storage
          .from(VISIT_FILES_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })

        if (uploadError) {
          throw uploadError
        }

        uploadedPaths.push(filePath)
        pointsDelta += getFilePointsFromFile(file)
      }

      const nextPaths = [...filePaths, ...uploadedPaths]
      await onSaveFiles({
        visitId: visit.id,
        fileUrls: nextPaths,
        pointsDelta,
      })

      setUploadProgress(100)
      setToast({ type: 'success', message: 'تم رفع الملف بنجاح' })
    } catch {
      if (uploadedPaths.length) {
        await supabase.storage.from(VISIT_FILES_BUCKET).remove(uploadedPaths)
      }

      showUploadError()
    } finally {
      setIsUploading(false)
      window.setTimeout(() => setUploadProgress(0), 350)

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const onDragOver = (event) => {
    event.preventDefault()
    if (!isUploading) {
      setIsDragging(true)
    }
  }

  const onDragLeave = (event) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)

    if (isUploading) return
    handleUpload(event.dataTransfer.files)
  }

  const deleteFile = async (path) => {
    if (isUploading || !visit?.id) return

    setIsUploading(true)
    setUploadProgress(35)

    try {
      const { error: removeError } = await supabase.storage
        .from(VISIT_FILES_BUCKET)
        .remove([path])

      if (removeError) {
        throw removeError
      }

      const nextPaths = filePaths.filter((item) => item !== path)
      await onSaveFiles({
        visitId: visit.id,
        fileUrls: nextPaths,
        pointsDelta: -getFilePointsFromPath(path),
      })

      setUploadProgress(100)
      setToast({ type: 'success', message: 'تم حذف الملف بنجاح' })
    } catch {
      showUploadError()
    } finally {
      setIsUploading(false)
      window.setTimeout(() => setUploadProgress(0), 350)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Toast type={toast.type} message={toast.message} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-black text-slate-900">مرفقات الزيارة</h3>
        {SHOW_POINTS_SECTION && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            نقاط الوسائط: {filePaths.reduce((sum, path) => sum + getFilePointsFromPath(path), 0)}
          </span>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openFilePicker()
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-400'
        }`}
      >
        <UploadCloud className="mx-auto h-10 w-10 text-indigo-500" />
        <p className="mt-3 text-sm font-bold text-slate-800">اسحب الملفات هنا أو انقر للرفع</p>
        <p className="mt-1 text-xs text-slate-500">{visitFileRules.acceptedTypesHint}</p>
        <p className="text-xs text-slate-500">{visitFileRules.maxSizeHint}</p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.mp4,.mov"
          onChange={(event) => handleUpload(event.target.files)}
          className="hidden"
        />
      </div>

      {isUploading && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-indigo-700">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              جاري الرفع...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filePaths.map((path) => {
          const isImage = isImagePath(path)
          const isVideo = isVideoPath(path)
          const displayName = getDisplayFileName(path)
          const points = getFilePointsFromPath(path)

          return (
            <article
              key={path}
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <button
                type="button"
                onClick={() => deleteFile(path)}
                className="absolute end-2 top-2 z-10 rounded-full border border-rose-300 bg-white p-1 text-rose-600 transition hover:bg-rose-50"
                title="حذف الملف"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="h-36 bg-slate-100">
                {isImage ? (
                  imagePreviewUrls[path] ? (
                    <img
                      src={imagePreviewUrls[path]}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <FileImage className="h-8 w-8" />
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                    <FileVideo className="h-8 w-8" />
                    <p className="text-sm font-semibold">ملف فيديو</p>
                  </div>
                )}
              </div>

              <div className="p-3">
                <p className="truncate text-sm font-semibold text-slate-700" title={displayName}>
                  {displayName}
                </p>

                <div className="mt-2 flex items-center justify-between">
                  {SHOW_POINTS_SECTION ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                      +{points} نقطة
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-slate-500">
                    {isImage ? 'صورة' : isVideo ? 'فيديو' : 'ملف'}
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filePaths.length === 0 && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-sm text-slate-500">
          لا توجد ملفات مرفوعة لهذه الزيارة بعد.
        </p>
      )}
    </section>
  )
}
