const { createClient } = require('@supabase/supabase-js')
const logger = require('../utils/logger')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_URL_AUTO
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY_AUTO

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase configuration in environment')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function insertRecording({ table = 'call_recordings', callId = null, googleDriveFileId, recordingUrl, createdAt = new Date().toISOString() }) {
  const payload = {
    call_id: callId,
    google_drive_file_id: googleDriveFileId,
    recording_url: recordingUrl,
    created_at: createdAt
  }

  const { data, error } = await supabase.from(table).insert([payload]).select()
  if (error) {
    logger.error('Supabase insert error', error)
    throw error
  }
  return data
}

module.exports = { insertRecording, supabase }
