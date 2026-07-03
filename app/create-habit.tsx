import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Modal
} from 'react-native'
import { supabase } from '../lib/supabase'
import { router } from 'expo-router'
import { scheduleHabitReminder } from '../lib/notifications'
import { Ionicons } from '@expo/vector-icons'
import ColorPicker, { Panel1, Swatches, Preview, OpacitySlider, HueSlider } from 'reanimated-color-picker'


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

export default function CreateHabit() {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('🎯')
  const [selectedColor, setSelectedColor] = useState('#6c63ff')
  const [customColor, setCustomColor] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('general')
  const [goalValue, setGoalValue] = useState('')
  const [goalUnit, setGoalUnit] = useState('')
  const [reminderHour, setReminderHour] = useState(8)
  const [reminderMinute, setReminderMinute] = useState(0)
  const [enableReminder, setEnableReminder] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Erro', 'Dá um nome ao hábito!')
      return
    }

    const finalColor = customColor.match(/^#[0-9A-Fa-f]{6}$/) ? customColor : selectedColor

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.from('habits').insert({
      user_id: user?.id,
      name: name.trim(),
      icon: selectedIcon,
      color: finalColor,
      frequency: 'daily',
      category: selectedCategory,
      goal_value: goalValue ? parseFloat(goalValue) : null,
      goal_unit: goalUnit || null,
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
        <TouchableOpacity
          style={styles.unitBtn}
          onPress={() => setShowUnitPicker(true)}
        >
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
      style={[
        styles.colorBtn,
        { backgroundColor: color },
        selectedColor === color && styles.colorBtnSelected
      ]}
      onPress={() => setSelectedColor(color)}
    />
  ))}
  {/* Botão cor personalizada */}
  <TouchableOpacity
    style={[styles.colorBtn, styles.customColorBtn]}
    onPress={() => setShowColorPicker(true)}
  >
    <Ionicons name="color-palette" size={20} color="#888" />
  </TouchableOpacity>
</View>

{/* Preview da cor selecionada */}
<View style={styles.colorPreviewRow}>
  <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
  <Text style={styles.colorPreviewText}>{selectedColor}</Text>
</View>

{/* Modal Color Picker */}
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

      {/* Lembrete */}
      <View style={styles.reminderRow}>
        <View>
          <Text style={styles.label}>Lembrete diário</Text>
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
      )}

      {/* Botão criar */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: customColor.match(/^#[0-9A-Fa-f]{6}$/) ? customColor : selectedColor }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'A criar...' : `${selectedIcon} Criar Hábito`}
        </Text>
      </TouchableOpacity>

      {/* Modal de unidades */}
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 32, marginTop: 48 },
  label: { fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  labelSmall: { fontSize: 12, color: '#555', marginBottom: 8 },
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
  hexRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 24 },
  hexPreview: { width: 48, height: 48, borderRadius: 12 },
  reminderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  reminderSub: { fontSize: 12, color: '#555', marginTop: 2 },
  toggle: {
    backgroundColor: '#2e2e3e', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  toggleText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 },
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



  customColorBtn: {
  backgroundColor: '#1e1e2e', borderWidth: 2,
  borderColor: '#2e2e3e', borderStyle: 'dashed',
  justifyContent: 'center', alignItems: 'center',
},
colorPreviewRow: {
  flexDirection: 'row', alignItems: 'center',
  gap: 12, marginBottom: 24,
},
colorPreview: {
  width: 32, height: 32, borderRadius: 8,
},
colorPreviewText: { color: '#888', fontSize: 14 },
colorPickerModal: {
  backgroundColor: '#1e1e2e', borderTopLeftRadius: 24,
  borderTopRightRadius: 24, padding: 24,
},
})