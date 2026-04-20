const driveService = require('../services/driveService')
const supabaseService = require('../services/supabaseService')
const logger = require('../utils/logger')

async function uploadCall(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }

    const callId = req.body.call_id || null

    if (!req.file.mimetype || !req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ success: false, error: 'Invalid file type' })
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) {
      logger.error('Missing GOOGLE_DRIVE_FOLDER_ID env var')
      return res.status(500).json({ success: false, error: 'Server misconfiguration' })
    }

    const originalName = req.file.originalname || `recording-${Date.now()}`
    const fileName = `${callId ? callId + '_' : ''}${Date.now()}_${originalName}`

    logger.info(`Uploading ${fileName} (size=${req.file.size}) to Drive`)

    const { fileId, previewUrl } = await driveService.uploadFile({
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName,
      folderId
    })

    const table = process.env.SUPABASE_RECORDINGS_TABLE || 'call_recordings'
    const inserted = await supabaseService.insertRecording({
      table,
      callId,
      googleDriveFileId: fileId,
      recordingUrl: previewUrl,
      createdAt: new Date().toISOString()
    })

    logger.info('Recording metadata saved', { fileId, callId })

    return res.json({ success: true, fileId, url: previewUrl, supabase: inserted })
  } catch (err) {
    logger.error('uploadCall error', err && err.message ? err.message : err)
    const message = err && err.message ? err.message : 'Upload failed'
    return res.status(500).json({ success: false, error: message })
  }
}

module.exports = { uploadCall }
