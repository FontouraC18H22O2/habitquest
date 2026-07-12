import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, Image,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Camera from 'expo-camera'
import { useTheme } from '../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'
import { cancelHabitReminder } from '../../lib/notifications'

type Log = {
  id: string
  completed_at: string
  photo_url: string | null
  note: string | null
}

type Habit = {
  id: string
  name: string
  icon: string
  color: string
}

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [habit, setHabit] = useState<Habit | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [streak, setStreak] = useState(0)
  const [uploading, setUploading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchHabit()
      fetchLogs()
    }, [])
  )

  async function fetchHabit() {
    const { data } = await supabase.from('habits').select('*').eq('id', id).single()
    if (data) setHabit(data)
  }

  async function fetchLogs() {
    const { data } = await supabase
      .from('habit_logs').select('*').eq('habit_id', id)
      .not('photo_url', 'is', null)
      .order('completed_at', { ascending: false }).limit(10)

    if (data) {
      setLogs(data as Log[])
      calculateStreak(data as Log[])
    }
  }

  function calculateStreak(logs: Log[]) {
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const found = logs.find(l => l.completed_at.split('T')[0] === key)
      if (found) streak++
      else if (i > 0) break
    }
    setStreak(streak)
  }

  async function takePhoto() {
    const { status } = await Camera.Camera.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Erro', 'Precisamos de acesso à câmara!'); return }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.7,
    })
    if (!result.canceled) await uploadPhoto(result.assets[0].uri)
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Erro', 'Precisamos de acesso à galeria!'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.7,
    })
    if (!result.canceled) await uploadPhoto(result.assets[0].uri)
  }

  async function uploadPhoto(uri: string) {
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const filename = `${user.id}/${id}/${Date.now()}.jpg`
      const formData = new FormData()
      formData.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any)

      const { error: uploadError } = await supabase.storage
        .from('habit-photos').upload(filename, formData, { contentType: 'image/jpeg' })

      if (uploadError) { Alert.alert('Erro', uploadError.message); return }

      // Signed URL em vez de URL pública
      const { data: signedData } = await supabase.storage
        .from('habit-photos')
        .createSignedUrl(filename, 3600)

      const photoUrl = signedData?.signedUrl || null

      const today = new Date().toISOString().split('T')[0]
      const { data: todayLogs } = await supabase
        .from('habit_logs').select('*').eq('habit_id', id)
        .gte('completed_at', `${today}T00:00:00`).lte('completed_at', `${today}T23:59:59`)
        .order('completed_at', { ascending: false }).limit(1)

      if (todayLogs && todayLogs.length > 0) {
        await supabase.from('habit_logs').insert({
          habit_id: id, photo_url: photoUrl, note: t('photo_saved')
        })
        await fetchLogs()
        Alert.alert(t('photo_saved'))
      } else {
        Alert.alert('Atenção', t('complete_first'))
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível fazer upload da foto')
    }
    setUploading(false)
  }

  async function handleDelete() {
    Alert.alert(t('delete_habit'), t('delete_habit_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await cancelHabitReminder(id)
          await supabase.from('habits').delete().eq('id', id)
          router.back()
        },
      },
    ])
  }

  if (!habit) return null

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{habit.icon} {habit.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push(`/edit-habit/${id}` as any)}>
            <Ionicons name="pencil-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: habit.color }]}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={[styles.streakNumber, { color: colors.text }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>{t('days_in_a_row')}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('add_proof')}</Text>
      <View style={styles.photoButtons}>
        <TouchableOpacity
          style={[styles.photoBtn, { backgroundColor: habit.color }]}
          onPress={takePhoto} disabled={uploading}
        >
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.photoBtnText}>{t('camera')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.photoBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: habit.color }]}
          onPress={pickFromGallery} disabled={uploading}
        >
          <Ionicons name="images" size={24} color={habit.color} />
          <Text style={[styles.photoBtnText, { color: habit.color }]}>{t('gallery')}</Text>
        </TouchableOpacity>
      </View>

      {uploading && <Text style={[styles.uploading, { color: colors.textSecondary }]}>{t('uploading')}</Text>}

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('photo_history')}</Text>
      {logs.length === 0 ? (
        <View style={styles.emptyPhotos}>
          <Text style={styles.emptyPhotosEmoji}>📷</Text>
          <Text style={[styles.emptyPhotosText, { color: colors.textMuted }]}>{t('no_photos')}</Text>
        </View>
      ) : (
        logs.map(log => (
          <View key={log.id} style={[styles.logCard, { backgroundColor: colors.card }]}>
            <View style={styles.logInfo}>
              <Text style={[styles.logDate, { color: colors.text }]}>
                {new Date(log.completed_at).toLocaleDateString('pt-PT', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </Text>
              {log.note && <Text style={[styles.logNote, { color: colors.textSecondary }]}>{log.note}</Text>}
            </View>
            {log.photo_url && <Image source={{ uri: log.photo_url }} style={styles.logPhoto} />}
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  streakCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 32, borderWidth: 2 },
  streakEmoji: { fontSize: 40, marginBottom: 8 },
  streakNumber: { fontSize: 56, fontWeight: 'bold' },
  streakLabel: { fontSize: 16, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  photoBtn: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center', gap: 8 },
  photoBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  uploading: { textAlign: 'center', marginBottom: 16 },
  emptyPhotos: { alignItems: 'center', paddingVertical: 32 },
  emptyPhotosEmoji: { fontSize: 48, marginBottom: 12 },
  emptyPhotosText: { fontSize: 14 },
  logCard: { borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  logInfo: { flex: 1 },
  logDate: { fontSize: 14, fontWeight: '500' },
  logNote: { fontSize: 13, marginTop: 4 },
  logPhoto: { width: 60, height: 60, borderRadius: 12 },
})