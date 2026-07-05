import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { router } from 'expo-router'
import { useTheme } from '../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../lib/LanguageContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()

  async function handleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) Alert.alert('Erro', error.message)
    else router.replace('/(tabs)')
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Selector de idioma no topo */}
      <View style={styles.topBar}>
        <View style={styles.langButtons}>
          <TouchableOpacity
            style={[styles.langBtn, { borderColor: colors.primary },
              language === 'pt' && { backgroundColor: colors.primary }]}
            onPress={() => changeLanguage('pt')}
          >
            <Text style={[styles.langBtnText, { color: colors.primary },
              language === 'pt' && { color: '#ffffff' }]}>PT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, { borderColor: colors.primary },
              language === 'en' && { backgroundColor: colors.primary }]}
            onPress={() => changeLanguage('en')}
          >
            <Text style={[styles.langBtnText, { color: colors.primary },
              language === 'en' && { color: '#ffffff' }]}>EN</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>LifePilot✈️</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('welcome_back')}</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={t('email')}
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={t('password')}
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? t('logging_in') : t('login')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)}>
          <Text style={[styles.link, { color: colors.primary }]}>{t('no_account')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  topBar: {
    paddingTop: 56, paddingHorizontal: 24,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  langButtons: { flexDirection: 'row', gap: 8 },
  langBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  langBtnText: { fontWeight: 'bold', fontSize: 13 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16, borderWidth: 1 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  link: { textAlign: 'center', fontSize: 14 },
})