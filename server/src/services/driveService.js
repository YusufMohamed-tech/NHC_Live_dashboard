const { google } = require('googleapis')
const stream = require('stream')
const logger = require('../utils/logger')

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  // Alternative: support base64 JSON via GOOGLE_SERVICE_ACCOUNT_JSON_B64
  const jsonB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
  if (jsonB64 && (!clientEmail || !privateKey)) {
    try {
      const decoded = Buffer.from(jsonB64, 'base64').toString('utf8')
      const parsed = JSON.parse(decoded)
      if (parsed.client_email && parsed.private_key) {
        return new google.auth.JWT(parsed.client_email, null, parsed.private_key, ['https://www.googleapis.com/auth/drive'])
      }
    } catch (e) {
      logger.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON_B64', e.message)
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google service account credentials')
  }

  // privateKey in env may have literal "\\n" sequences; convert them
  privateKey = privateKey.replace(/\\n/g, '\n')

  return new google.auth.JWT(clientEmail, null, privateKey, ['https://www.googleapis.com/auth/drive'])
}

async function uploadFile({ fileBuffer, mimeType, fileName, folderId, retries = 3 }) {
  const auth = getAuthClient()
  // authorize to make sure credentials are valid
  await auth.authorize()
  const drive = google.drive({ version: 'v3', auth })

  let attempt = 0
  while (attempt < retries) {
    try {
      const bufferStream = new stream.PassThrough()
      bufferStream.end(fileBuffer)

      const res = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: folderId ? [folderId] : undefined
        },
        media: {
          mimeType,
          body: bufferStream
        },
        fields: 'id, webViewLink'
      })

      const fileId = res.data.id

      // make it viewable by anyone with the link
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      })

      const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`
      return { fileId, previewUrl }
    } catch (err) {
      attempt += 1
      logger.warn(`Drive upload attempt ${attempt} failed: ${err.message}`)
      if (attempt >= retries) {
        logger.error('Drive upload failed after retries')
        throw err
      }
      const backoffMs = Math.min(30000, Math.pow(2, attempt) * 1000)
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
}

module.exports = { uploadFile }
