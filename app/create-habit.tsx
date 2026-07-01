import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { supabase } from '../lib/supabase'
import { router } from 'expo-router'
import { scheduleHabitReminder } from '../lib/notifications'

const COLORS = ['#6c63ff', '#ff6584', '#43e97b', '#f7971e', '#4facfe', '#f953c6']
const ICONS = ['💪', '📚', '💧', '🏃', '🧘', '🥗', '😴', '✍️', '🎯', '🎨']

export default function CreateHabit() {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('🎯')
  const [selectedColor, setSelectedColor] = useState('#6c63ff')
  const [reminderHour, setReminderHour] = useState(8)
  const [reminderMinute, setReminderMinute] = useState(0)
  const [enableReminder, setEnableReminder] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Erro', 'Dá um nome ao hábito!')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.from('habits').insert({
      user_id: user?.id,
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      frequency: 'daily',
    }).select()

    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      if (enableReminder && data && data[0]) {
        await scheduleHabitReminder(
          data[0].id,
          name.trim(),
          selectedIcon,
          reminderHour,
          reminderMinute
        )
      }
      router.back()
    }

    setLoading(false)
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Novo Hábito</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Beber água, Ler 30min..."
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Ícone</Text>
      <View style={styles.grid}>
        {ICONS.map(icon => (
          <TouchableOpacity
            key={icon}
            style={[styles.iconBtn, selectedIcon === icon && styles.iconBtnSelected]}
            onPress={() => setSelectedIcon(icon)}
          >
            <Text style={styles.iconText}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Cor</Text>
      <View style={styles.colorRow}>
        {COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorBtn,
              { backgroundColor: color },
              selectedColor === color && styles.colorBtnSelected
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>

      {/* Recordatório */}
      <View style={styles.reminderRow}>
        <Text style={styles.label}>Recordatório diário</Text>
        <TouchableOpacity
          style={[styles.toggle, enableReminder && styles.toggleActive]}
          onPress={() => setEnableReminder(!enableReminder)}
        >
          <Text style={styles.toggleText}>{enableReminder ? 'Ativo' : 'Inativo'}</Text>
        </TouchableOpacity>
      </View>

      {enableReminder && (
        <View style={styles.timeRow}>
          <View style={styles.timeColumn}>
            <TouchableOpacity
              style={styles.timeBtn}
              onPress={() => setReminderHour(h => (h + 1) % 24)}
            >
              <Text style={styles.timeArrow}>▲</Text>
            </TouchableOpacity>
            <Text style={styles.timeText}>{String(reminderHour).padStart(2, '0')}</Text>
            <TouchableOpacity
              style={styles.timeBtn}
              onPress={() => setReminderHour(h => (h - 1 + 24) % 24)}
            >
              <Text style={styles.timeArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.timeSeparator}>:</Text>

          <View style={styles.timeColumn}>
            <TouchableOpacity
              style={styles.timeBtn}
              onPress={() => setReminderMinute(m => (m + 5) % 60)}
            >
              <Text style={styles.timeArrow}>▲</Text>
            </TouchableOpacity>
            <Text style={styles.timeText}>{String(reminderMinute).padStart(2, '0')}</Text>
            <TouchableOpacity
              style={styles.timeBtn}
              onPress={() => setReminderMinute(m => (m - 5 + 60) % 60)}
            >
              <Text style={styles.timeArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: selectedColor }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'A criar...' : `${selectedIcon} Criar Hábito`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 32, marginTop: 48 },
  label: { fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#1e1e2e', borderRadius: 12, padding: 16,
    marginBottom: 24, color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: '#2e2e3e',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  iconBtn: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#1e1e2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  iconBtnSelected: { borderColor: '#6c63ff' },
  iconText: { fontSize: 24 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  colorBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorBtnSelected: { borderColor: '#ffffff', transform: [{ scale: 1.2 }] },
  reminderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  toggle: {
    backgroundColor: '#2e2e3e', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  toggleActive: { backgroundColor: '#6c63ff' },
  toggleText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 16, marginBottom: 32,
  },
  timeColumn: { alignItems: 'center', gap: 8 },
  timeBtn: {
    backgroundColor: '#1e1e2e', borderRadius: 8, padding: 12,
  },
  timeArrow: { color: '#6c63ff', fontSize: 18 },
  timeText: { color: '#ffffff', fontSize: 40, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  timeSeparator: { color: '#ffffff', fontSize: 40, fontWeight: 'bold', marginBottom: 8 },
  button: {
    borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 40,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
})