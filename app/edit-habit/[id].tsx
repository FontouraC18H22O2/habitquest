import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Modal
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import ColorPicker, { Panel1, Swatches, Preview, HueSlider } from 'reanimated-color-picker'
import { scheduleHabitReminder, cancelHabitReminder } from '../../lib/notifications'

const ICONS = ['💪', '📚', '💧', '🏃', '🧘', '🥗', '😴', '✍️', '🎯', '🎨', '🚴', '🏊', '🎵', '🧹', '💊', '🐕', '🌿', '☕']

const CATEGORIES = [
  { id: 'exercise', label: 'Exercício', icon: '🏃' },
  { id: 'health', label: 'Saúde', icon: '💊' },
  { id: 'learning', label: 'Aprendizagem', icon: '📚' },
  { id: 'mindfulness', label: 'Mindfulness', icon: '🧘' },
  { id: 'nutrition', label: 'Nutrição', icon: '🥗' },
  { id: 'sleep', label: 'Sono', icon: '😴' },
  { id: 'general', label: 'Geral', icon: '🎯' },
]

const UNITS = ['km', 'ml', 'L', 'min', 'h', 'páginas', 'copos', 'séries', 'reps', 'kcal', 'passos']

const PRESET_COLORS = [
  '#6c63ff', '#ff6584', '#43e97b', '#f7971e',
  '#4facfe', '#f953c6', '#ff6b6b', '#feca57',
  '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd',
]

const FREQUENCIES = [
  { id: 'once', label: 'Uma vez', icon: '🔔' },
  { id: 'every_30min', label: 'De 30 em 30 min', icon: '⏱️' },
  { id: 'every_hour', label: 'De hora a hora', icon: '🕐' },
  { id: 'every_2hours', label: 'De 2 em 2 horas', icon: '🕑' },
]

