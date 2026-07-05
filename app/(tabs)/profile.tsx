import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView } from 'react-native'
import { supabase } from '../../lib/supabase'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'
import { useTabBarHeight } from '../../lib/useTabBarHeight'
import { useLanguage } from '../../lib/LanguageContext'
import { useTranslation } from 'react-i18next'

type Profile = {
  username: string
  xp_total: number
  level: number
}

function XPBar({ xp, level, colors, t }: { xp: number; level: number; colors: any; t: any }) {
  const xpForCurrentLevel = (level - 1) * 100
  const progress = ((xp - xpForCurrentLevel) / 100) * 100

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpLabelRow}>
        <Text style={[styles.xpLabel, { color: colors.textSecondary }]}>XP → {t('level')} {level + 1}</Text>
        <Text style={[styles.xpValue, { color: colors.textSecondary }]}>{xp - xpForCurrentLevel}/100</Text>
      </View>
      <View style={[styles.xpBar, { backgroundColor: colors.card2 }]}>
        <View style={[styles.xpFill, { width: `${Math.min(progress, 100)}%` }]} />
      </View>
    </View>
  )
}

export default function Profile() {
  const { colors, theme, toggleTheme } = useTheme()
  const { language, changeLanguage } = useLanguage()
  const { t } = useTranslation()
  const tabBarHeight = useTabBarHeight()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [habitsCount, setHabitsCount] = useState(0)
  const [completionsCount, setCompletionsCount] = useState(0)

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('username, xp_total, level')
      .eq('id', user.id)
      .single()

    if (data) setProfile(data)

    const { count: habits } = await supabase
      .from('habits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('archived', false)

    setHabitsCount(habits || 0)

    const { count: completions } = await supabase
      .from('habit_logs')
      .select('*', { count: 'exact', head: true })
      .in('habit_id',
        (await supabase.from('habits').select('id').eq('user_id', user.id)).data?.map(h => h.id) || []
      )

    setCompletionsCount(completions || 0)
  }

  useFocusEffect(useCallback(() => { fetchProfile() }, []))

  async function handleLogout() {
    Alert.alert(t('logout_title'), t('logout_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'), style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        }
      }
    ])
  }

  function getLevelEmoji(level: number) {
    if (level < 5) return '🌱'
    if (level < 10) return '⚡'
    if (level < 20) return '🔥'
    if (level < 50) return '💎'
    return '👑'
  }

  if (!profile) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.loading, { color: colors.textSecondary }]}>{t('loading')}</Text>
    </View>
  )

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={styles.avatarEmoji}>{getLevelEmoji(profile.level)}</Text>
        </View>
        <Text style={[styles.username, { color: colors.text }]}>{profile.username}</Text>
        <View style={[styles.levelBadge, { backgroundColor: colors.primary + '33', borderColor: colors.primary }]}>
          <Text style={[styles.levelText, { color: colors.primary }]}>{t('level')} {profile.level}</Text>
        </View>
      </View>

      {/* XP Bar */}
      <XPBar xp={profile.xp_total} level={profile.level} colors={colors} t={t} />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{profile.xp_total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('xp_total')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{habitsCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('habits')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{completionsCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('completed')}</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('achievements')}</Text>
        <View style={styles.badgesRow}>
          {completionsCount >= 1 && (
            <View style={[styles.badge, { backgroundColor: colors.card }]}>
              <Text style={styles.badgeEmoji}>🌟</Text>
              <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{t('first_step')}</Text>
            </View>
          )}
          {completionsCount >= 10 && (
            <View style={[styles.badge, { backgroundColor: colors.card }]}>
              <Text style={styles.badgeEmoji}>🔥</Text>
              <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{t('on_fire')}</Text>
            </View>
          )}
          {completionsCount >= 50 && (
            <View style={[styles.badge, { backgroundColor: colors.card }]}>
              <Text style={styles.badgeEmoji}>💎</Text>
              <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{t('dedicated')}</Text>
            </View>
          )}
          {completionsCount === 0 && (
            <Text style={[styles.noBadges, { color: colors.textMuted }]}>{t('complete_for_badges')}</Text>
          )}
        </View>
      </View>

      {/* Preferências */}
      <View style={[styles.prefsCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>{t('preferences')}</Text>

        {/* Tema */}
        <View style={styles.prefRow}>
          <View style={styles.prefLeft}>
            <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={20} color={colors.primary} />
            <Text style={[styles.prefLabel, { color: colors.text }]}>
              {theme === 'dark' ? t('dark_mode') : t('light_mode')}
            </Text>
          </View>
          <Switch
            value={theme === 'light'}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.card2, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

        {/* Idioma */}
        <View style={styles.prefRow}>
          <View style={styles.prefLeft}>
            <Ionicons name="language" size={20} color={colors.primary} />
            <Text style={[styles.prefLabel, { color: colors.text }]}>{t('language')}</Text>
          </View>
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
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.danger }]}
        onPress={handleLogout}
      >
        <Text style={[styles.logoutText, { color: colors.danger }]}>{t('logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 56 },
  loading: { textAlign: 'center', marginTop: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3 },
  avatarEmoji: { fontSize: 48 },
  username: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  levelBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1 },
  levelText: { fontWeight: 'bold', fontSize: 14 },
  xpContainer: { marginBottom: 32 },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  xpLabel: { fontSize: 13 },
  xpValue: { fontSize: 13 },
  xpBar: { height: 10, borderRadius: 5, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#6c63ff', borderRadius: 5 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  badgesRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  badge: { borderRadius: 16, padding: 16, alignItems: 'center', minWidth: 90 },
  badgeEmoji: { fontSize: 32, marginBottom: 8 },
  badgeLabel: { fontSize: 12, textAlign: 'center' },
  noBadges: { fontSize: 14, fontStyle: 'italic' },
  prefsCard: { borderRadius: 16, padding: 16, marginBottom: 24 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefLabel: { fontSize: 16 },
  prefDivider: { height: 1, marginVertical: 16 },
  langButtons: { flexDirection: 'row', gap: 8 },
  langBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  langBtnText: { fontWeight: 'bold', fontSize: 13 },
  logoutBtn: { borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, marginBottom: 8 },
  logoutText: { fontSize: 16, fontWeight: 'bold' },
})