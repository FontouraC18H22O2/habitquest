import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.PROJECT_URL!
const supabaseAnonKey = process.env.ANON_PUBLIC_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)