export default function EditHabit() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('🎯')
  const [selectedColor, setSelectedColor] = useState('#6c63ff')
  const [selectedCategory, setSelectedCategory] = useState('general')
  const [goalValue, setGoalValue] = useState('')
  const [goalUnit, setGoalUnit] = useState('')
  const [reminderHour, setReminderHour] = useState(8)
  const [reminderMinute, setReminderMinute] = useState(0)
  const [reminderEndHour, setReminderEndHour] = useState(22)
  const [reminderFrequency, setReminderFrequency] = useState<'once' | 'every_30min' | 'every_hour' | 'every_2hours'>('once')
  const [enableReminder, setEnableReminder] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchHabit()
  }, [])

  async function fetchHabit() {
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('id', id)
      .single()

    if (data) {
      setName(data.name)
      setSelectedIcon(data.icon || '🎯')
      setSelectedColor(data.color || '#6c63ff')
      setSelectedCategory(data.category || 'general')
      setGoalValue(data.goal_value ? String(data.goal_value) : '')
      setGoalUnit(data.goal_unit || '')
      setReminderFrequency(data.reminder_frequency || 'once')
      setReminderEndHour(data.reminder_end_hour || 22)
      if (data.reminder_time) {
        const [h, m] = data.reminder_time.split(':')
        setReminderHour(parseInt(h))
        setReminderMinute(parseInt(m))
        setEnableReminder(true)
      }
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Erro', 'Dá um nome ao hábito!')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('habits')
      .update({
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        category: selectedCategory,
        goal_value: goalValue ? parseFloat(goalValue) : null,
        goal_unit: goalUnit || null,
        reminder_time: enableReminder ? `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}` : null,
        reminder_frequency: enableReminder ? reminderFrequency : null,
        reminder_end_hour: enableReminder ? reminderEndHour : null,
      })
      .eq('id', id)

    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      if (enableReminder) {
        await scheduleHabitReminder(
          id,
          name.trim(),
          selectedIcon,
          reminderHour,
          reminderMinute,
          reminderFrequency,
          reminderEndHour
        )
      } else {
        await cancelHabitReminder(id)
      }
      router.back()
    }

    setLoading(false)
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Hábito</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Nome */}
      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Correr 10km, Beber água..."
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

      {/* Categoria */}
      <Text style={styles.label}>Categoria</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryBtn, selectedCategory === cat.id && { borderColor: selectedColor, backgroundColor: selectedColor + '22' }]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, selectedCategory === cat.id && { color: selectedColor }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Meta */}
      <Text style={styles.label}>Meta diária (opcional)</Text>
      <View style={styles.goalRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Ex: 10"
          placeholderTextColor="#888"
          value={goalValue}
          onChangeText={setGoalValue}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.unitBtn} onPress={() => setShowUnitPicker(true)}>
          <Text style={styles.unitBtnText}>{goalUnit || 'Unidade'}</Text>
          <Ionicons name="chevron-down" size={16} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Ícone */}
      <Text style={styles.label}>Ícone</Text>
      <View style={styles.grid}>
        {ICONS.map(icon => (
          <TouchableOpacity
            key={icon}
            style={[styles.iconBtn, selectedIcon === icon && { borderColor: selectedColor }]}
            onPress={() => setSelectedIcon(icon)}
          >
            <Text style={styles.iconText}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cor */}
      <Text style={styles.label}>Cor</Text>
      <View style={styles.colorGrid}>
        {PRESET_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[styles.colorBtn, { backgroundColor: color }, selectedColor === color && styles.colorBtnSelected]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
        <TouchableOpacity style={[styles.colorBtn, styles.customColorBtn]} onPress={() => setShowColorPicker(true)}>
          <Ionicons name="color-palette" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      <View style={styles.colorPreviewRow}>
        <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
        <Text style={styles.colorPreviewText}>{selectedColor}</Text>
      </View>

      {/* Recordatório */}
      <View style={styles.reminderRow}>
        <View>
          <Text style={styles.label}>Recordatório diário</Text>
          <Text style={styles.reminderSub}>Notificação à hora escolhida</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, enableReminder && { backgroundColor: selectedColor }]}
          onPress={() => setEnableReminder(!enableReminder)}
        >
          <Text style={styles.toggleText}>{enableReminder ? 'Ativo' : 'Inativo'}</Text>
        </TouchableOpacity>
      </View>

      {enableReminder && (
        <View>
          {/* Frequência */}
          <Text style={styles.label}>Frequência</Text>
          <View style={styles.frequencyGrid}>
            {FREQUENCIES.map(freq => (
              <TouchableOpacity
                key={freq.id}
                style={[styles.frequencyBtn, reminderFrequency === freq.id && { borderColor: selectedColor, backgroundColor: selectedColor + '22' }]}
                onPress={() => setReminderFrequency(freq.id as any)}
              >
                <Text style={styles.frequencyIcon}>{freq.icon}</Text>
                <Text style={[styles.frequencyLabel, reminderFrequency === freq.id && { color: selectedColor }]}>{freq.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hora de início */}
          <Text style={styles.label}>
            {reminderFrequency === 'once' ? 'Hora do recordatório' : 'Hora de início'}
          </Text>
          <View style={styles.timeRow}>
            <View style={styles.timeColumn}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setReminderHour(h => (h + 1) % 24)}>
                <Text style={styles.timeArrow}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.timeText}>{String(reminderHour).padStart(2, '0')}</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setReminderHour(h => (h - 1 + 24) % 24)}>
                <Text style={styles.timeArrow}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeColumn}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setReminderMinute(m => (m + 5) % 60)}>
                <Text style={styles.timeArrow}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.timeText}>{String(reminderMinute).padStart(2, '0')}</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setReminderMinute(m => (m - 5 + 60) % 60)}>
                <Text style={styles.timeArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hora de fim */}
          {reminderFrequency !== 'once' && (
            <>
              <Text style={styles.label}>Hora de fim</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeColumn}>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setReminderEndHour(h => Math.min(23, h + 1))}>
                    <Text style={styles.timeArrow}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeText}>{String(reminderEndHour).padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.timeBtn} onPress={() => setReminderEndHour(h => Math.max(reminderHour + 1, h - 1))}>
                    <Text style={styles.timeArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeSeparator}>:00</Text>
              </View>
              <Text style={styles.reminderSub}>
                Vais receber notificações das {String(reminderHour).padStart(2, '0')}h às {String(reminderEndHour).padStart(2, '0')}h
              </Text>
            </>
          )}
        </View>
      )}

      {/* Botão guardar */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: selectedColor }]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'A guardar...' : '💾 Guardar alterações'}</Text>
      </TouchableOpacity>

      {/* Modal unidades */}
      <Modal visible={showUnitPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowUnitPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Escolhe a unidade</Text>
            {UNITS.map(unit => (
              <TouchableOpacity
                key={unit}
                style={styles.unitOption}
                onPress={() => { setGoalUnit(unit); setShowUnitPicker(false) }}
              >
                <Text style={styles.unitOptionText}>{unit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal color picker */}
      <Modal visible={showColorPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.colorPickerModal}>
            <Text style={styles.modalTitle}>Escolhe uma cor</Text>
            <ColorPicker
              style={{ width: '100%' }}
              value={selectedColor}
              onCompleteJS={(color) => setSelectedColor(color.hex)}
            >
              <Preview />
              <Panel1 />
              <HueSlider />
              <Swatches />
            </ColorPicker>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: selectedColor, marginTop: 24, marginBottom: 0 }]}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={styles.buttonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 48 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  label: { fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#1e1e2e', borderRadius: 12, padding: 16,
    marginBottom: 24, color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: '#2e2e3e',
  },
  categoryRow: { marginBottom: 24 },
  categoryBtn: {
    alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: '#1e1e2e', marginRight: 8, borderWidth: 2,
    borderColor: 'transparent', minWidth: 80,
  },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: { fontSize: 11, color: '#888', textAlign: 'center' },
  goalRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  unitBtn: {
    backgroundColor: '#1e1e2e', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#2e2e3e', minWidth: 120,
  },
  unitBtnText: { color: '#888', fontSize: 14, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  iconBtn: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#1e1e2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  iconText: { fontSize: 24 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  colorBtnSelected: { borderColor: '#ffffff', transform: [{ scale: 1.2 }] },
  customColorBtn: { backgroundColor: '#1e1e2e', borderWidth: 2, borderColor: '#2e2e3e', justifyContent: 'center', alignItems: 'center' },
  colorPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  colorPreview: { width: 32, height: 32, borderRadius: 8 },
  colorPreviewText: { color: '#888', fontSize: 14 },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reminderSub: { fontSize: 12, color: '#555', marginTop: 2, marginBottom: 16 },
  toggle: { backgroundColor: '#2e2e3e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  toggleText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  frequencyBtn: {
    width: '47%', padding: 12, borderRadius: 12,
    backgroundColor: '#1e1e2e', borderWidth: 2,
    borderColor: 'transparent', alignItems: 'center',
  },
  frequencyIcon: { fontSize: 24, marginBottom: 4 },
  frequencyLabel: { fontSize: 12, color: '#888', textAlign: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 },
  timeColumn: { alignItems: 'center', gap: 8 },
  timeBtn: { backgroundColor: '#1e1e2e', borderRadius: 8, padding: 12 },
  timeArrow: { color: '#6c63ff', fontSize: 18 },
  timeText: { color: '#ffffff', fontSize: 40, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  timeSeparator: { color: '#ffffff', fontSize: 40, fontWeight: 'bold', marginBottom: 8 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 40 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  unitOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#2e2e3e' },
  unitOptionText: { color: '#ffffff', fontSize: 16 },
  colorPickerModal: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
})