const express = require('express')
const uploadRouter = require('./routes/upload')
const logger = require('./utils/logger')

const app = express()

app.use(express.json())
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`)
  next()
})

app.use('/api', uploadRouter)

// error handler
app.use((err, req, res, next) => {
  logger.error(err && err.message ? err.message : err)
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large' })
  }
  res.status(err && err.status ? err.status : 500).json({ success: false, error: err && err.message ? err.message : 'Internal Server Error' })
})

module.exports = app
