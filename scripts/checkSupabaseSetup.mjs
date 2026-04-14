const projectRef = process.env.SUPABASE_PROJECT_REF
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!projectRef || !accessToken) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

const query = `
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='offices') as offices_table,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='evaluation_criteria') as criteria_table,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='points_rules') as points_table,
  (select count(*) from public.evaluation_criteria) as criteria_rows,
  (select count(*) from public.points_rules) as points_rows;
`

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
})

const text = await response.text()

if (!response.ok) {
  console.error(text)
  process.exit(1)
}

console.log(text)
