const projectId = process.env.VERCEL_PROJECT_ID
const teamId = process.env.VERCEL_TEAM_ID
const token = process.env.VERCEL_TOKEN

if (!projectId || !teamId || !token) {
  console.error('Missing VERCEL_PROJECT_ID, VERCEL_TEAM_ID, or VERCEL_TOKEN')
  process.exit(1)
}

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPERADMIN_EMAIL',
  'VITE_SUPERADMIN_PASSWORD',
  'VITE_SUPERADMIN_NAME',
]

const values = {}
for (const key of required) {
  const value = process.env[key]
  if (!value) {
    console.error(`Missing ${key}`)
    process.exit(1)
  }
  values[key] = value
}

const base = `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}`
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
}

const listResp = await fetch(base, { headers })
if (!listResp.ok) {
  console.error(await listResp.text())
  process.exit(1)
}

const listData = await listResp.json()
const existing = Array.isArray(listData.envs) ? listData.envs : []

for (const key of required) {
  const toDelete = existing.filter((item) => item.key === key)

  for (const envItem of toDelete) {
    const delUrl = `https://api.vercel.com/v9/projects/${projectId}/env/${envItem.id}?teamId=${teamId}`
    const delResp = await fetch(delUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!delResp.ok) {
      console.error(`Failed deleting existing ${key}`)
      console.error(await delResp.text())
      process.exit(1)
    }
  }

  const payload = {
    key,
    value: values[key],
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  }

  const createResp = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!createResp.ok) {
    console.error(`Failed creating ${key}`)
    console.error(await createResp.text())
    process.exit(1)
  }

  console.log(`Upserted ${key}`)
}

console.log('Vercel environment variables configured successfully.')
