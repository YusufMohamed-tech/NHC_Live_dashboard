import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (supabaseKey?.startsWith('postgresql://')) {
	console.warn(
		'VITE_SUPABASE_ANON_KEY يجب أن يكون anon public key وليس رابط اتصال PostgreSQL.',
	)
}

export const supabase = createClient(supabaseUrl, supabaseKey)
