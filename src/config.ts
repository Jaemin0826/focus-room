const url = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://ztyfbrswwlyvnrsugrbo.supabase.co'
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  'sb_publishable_bG5XK_Q0pet9WCbQghaW7g_IG6eKKll'

export const supabaseConfig = { url, anonKey }
