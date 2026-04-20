Drive-based Call Recording Uploader
=================================

This Express service accepts multipart/form-data audio uploads, stores files in Google Drive (in a configured folder), sets public view permissions, and inserts metadata into a Supabase table.

Quick start
-----------

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
cd server
npm install
```

3. Start server:

```bash
npm start
```

API
---

POST /api/upload-call
- multipart/form-data
- field `file` (or value of `UPLOAD_FIELD_NAME` env) – audio file
- optional field `call_id`

Response:

```json
{ "success": true, "fileId": "...", "url": "https://drive.google.com/file/d/FILE_ID/preview" }
```

Google Drive / Service Account setup
-----------------------------------

1. In Google Cloud Console enable the Google Drive API for your project.
2. Create a Service Account and generate a JSON key.
3. You can either:
   - Set `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env`. Make sure to replace actual newlines in the private key (or escape them as `\\n`).
   - OR set `GOOGLE_SERVICE_ACCOUNT_JSON_B64` to the base64-encoded JSON key and the service will decode it.
4. Create or choose a folder in Google Drive to hold recordings. Copy the folder ID from the URL (the part after `/folders/`).
5. Share that folder with the service account email (the service account must have edit permissions on the folder so it can upload files).

Security notes
--------------
- Never commit service account keys to git. Use environment variables or a secret manager.
- Use the Supabase service-role key only on the server.

Sample curl
-----------

```bash
curl -X POST "http://localhost:3000/api/upload-call" \
  -F "file=@/path/to/recording.mp3" \
  -F "call_id=abc-123"
```
