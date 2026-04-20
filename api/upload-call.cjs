const fs = require('fs')
let formidablePkg
try {
  formidablePkg = require('formidable')
} catch (e) {
  formidablePkg = null
}
function makeFormidable(opts) {
  if (!formidablePkg) throw new Error('formidable module not available')
  const Ctor = formidablePkg.IncomingForm || formidablePkg.Formidable || formidablePkg
  try { return new Ctor(opts) } catch (e) { return Ctor(opts) }
}

const driveService = require('../server/src/services/driveService')
const supabaseService = require('../server/src/services/supabaseService')
const logger = require('../server/src/utils/logger')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ success: false, error: 'Expected multipart/form-data' })
  }

  const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10)

  try {
    const form = makeFormidable({ keepExtensions: true, maxFileSize: MAX_FILE_SIZE })
    const parsed = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err)
        resolve({ fields, files })
      })
    })

    const { fields, files } = parsed
    const callId = fields && (fields.call_id || fields.callId || fields.call) || null

    // Find uploaded file (support several field names)
    let fileObj = (files && (files.file || files.file_upload || files.upload)) || null
    if (!fileObj && files) {
      const vals = Object.values(files)
      if (vals.length > 0) fileObj = vals[0]
    }

    if (!fileObj) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }

    // formidable may return array for same field
    if (Array.isArray(fileObj)) fileObj = fileObj[0]

    const filePath = fileObj.filepath || fileObj.path || fileObj.file
    const mimeType = fileObj.mimetype || fileObj.type || fileObj.mime || 'application/octet-stream'
    const originalFilename = fileObj.originalFilename || fileObj.name || fileObj.filename || 'upload'

    const buffer = await fs.promises.readFile(filePath)

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID_AUTO
    if (!folderId) return res.status(500).json({ success: false, error: 'Missing GOOGLE_DRIVE_FOLDER_ID' })

    const finalFileName = `${callId ? callId + '_' : ''}${Date.now()}_${originalFilename}`
    logger.info(`Uploading ${finalFileName} (${buffer.length} bytes) to Drive`)

    const { fileId, previewUrl } = await driveService.uploadFile({
      fileBuffer: buffer,
      mimeType,
      fileName: finalFileName,
      folderId
    })

    const inserted = await supabaseService.insertRecording({
      table: process.env.SUPABASE_RECORDINGS_TABLE || 'call_recordings',
      callId,
      googleDriveFileId: fileId,
      recordingUrl: previewUrl,
      createdAt: new Date().toISOString()
    })

    return res.status(200).json({ success: true, fileId, url: previewUrl, supabase: inserted })
  } catch (err) {
    logger.error('upload-call unexpected error', err && err.message ? err.message : err)
    return res.status(err.status || 500).json({ success: false, error: err.message || 'Internal error' })
  }
}
