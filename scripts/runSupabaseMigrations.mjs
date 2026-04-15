import fs from 'node:fs/promises'
import path from 'node:path'

const projectRef = process.env.SUPABASE_PROJECT_REF
const accessToken = process.env.SUPABASE_ACCESS_TOKEN
const baseDir = process.cwd()

if (!projectRef || !accessToken) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const files = [
  'supabase/migrations/20260409_add_visit_files.sql',
  'supabase/migrations/20260410_add_global_app_state.sql',
  'supabase/migrations/20260411_finalize_production_schema.sql',
  'supabase/migrations/20260411_storage_and_static_seed.sql',
  'supabase/migrations/20260415_add_shopper_personal_email.sql',
  'supabase/migrations/20260415_connect_ops_and_shopper_phones.sql',
  'supabase/migrations/20260416_remove_visit_attachments.sql',
]

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

for (const relativeFile of files) {
  const fullPath = path.join(baseDir, relativeFile)
  const sql = await fs.readFile(fullPath, 'utf8')

  process.stdout.write(`Applying ${relativeFile}... `)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('FAILED')
    console.error(text)
    process.exit(1)
  }

  process.stdout.write('OK\n')
}

console.log('All migrations applied successfully.')
