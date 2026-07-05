import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Modal
} from 'react-native'
import { supabase } from '../lib/supabase'
import { router } from 'expo-router'
import { scheduleHabitReminder } from '../lib/notifications'
import { Ionicons } from '@expo/vector-icons'
import ColorPicker, { Panel1, Swatches, Preview, HueSlider } from 'reanimated-color-picker'
import { useTheme } from '../lib/ThemeContext'

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

export default function CreateHabit() {
  const { colors } = useTheme()
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
      category: selectedCategory,
      goal_value: goalValue ? parseFloat(goalValue) : null,
      goal_unit: goalUnit || null,
      reminder_time: enableReminder ? `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}` : null,
      reminder_frequency: enableReminder ? reminderFrequency : null,
      reminder_end_hour: enableReminder ? reminderEndHour : null,
    }).select()

    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      if (enableReminder && data && data[0]) {
        await scheduleHabitReminder(data[0].id, name.trim(), selectedIcon, reminderHour, reminderMinute, reminderFrequency, reminderEndHour)
      }
      router.back()
    }
    setLoading(false)
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Novo Hábito</Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Nome</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        placeholder="Ex: Correr 10km, Beber água..."
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>Categoria</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryBtn, { backgroundColor: colors.card, borderColor: 'transparent' },
              selectedCategory === cat.id && { borderColor: selectedColor, backgroundColor: selectedColor + '22' }]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryLabel, { color: colors.textSecondary },
              selectedCategory === cat.id && { color: selectedColor }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Meta diária (opcional)</Text>
      <View style={styles.goalRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Ex: 10"
          placeholderTextColor={colors.textSecondary}
          value={goalValue}
          onChangeText={setGoalValue}
          keyboardType="numeric"
        />
        <TouchableOpacity style={[styles.unitBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowUnitPicker(true)}>
          <Text style={[styles.unitBtnText, { color: colors.textSecondary }]}>{goalUnit || 'Unidade'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Ícone</Text>
      <View style={styles.grid}>
        {ICONS.map(icon => (
          <TouchableOpacity
            key={icon}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: 'transparent' },
              selectedIcon === icon && { borderColor: selectedColor }]}
            onPress={() => setSelectedIcon(icon)}
          >
            <Text style={styles.iconText}>{icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Cor</Text>
      <View style={styles.colorGrid}>
        {PRESET_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[styles.colorBtn, { backgroundColor: color }, selectedColor === color && styles.colorBtnSelected]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
        <TouchableOpacity
          style={[styles.colorBtn, { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => setShowColorPicker(true)}
        >
          <Ionicons name="color-palette" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.colorPreviewRow}>
        <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
        <Text style={[styles.colorPreviewText, { color: colors.textSecondary }]}>{selectedColor}</Text>
      </View>

      <View style={styles.reminderRow}>
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Recordatório diário</Text>
          <Text style={[styles.reminderSub, { color: colors.textMuted }]}>Notificação à hora escolhida</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, { backgroundColor: enableReminder ? selectedColor : colors.card2 }]}
          onPress={() => setEnableReminder(!enableReminder)}
        >
          <Text style={styles.toggleText}>{enableReminder ? 'Ativo' : 'Inativo'}</Text>
        </TouchableOpacity>
      </View>

      {enableReminder && (
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Frequência</Text>
          <View style={styles.frequencyGrid}>
            {FREQUENCIES.map(freq => (
              <TouchableOpacity
                key={freq.id}
                style={[styles.frequencyBtn, { backgroundColor: colors.card, borderColor: 'transparent' },
                  reminderFrequency === freq.id && { borderColor: selectedColor, backgroundColor: selectedColor + '22' }]}
                onPress={() => setReminderFrequency(freq.id as any)}
              >
                <Text style={styles.frequencyIcon}>{freq.icon}</Text>
                <Text style={[styles.frequencyLabel, { color: colors.textSecondary },
                  reminderFrequency === freq.id && { color: selectedColor }]}>{freq.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {reminderFrequency === 'once' ? 'Hora do recordatório' : 'Hora de início'}
          </Text>
          <View style={styles.timeRow}>
            <View style={styles.timeColumn}>
              <TouchableOpacity style={[styles.timeBtn, { backgroundColor: colors.card }]} onPress={() => setReminderHour(h => (h + 1) % 24)}>
                <Text style={[styles.timeArrow, { color: colors.primary }]}>▲</Text>
              </TouchableOpacity>
              <Text style={[styles.timeText, { color: colors.text }]}>{String(reminderHour).padStart(2, '0')}</Text>
              <TouchableOpacity style={[styles.timeBtn, { backgroundColor: colors.card }]} onPress={() => setReminderHour(h => (h - 1 + 24) % 24)}>
                <Text style={[styles.timeArrow, { color: colors.primary }]}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>
            <View style={styles.timeColumn}>
              <TouchableOpacity style={[styles.timeBtn, { backgroundColor: colors.card }]} onPress={() => setReminderMinute(m => (m + 5) % 60)}>
                <Text style={[styles.timeArrow, { color: colors.primary }]}>▲</Text>
              </TouchableOpacity>
              <Text style={[styles.timeText, { color: colors.text }]}>{String(reminderMinute).padStart(2, '0')}</Text>
              <TouchableOpacity style={[styles.timeBtn, { backgroundColor: colors.card }]} onPress={() => setReminderMinute(m => (m - 5 + 60) % 60)}>
                <Text style={[styles.timeArrow, { color: colors.primary }]}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {reminderFrequency !== 'once' && (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Hora de fim</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeColumn}>
                  <TouchableOpacity style={[styles.timeBtn, { backgroundColor: colors.card }]} onPress={() => setReminderEndHour(h => Math.min(23, h + 1))}>
                    <Text style={[styles.timeArrow, { color: colors.primary }]}>▲</Text>
                  </TouchableOpacity>
                  <Text style={[styles.timeText, { color: colors.text }]}>{String(reminderEndHour).padStart(2, '0')}</Text>
                  <TouchableOpacity style={[styles.timeBtn, { backgroundColor: colors.card }]} onPress={() => setReminderEndHour(h => Math.max(reminderHour + 1, h - 1))}>
                    <Text style={[styles.timeArrow, { color: colors.primary }]}>▼</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.timeSeparator, { color: colors.text }]}>:00</Text>
              </View>
              <Text style={[styles.reminderSub, { color: colors.textMuted }]}>
                Vais receber notificações das {String(reminderHour).padStart(2, '0')}h às {String(reminderEndHour).padStart(2, '0')}h
              </Text>
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: selectedColor }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'A criar...' : `${selectedIcon} Criar Hábito`}</Text>
      </TouchableOpacity>

      {/* Modal unidades */}
      <Modal visible={showUnitPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowUnitPicker(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Escolhe a unidade</Text>
            {UNITS.map(unit => (
              <TouchableOpacity
                key={unit}
                style={[styles.unitOption, { borderBottomColor: colors.border }]}
                onPress={() => { setGoalUnit(unit); setShowUnitPicker(false) }}
              >
                <Text style={[styles.unitOptionText, { color: colors.text }]}>{unit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal color picker */}
      <Modal visible={showColorPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.colorPickerModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Escolhe uma cor</Text>
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
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32, marginTop: 48 },
  label: { fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 16, borderWidth: 1 },
  categoryRow: { marginBottom: 24 },
  categoryBtn: { alignItems: 'center', padding: 12, borderRadius: 12, marginRight: 8, borderWidth: 2, minWidth: 80 },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: { fontSize: 11, textAlign: 'center' },
  goalRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  unitBtn: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, minWidth: 120 },
  unitBtnText: { fontSize: 14, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  iconBtn: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  iconText: { fontSize: 24 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  colorBtnSelected: { borderColor: '#ffffff', transform: [{ scale: 1.2 }] },
  colorPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  colorPreview: { width: 32, height: 32, borderRadius: 8 },
  colorPreviewText: { fontSize: 14 },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reminderSub: { fontSize: 12, marginTop: 2, marginBottom: 16 },
  toggle: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  toggleText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  frequencyBtn: { width: '47%', padding: 12, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  frequencyIcon: { fontSize: 24, marginBottom: 4 },
  frequencyLabel: { fontSize: 12, textAlign: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 },
  timeColumn: { alignItems: 'center', gap: 8 },
  timeBtn: { borderRadius: 8, padding: 12 },
  timeArrow: { fontSize: 18 },
  timeText: { fontSize: 40, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  timeSeparator: { fontSize: 40, fontWeight: 'bold', marginBottom: 8 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 40 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  unitOption: { padding: 16, borderBottomWidth: 1 },
  unitOptionText: { fontSize: 16 },
  colorPickerModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
})