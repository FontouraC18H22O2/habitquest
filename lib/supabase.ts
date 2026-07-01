import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: async (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  'https://wknfxooymgmqgsinajhn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbmZ4b295bWdtcWdzaW5hamhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzkzNzgsImV4cCI6MjA5ODQxNTM3OH0.jDYdpvhdiIClRCiqWbHu2ZIqDDeKtnjfc99-MfusAwo',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetch.bind(globalThis),
    },
  }
)