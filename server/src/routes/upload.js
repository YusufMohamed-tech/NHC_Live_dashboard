const express = require('express')
const multer = require('multer')
const uploadController = require('../controllers/uploadController')

const router = express.Router()

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10)
const fieldName = process.env.UPLOAD_FIELD_NAME || 'file'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
      return cb(new Error('Invalid file type, only audio files are allowed'))
    }
    cb(null, true)
  }
})

router.post(`/upload-call`, upload.single(fieldName), uploadController.uploadCall)

module.exports = router
