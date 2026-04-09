import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackKey = 'public-anon-key-placeholder'

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey)

if (!hasSupabaseConfig) {
	console.warn(
		'بيانات Supabase غير معرفة في البيئة. تم تشغيل التطبيق بوضع آمن بدون اتصال فعلي.',
	)
}

if (supabaseKey?.startsWith('postgresql://')) {
	console.warn(
		'VITE_SUPABASE_ANON_KEY يجب أن يكون anon public key وليس رابط اتصال PostgreSQL.',
	)
}

export const supabase = createClient(
	hasSupabaseConfig ? supabaseUrl : fallbackUrl,
	hasSupabaseConfig ? supabaseKey : fallbackKey,
)
