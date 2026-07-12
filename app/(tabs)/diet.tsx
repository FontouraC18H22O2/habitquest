import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, Image, ActivityIndicator
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { useTheme } from '../../lib/ThemeContext'
import { useTabBarHeight } from '../../lib/useTabBarHeight'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Meal = {
  id: string
  name: string
  photo_url: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  meal_type: string
  eaten_at: string
}

type DietGoal = {
  daily_calories: number
  daily_protein: number
  daily_carbs: number
  daily_fat: number
}

const MEAL_TYPES = [
  { id: 'breakfast', label: 'breakfast', icon: '🌅' },
  { id: 'lunch', label: 'lunch', icon: '☀️' },
  { id: 'dinner', label: 'dinner', icon: '🌙' },
  { id: 'snack', label: 'snack', icon: '🍎' },
]

export default function Diet() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const tabBarHeight = useTabBarHeight()
  const insets = useSafeAreaInsets()
  const [meals, setMeals] = useState<Meal[]>([])
  const [goal, setGoal] = useState<DietGoal>({ daily_calories: 2000, daily_protein: 150, daily_carbs: 250, daily_fat: 65 })
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedMealType, setSelectedMealType] = useState('lunch')
  const [aiResult, setAiResult] = useState<{ name: string; calories: number; protein: number; carbs: number; fat: number } | null>(null)
  const [goalInputs, setGoalInputs] = useState({ calories: '2000', protein: '150', carbs: '250', fat: '65' })

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const todayDayOfWeek = new Date().getDay()

    const { data: mealsData } = await supabase
      .from('meals').select('*').eq('user_id', user.id)
      .gte('eaten_at', `${today}T00:00:00`).lte('eaten_at', `${today}T23:59:59`)
      .order('eaten_at', { ascending: false })

    if (mealsData) setMeals(mealsData)

    const { data: goalData } = await supabase.from('diet_goals').select('*').eq('user_id', user.id).single()

    const { data: planData } = await supabase
      .from('diet_plan').select('calories, protein, carbs, fat')
      .eq('user_id', user.id).eq('day_of_week', todayDayOfWeek)

    if (planData && planData.length > 0) {
      setGoal({
        daily_calories: planData.reduce((sum, m) => sum + (m.calories || 0), 0),
        daily_protein: planData.reduce((sum, m) => sum + (m.protein || 0), 0),
        daily_carbs: planData.reduce((sum, m) => sum + (m.carbs || 0), 0),
        daily_fat: planData.reduce((sum, m) => sum + (m.fat || 0), 0),
      })
    } else if (goalData) {
      setGoal(goalData)
      setGoalInputs({
        calories: String(goalData.daily_calories),
        protein: String(goalData.daily_protein),
        carbs: String(goalData.daily_carbs),
        fat: String(goalData.daily_fat),
      })
    }

    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, []))

  async function analyzeWithGemini(imageUri: string) {
    setAnalyzing(true)
    try {
      const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })
      const response = await fetch(imageUri)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })
      const prompt = `Analisa esta imagem de comida e estima os valores nutricionais. 
      Responde APENAS em formato JSON válido, sem markdown, sem texto extra, exatamente assim:
      {"name":"nome do prato em português","calories":000,"protein":00,"carbs":00,"fat":00}
      Se não conseguires identificar comida na imagem, responde: {"error":"Não foi possível identificar comida na imagem"}`
      const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: 'image/jpeg' } }])
      const text = result.response.text().trim()
      const parsed = JSON.parse(text)
      if (parsed.error) { Alert.alert('Erro', parsed.error); setAnalyzing(false); return }
      setAiResult(parsed)
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível analisar a imagem. Tenta novamente.')
    }
    setAnalyzing(false)
  }

  async function takePicture() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão negada', 'Precisamos de acesso à câmara!'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7 })
    if (!result.canceled) { setSelectedImage(result.assets[0].uri); setAiResult(null); await analyzeWithGemini(result.assets[0].uri) }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão negada', 'Precisamos de acesso à galeria!'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7 })
    if (!result.canceled) { setSelectedImage(result.assets[0].uri); setAiResult(null); await analyzeWithGemini(result.assets[0].uri) }
  }

  async function saveMeal() {
    if (!aiResult) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let photoUrl = null
    if (selectedImage) {
      const formData = new FormData()
      formData.append('file', { uri: selectedImage, name: 'meal.jpg', type: 'image/jpeg' } as any)
      const filename = `${user.id}/meals/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('habit-photos').upload(filename, formData, { contentType: 'image/jpeg' })
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('habit-photos').getPublicUrl(filename)
        photoUrl = publicUrl
      }
    }
    const { error } = await supabase.from('meals').insert({
      user_id: user.id, name: aiResult.name, photo_url: photoUrl,
      calories: aiResult.calories, protein: aiResult.protein, carbs: aiResult.carbs, fat: aiResult.fat, meal_type: selectedMealType,
    })
    if (error) { Alert.alert('Erro', error.message) }
    else { setShowAddModal(false); setSelectedImage(null); setAiResult(null); fetchData(); Alert.alert(t('meal_saved')) }
  }

  async function saveGoal() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const newGoal = {
      user_id: user.id,
      daily_calories: parseInt(goalInputs.calories),
      daily_protein: parseInt(goalInputs.protein),
      daily_carbs: parseInt(goalInputs.carbs),
      daily_fat: parseInt(goalInputs.fat),
    }
    const { data: existing } = await supabase.from('diet_goals').select('id').eq('user_id', user.id).single()
    if (existing) { await supabase.from('diet_goals').update(newGoal).eq('user_id', user.id) }
    else { await supabase.from('diet_goals').insert(newGoal) }
    setGoal(newGoal)
    setShowGoalModal(false)
    Alert.alert(t('goal_updated'))
  }

  async function deleteMeal(id: string) {
    Alert.alert(t('delete_meal'), t('delete_meal_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { await supabase.from('meals').delete().eq('id', id); fetchData() } }
    ])
  }

  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0)
  const totalProtein = meals.reduce((sum, m) => sum + (m.protein || 0), 0)
  const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0)
  const totalFat = meals.reduce((sum, m) => sum + (m.fat || 0), 0)
  const caloriesPercent = Math.min((totalCalories / goal.daily_calories) * 100, 100)

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('diet')}</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push('/diet-plan' as any)} style={{ marginRight: 16 }}>
            <Ionicons name="calendar-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowGoalModal(true)}>
            <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.caloriesCard, { backgroundColor: colors.card }]}>
        <View style={styles.caloriesRow}>
          <View>
            <Text style={[styles.caloriesValue, { color: colors.text }]}>{totalCalories}</Text>
            <Text style={[styles.caloriesLabel, { color: colors.textSecondary }]}>{t('calories_consumed')}</Text>
          </View>
          <View style={[styles.caloriesDivider, { backgroundColor: colors.card2 }]} />
          <View>
            <Text style={[styles.caloriesValue, { color: colors.text }]}>{goal.daily_calories - totalCalories}</Text>
            <Text style={[styles.caloriesLabel, { color: colors.textSecondary }]}>{t('calories_remaining')}</Text>
          </View>
          <View style={[styles.caloriesDivider, { backgroundColor: colors.card2 }]} />
          <View>
            <Text style={[styles.caloriesValue, { color: colors.text }]}>{goal.daily_calories}</Text>
            <Text style={[styles.caloriesLabel, { color: colors.textSecondary }]}>{t('calories_goal')}</Text>
          </View>
        </View>
        <View style={[styles.caloriesBar, { backgroundColor: colors.card2 }]}>
          <View style={[styles.caloriesBarFill, {
            width: `${caloriesPercent}%`,
            backgroundColor: caloriesPercent > 90 ? colors.danger : colors.success
          }]} />
        </View>
      </View>

      <View style={styles.macrosRow}>
        {[
          { label: t('protein'), value: totalProtein, goal: goal.daily_protein, color: '#4facfe' },
          { label: t('carbs'), value: totalCarbs, goal: goal.daily_carbs, color: '#f7971e' },
          { label: t('fat'), value: totalFat, goal: goal.daily_fat, color: colors.danger },
        ].map(macro => (
          <View key={macro.label} style={[styles.macroCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.macroValue, { color: colors.text }]}>{macro.value}g</Text>
            <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>{macro.label}</Text>
            <View style={[styles.macroBar, { backgroundColor: colors.card2 }]}>
              <View style={[styles.macroBarFill, { width: `${Math.min((macro.value / macro.goal) * 100, 100)}%`, backgroundColor: macro.color }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.mealsHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('todays_meals')}</Text>
        <TouchableOpacity style={[styles.addMealBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addMealText}>{t('add')}</Text>
        </TouchableOpacity>
      </View>

      {meals.length === 0 ? (
        <View style={styles.emptyMeals}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_meals')}</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t('no_meals_sub')}</Text>
        </View>
      ) : (
        meals.map(meal => (
          <TouchableOpacity key={meal.id} style={[styles.mealCard, { backgroundColor: colors.card }]} onLongPress={() => deleteMeal(meal.id)}>
            {meal.photo_url && <Image source={{ uri: meal.photo_url }} style={styles.mealPhoto} />}
            <View style={styles.mealInfo}>
              <Text style={[styles.mealName, { color: colors.text }]}>{meal.name}</Text>
              <Text style={[styles.mealType, { color: colors.textSecondary }]}>
                {MEAL_TYPES.find(mt => mt.id === meal.meal_type)?.icon} {t(meal.meal_type)}
              </Text>
              <View style={styles.mealMacros}>
                <Text style={[styles.mealMacroText, { color: colors.textMuted }]}>P: {meal.protein}g</Text>
                <Text style={[styles.mealMacroText, { color: colors.textMuted }]}>H: {meal.carbs}g</Text>
                <Text style={[styles.mealMacroText, { color: colors.textMuted }]}>G: {meal.fat}g</Text>
              </View>
            </View>
            <Text style={[styles.mealCalories, { color: colors.primary }]}>{meal.calories} kcal</Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('hold_to_delete')}</Text>

      {/* Modal adicionar refeição */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            style={[styles.addModal, { backgroundColor: colors.card }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('new_meal')}</Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('meal_type')}</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.mealTypeBtn, { backgroundColor: colors.background, borderColor: 'transparent' },
                    selectedMealType === type.id && { borderColor: colors.primary, backgroundColor: colors.primary + '22' }]}
                  onPress={() => setSelectedMealType(type.id)}
                >
                  <Text style={styles.mealTypeIcon}>{type.icon}</Text>
                  <Text style={[styles.mealTypeLabelSmall, { color: colors.textSecondary },
                    selectedMealType === type.id && { color: colors.primary }]}>{t(type.id)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('meal_photo')}</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.primary }]} onPress={takePicture}>
                <Ionicons name="camera" size={24} color="#ffffff" />
                <Text style={styles.photoBtnText}>{t('camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }]} onPress={pickFromGallery}>
                <Ionicons name="images" size={24} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>{t('gallery')}</Text>
              </TouchableOpacity>
            </View>

            {selectedImage && <Image source={{ uri: selectedImage }} style={styles.imagePreview} />}

            {analyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.analyzingText, { color: colors.textSecondary }]}>{t('ai_analyzing')}</Text>
              </View>
            )}

            {aiResult && (
              <View style={[styles.aiResult, { backgroundColor: colors.background }]}>
                <Text style={[styles.aiResultTitle, { color: colors.primary }]}>{t('ai_analysis')}</Text>
                <Text style={[styles.aiResultName, { color: colors.text }]}>{aiResult.name}</Text>
                <View style={styles.aiMacros}>
                  {[
                    { value: aiResult.calories, label: 'kcal' },
                    { value: `${aiResult.protein}g`, label: t('protein') },
                    { value: `${aiResult.carbs}g`, label: t('carbs') },
                    { value: `${aiResult.fat}g`, label: t('fat') },
                  ].map(item => (
                    <View key={item.label} style={styles.aiMacroItem}>
                      <Text style={[styles.aiMacroValue, { color: colors.text }]}>{item.value}</Text>
                      <Text style={[styles.aiMacroLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.aiDisclaimer, { color: colors.textMuted }]}>{t('ai_disclaimer')}</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: colors.card2 }]}
                onPress={() => { setShowAddModal(false); setSelectedImage(null); setAiResult(null) }}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: !aiResult ? colors.card2 : colors.primary }]} onPress={saveMeal} disabled={!aiResult}>
                <Text style={styles.modalConfirmText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal metas */}
      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.goalModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('daily_goals')}</Text>
            {[
              { key: 'calories', label: t('calories_kcal') },
              { key: 'protein', label: t('protein_g') },
              { key: 'carbs', label: t('carbs_g') },
              { key: 'fat', label: t('fat_g') },
            ].map(field => (
              <View key={field.key} style={styles.goalField}>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                <TextInput
                  style={[styles.goalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={goalInputs[field.key as keyof typeof goalInputs]}
                  onChangeText={v => setGoalInputs(prev => ({ ...prev, [field.key]: v }))}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            ))}
            <View style={[styles.modalButtons, { paddingBottom: insets.bottom }]}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: colors.card2 }]} onPress={() => setShowGoalModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]} onPress={saveGoal}>
                <Text style={styles.modalConfirmText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  caloriesCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  caloriesValue: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  caloriesLabel: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  caloriesDivider: { width: 1, height: 40 },
  caloriesBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  caloriesBarFill: { height: '100%', borderRadius: 4 },
  macrosRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  macroCard: { flex: 1, borderRadius: 16, padding: 12 },
  macroValue: { fontSize: 18, fontWeight: 'bold' },
  macroLabel: { fontSize: 11, marginBottom: 8 },
  macroBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 2 },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addMealText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  emptyMeals: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center' },
  mealCard: { borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealPhoto: { width: 64, height: 64, borderRadius: 12 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  mealType: { fontSize: 12, marginBottom: 6 },
  mealMacros: { flexDirection: 'row', gap: 8 },
  mealMacroText: { fontSize: 11 },
  mealCalories: { fontSize: 16, fontWeight: 'bold' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  addModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  goalModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  modalLabel: { fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  mealTypeBtn: { flex: 1, minWidth: 70, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 2 },
  mealTypeIcon: { fontSize: 20, marginBottom: 4 },
  mealTypeLabelSmall: { fontSize: 10, textAlign: 'center' },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14 },
  photoBtnText: { color: '#ffffff', fontWeight: 'bold' },
  imagePreview: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
  analyzingContainer: { alignItems: 'center', padding: 24, gap: 12 },
  analyzingText: { fontSize: 14, textAlign: 'center' },
  aiResult: { borderRadius: 16, padding: 16, marginBottom: 24 },
  aiResultTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  aiResultName: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  aiMacros: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  aiMacroItem: { alignItems: 'center' },
  aiMacroValue: { fontSize: 20, fontWeight: 'bold' },
  aiMacroLabel: { fontSize: 11, marginTop: 2 },
  aiDisclaimer: { fontSize: 11, fontStyle: 'italic' },
  goalField: { marginBottom: 16 },
  goalInput: { borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  modalCancelBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalCancelText: { fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalConfirmText: { color: '#ffffff', fontWeight: 'bold' },
})