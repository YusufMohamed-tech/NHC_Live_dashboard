const Busboy = require('busboy')
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
    const bb = new Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } })

    const chunks = []
    let fileName = null
    let mimeType = null
    let callId = null
    let fileReceived = false
    let finished = false

    const finishWithError = (err) => {
      if (finished) return
      finished = true
      logger.error('upload-call error', err && err.message ? err.message : err)
      if (!res.headersSent) res.status(err.status || 500).json({ success: false, error: err.message || 'Upload failed' })
    }

    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
      fileName = filename
      mimeType = mimetype

      if (!mimeType || !mimeType.startsWith('audio/')) {
        file.resume()
        bb.destroy(Object.assign(new Error('Invalid file type, only audio allowed'), { status: 400 }))
        return
      }

      file.on('data', (data) => {
        chunks.push(data)
      })

      file.on('limit', () => {
        bb.destroy(Object.assign(new Error('File too large'), { status: 413 }))
      })

      file.on('end', () => {
        fileReceived = true
      })
    })

    bb.on('field', (name, val) => {
      if (name === 'call_id') callId = val
    })

    bb.on('finish', async () => {
      if (finished) return
      if (!fileReceived) return finishWithError(Object.assign(new Error('No file uploaded'), { status: 400 }))

      try {
        const buffer = Buffer.concat(chunks)
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
        if (!folderId) return finishWithError(Object.assign(new Error('Missing GOOGLE_DRIVE_FOLDER_ID'), { status: 500 }))

        const finalFileName = `${callId ? callId + '_' : ''}${Date.now()}_${fileName}`
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

        if (!finished) {
          finished = true
          return res.status(200).json({ success: true, fileId, url: previewUrl, supabase: inserted })
        }
      } catch (err) {
        finishWithError(err)
      }
    })

    bb.on('error', finishWithError)
    req.pipe(bb)
  } catch (err) {
    logger.error('upload-call unexpected error', err && err.message ? err.message : err)
    return res.status(500).json({ success: false, error: err.message || 'Internal error' })
  }
}
