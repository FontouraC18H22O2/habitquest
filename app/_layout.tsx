import { useEffect, useState } from 'react'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { requestNotificationPermission } from '../lib/notifications'
import { ThemeProvider } from '../lib/ThemeContext'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    requestNotificationPermission()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
     
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        router.replace('/(tabs)')
      } else {
        router.replace('/(auth)/login')
      }
    })
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (session) {
      router.replace('/(tabs)')
    } else {
      router.replace('/(auth)/login')
    }
  }, [initialized, session])

  return (
  <ThemeProvider>
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </SafeAreaProvider>
  </ThemeProvider>
)
}