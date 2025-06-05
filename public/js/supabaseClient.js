import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://hcebkwfsjnfhhtxrfoju.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZWJrd2Zzam5maGh0eHJmb2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2OTYwNjEsImV4cCI6MjA2NDI3MjA2MX0.ckVYQwq72zgQYi45RYxet5H_rYwWLGsKyAi967DTkpw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

