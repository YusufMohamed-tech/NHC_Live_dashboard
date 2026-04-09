import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envLines = fs
  .readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))

const env = {}

for (const line of envLines) {
  const index = line.indexOf('=')
  if (index > 0) {
    const key = line.slice(0, index)
    const value = line.slice(index + 1)
    env[key] = value
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const shoppersRes = await supabase
  .from('shoppers')
  .select('id,name,email,status,visits_completed,points', { count: 'exact' })

const visitsRes = await supabase
  .from('visits')
  .select('id,shopper_id,status,membership_id', { count: 'exact' })

const issuesRes = await supabase
  .from('issues')
  .select('id', { count: 'exact' })

const shoppersData = Array.isArray(shoppersRes.data) ? shoppersRes.data : []
const visitsData = Array.isArray(visitsRes.data) ? visitsRes.data : []

const shopper = shoppersData.find((item) => item.email === 'shopper@nhc.sa')
const shopperVisits = shopper
  ? visitsData.filter((visit) => visit.shopper_id === shopper.id)
  : []
const shopperRowsByEmail = shoppersData.filter(
  (item) => item.email === 'shopper@nhc.sa',
)
const shopperIdsByEmail = shopperRowsByEmail.map((item) => item.id)
const shopperVisitsAllRows = visitsData.filter((visit) =>
  shopperIdsByEmail.includes(visit.shopper_id),
)

console.log(
  JSON.stringify(
    {
      shoppersCount: shoppersRes.count,
      visitsCount: visitsRes.count,
      issuesCount: issuesRes.count,
      shopperFound: Boolean(shopper),
      shopperId: shopper ? shopper.id : null,
      shopperVisitsCount: shopperVisits.length,
      duplicateShopperRowsForEmail: shopperRowsByEmail.length,
      shopperVisitsAcrossDuplicateRows: shopperVisitsAllRows.length,
      shoppersError: shoppersRes.error ? shoppersRes.error.message : null,
      visitsError: visitsRes.error ? visitsRes.error.message : null,
      issuesError: issuesRes.error ? issuesRes.error.message : null,
    },
    null,
    2,
  ),
)
