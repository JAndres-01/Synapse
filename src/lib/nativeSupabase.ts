import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zlhpduydzavbpkwcrltv.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsaHBkdXlkemF2YnBrd2NybHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NjUzODIsImV4cCI6MjEwMzQ0MTM4Mn0.fqOoJhFiz8vB1OKWZ4Z4Ze-00tSbSiEV5i6M6XZaf9Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
