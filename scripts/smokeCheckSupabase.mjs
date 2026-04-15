import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const stamp = Date.now()
const suffix = `smoke-${stamp}`

const created = {
  adminId: null,
  shopperId: null,
  visitId: null,
  issueId: null,
}

async function run() {
  const adminEmail = `admin-${suffix}@nhc.sa`
  const shopperEmail = `shopper-${suffix}@nhc.sa`

  const { data: admin, error: adminInsertError } = await supabase
    .from('admins')
    .insert([
      {
        name: `Smoke Admin ${suffix}`,
        email: adminEmail,
        password: 'smoke123',
        city: 'Riyadh',
        status: 'active',
        role: 'admin',
        assigned_shopper_ids: [],
      },
    ])
    .select('*')
    .single()

  if (adminInsertError || !admin) throw adminInsertError ?? new Error('admin insert failed')
  created.adminId = admin.id
  console.log('OK: admin create')

  const { error: adminUpdateError } = await supabase
    .from('admins')
    .update({ city: 'Jeddah' })
    .eq('id', admin.id)

  if (adminUpdateError) throw adminUpdateError
  console.log('OK: admin update')

  const { data: shopper, error: shopperInsertError } = await supabase
    .from('shoppers')
    .insert([
      {
        name: `Smoke Shopper ${suffix}`,
        email: shopperEmail,
        password: 'smoke123',
        city: 'Riyadh',
        status: 'active',
        points: 0,
        visits_completed: 0,
        assigned_admin_id: admin.id,
      },
    ])
    .select('*')
    .single()

  if (shopperInsertError || !shopper) throw shopperInsertError ?? new Error('shopper insert failed')
  created.shopperId = shopper.id
  console.log('OK: shopper create')

  const { error: shopperUpdateError } = await supabase
    .from('shoppers')
    .update({ city: 'Dammam' })
    .eq('id', shopper.id)

  if (shopperUpdateError) throw shopperUpdateError
  console.log('OK: shopper update')

  const initialScores = {
    criterion1: 0,
    criterion2: 0,
    criterion3: 0,
    criterion4: 0,
    criterion5: 0,
    criterion6: 0,
    criterion7: 0,
  }

  const { data: visit, error: visitInsertError } = await supabase
    .from('visits')
    .insert([
      {
        office_name: `Smoke Office ${suffix}`,
        city: 'Riyadh',
        type: 'مكتب مبيعات',
        status: 'معلقة',
        scenario: 'smoke test scenario',
        membership_id: `NHC-${String(stamp).slice(-6)}`,
        shopper_id: shopper.id,
        visit_date: new Date().toISOString(),
        scores: initialScores,
        notes: '',
        points_earned: 0,
      },
    ])
    .select('*')
    .single()

  if (visitInsertError || !visit) throw visitInsertError ?? new Error('visit insert failed')
  created.visitId = visit.id
  console.log('OK: visit create')

  const { error: visitUpdateError } = await supabase
    .from('visits')
    .update({ status: 'قادمة' })
    .eq('id', visit.id)

  if (visitUpdateError) throw visitUpdateError
  console.log('OK: visit update')

  const completedScores = {
    criterion1: 5,
    criterion2: 4,
    criterion3: 4,
    criterion4: 5,
    criterion5: 4,
    criterion6: 5,
    criterion7: 4,
  }

  const completionPoints = 100

  const { error: visitCompleteError } = await supabase
    .from('visits')
    .update({
      status: 'مكتملة',
      scores: completedScores,
      notes: 'smoke completion notes',
      points_earned: completionPoints,
    })
    .eq('id', visit.id)

  if (visitCompleteError) throw visitCompleteError

  const { error: shopperPointsError } = await supabase
    .from('shoppers')
    .update({
      visits_completed: 1,
      points: completionPoints,
    })
    .eq('id', shopper.id)

  if (shopperPointsError) throw shopperPointsError
  console.log('OK: shopper completion points update')

  const { data: issue, error: issueInsertError } = await supabase
    .from('issues')
    .insert([
      {
        visit_id: visit.id,
        severity: 'بسيطة',
        description: 'smoke test issue',
      },
    ])
    .select('*')
    .single()

  if (issueInsertError || !issue) throw issueInsertError ?? new Error('issue insert failed')
  created.issueId = issue.id
  console.log('OK: issue create')

  console.log('Smoke check passed.')
}

async function cleanup() {
  if (created.issueId) {
    await supabase.from('issues').delete().eq('id', created.issueId)
  }

  if (created.visitId) {
    await supabase.from('issues').delete().eq('visit_id', created.visitId)
    await supabase.from('visits').delete().eq('id', created.visitId)
  }

  if (created.shopperId) {
    await supabase.from('shoppers').delete().eq('id', created.shopperId)
  }

  if (created.adminId) {
    await supabase.from('admins').delete().eq('id', created.adminId)
  }
}

try {
  await run()
} catch (error) {
  console.error('Smoke check failed:', error?.message ?? error)
  process.exitCode = 1
} finally {
  await cleanup()
  console.log('Cleanup complete.')
}
