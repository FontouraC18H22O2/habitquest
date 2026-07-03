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
  { id: 'breakfast', label: 'Pequeno-almoço', icon: '🌅' },
  { id: 'lunch', label: 'Almoço', icon: '☀️' },
  { id: 'dinner', label: 'Jantar', icon: '🌙' },
  { id: 'snack', label: 'Snack', icon: '🍎' },
]

export default function Diet() {
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

    const { data: mealsData } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .gte('eaten_at', `${today}T00:00:00`)
      .lte('eaten_at', `${today}T23:59:59`)
      .order('eaten_at', { ascending: false })

    if (mealsData) setMeals(mealsData)

    const { data: goalData } = await supabase
      .from('diet_goals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (goalData) {
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
      
      Onde:
      - name: nome do prato em português
      - calories: calorias totais (número inteiro)
      - protein: proteínas em gramas (número inteiro)
      - carbs: hidratos de carbono em gramas (número inteiro)
      - fat: gorduras em gramas (número inteiro)
      
      Se não conseguires identificar comida na imagem, responde: {"error":"Não foi possível identificar comida na imagem"}`

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: 'image/jpeg' } }
      ])

      const text = result.response.text().trim()
      const parsed = JSON.parse(text)

      if (parsed.error) {
        Alert.alert('Erro', parsed.error)
        setAnalyzing(false)
        return
      }

      setAiResult(parsed)
    } catch (e: any) {
      console.log('Erro:', e?.message)
      Alert.alert('Erro', 'Não foi possível analisar a imagem. Tenta novamente.')
    }
    setAnalyzing(false)
  }

  async function takePicture() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Precisamos de acesso à câmara!')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri)
      setAiResult(null)
      await analyzeWithGemini(result.assets[0].uri)
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Precisamos de acesso à galeria!')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri)
      setAiResult(null)
      await analyzeWithGemini(result.assets[0].uri)
    }
  }

  async function saveMeal() {
    if (!aiResult) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let photoUrl = null

    if (selectedImage) {
      const formData = new FormData()
      formData.append('file', {
        uri: selectedImage,
        name: 'meal.jpg',
        type: 'image/jpeg',
      } as any)

      const filename = `${user.id}/meals/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('habit-photos')
        .upload(filename, formData, { contentType: 'image/jpeg' })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('habit-photos')
          .getPublicUrl(filename)
        photoUrl = publicUrl
      }
    }

    const { error } = await supabase.from('meals').insert({
      user_id: user.id,
      name: aiResult.name,
      photo_url: photoUrl,
      calories: aiResult.calories,
      protein: aiResult.protein,
      carbs: aiResult.carbs,
      fat: aiResult.fat,
      meal_type: selectedMealType,
    })

    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      setShowAddModal(false)
      setSelectedImage(null)
      setAiResult(null)
      fetchData()
      Alert.alert('✅ Refeição guardada!')
    }
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

    const { data: existing } = await supabase
      .from('diet_goals')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase.from('diet_goals').update(newGoal).eq('user_id', user.id)
    } else {
      await supabase.from('diet_goals').insert(newGoal)
    }

    setGoal(newGoal)
    setShowGoalModal(false)
    Alert.alert('✅ Meta atualizada!')
  }

  async function deleteMeal(id: string) {
    Alert.alert('Apagar refeição', 'Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive',
        onPress: async () => {
          await supabase.from('meals').delete().eq('id', id)
          fetchData()
        }
      }
    ])
  }

  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0)
  const totalProtein = meals.reduce((sum, m) => sum + (m.protein || 0), 0)
  const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0)
  const totalFat = meals.reduce((sum, m) => sum + (m.fat || 0), 0)
  const caloriesPercent = Math.min((totalCalories / goal.daily_calories) * 100, 100)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🥗 Dieta</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push('/diet-plan' as any)} style={{ marginRight: 16 }}>
            <Ionicons name="calendar-outline" size={24} color="#6c63ff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowGoalModal(true)}>
            <Ionicons name="settings-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card de calorias */}
      <View style={styles.caloriesCard}>
        <View style={styles.caloriesRow}>
          <View>
            <Text style={styles.caloriesValue}>{totalCalories}</Text>
            <Text style={styles.caloriesLabel}>kcal consumidas</Text>
          </View>
          <View style={styles.caloriesDivider} />
          <View>
            <Text style={styles.caloriesValue}>{goal.daily_calories - totalCalories}</Text>
            <Text style={styles.caloriesLabel}>kcal restantes</Text>
          </View>
          <View style={styles.caloriesDivider} />
          <View>
            <Text style={styles.caloriesValue}>{goal.daily_calories}</Text>
            <Text style={styles.caloriesLabel}>kcal meta</Text>
          </View>
        </View>
        <View style={styles.caloriesBar}>
          <View style={[styles.caloriesBarFill, {
            width: `${caloriesPercent}%`,
            backgroundColor: caloriesPercent > 90 ? '#ff6584' : '#43e97b'
          }]} />
        </View>
      </View>

      {/* Macros */}
      <View style={styles.macrosRow}>
        <View style={styles.macroCard}>
          <Text style={styles.macroValue}>{totalProtein}g</Text>
          <Text style={styles.macroLabel}>Proteína</Text>
          <View style={styles.macroBar}>
            <View style={[styles.macroBarFill, {
              width: `${Math.min((totalProtein / goal.daily_protein) * 100, 100)}%`,
              backgroundColor: '#4facfe'
            }]} />
          </View>
        </View>
        <View style={styles.macroCard}>
          <Text style={styles.macroValue}>{totalCarbs}g</Text>
          <Text style={styles.macroLabel}>Hidratos</Text>
          <View style={styles.macroBar}>
            <View style={[styles.macroBarFill, {
              width: `${Math.min((totalCarbs / goal.daily_carbs) * 100, 100)}%`,
              backgroundColor: '#f7971e'
            }]} />
          </View>
        </View>
        <View style={styles.macroCard}>
          <Text style={styles.macroValue}>{totalFat}g</Text>
          <Text style={styles.macroLabel}>Gordura</Text>
          <View style={styles.macroBar}>
            <View style={[styles.macroBarFill, {
              width: `${Math.min((totalFat / goal.daily_fat) * 100, 100)}%`,
              backgroundColor: '#ff6584'
            }]} />
          </View>
        </View>
      </View>

      {/* Lista de refeições */}
      <View style={styles.mealsHeader}>
        <Text style={styles.sectionTitle}>Refeições de hoje</Text>
        <TouchableOpacity style={styles.addMealBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addMealText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {meals.length === 0 ? (
        <View style={styles.emptyMeals}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyText}>Ainda não registaste refeições hoje</Text>
          <Text style={styles.emptySub}>Tira uma foto à tua refeição e a IA analisa as kcal!</Text>
        </View>
      ) : (
        meals.map(meal => (
          <TouchableOpacity
            key={meal.id}
            style={styles.mealCard}
            onLongPress={() => deleteMeal(meal.id)}
          >
            {meal.photo_url && (
              <Image source={{ uri: meal.photo_url }} style={styles.mealPhoto} />
            )}
            <View style={styles.mealInfo}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealType}>
                {MEAL_TYPES.find(t => t.id === meal.meal_type)?.icon} {MEAL_TYPES.find(t => t.id === meal.meal_type)?.label}
              </Text>
              <View style={styles.mealMacros}>
                <Text style={styles.mealMacroText}>P: {meal.protein}g</Text>
                <Text style={styles.mealMacroText}>H: {meal.carbs}g</Text>
                <Text style={styles.mealMacroText}>G: {meal.fat}g</Text>
              </View>
            </View>
            <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.hint}>💡 Mantém pressionado para apagar uma refeição</Text>

      {/* Modal adicionar refeição */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.addModal}>
            <Text style={styles.modalTitle}>Nova Refeição</Text>

            <Text style={styles.modalLabel}>Tipo</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.mealTypeBtn, selectedMealType === type.id && styles.mealTypeBtnActive]}
                  onPress={() => setSelectedMealType(type.id)}
                >
                  <Text style={styles.mealTypeIcon}>{type.icon}</Text>
                  <Text style={[styles.mealTypeLabelSmall, selectedMealType === type.id && { color: '#6c63ff' }]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Foto da refeição</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePicture}>
                <Ionicons name="camera" size={24} color="#ffffff" />
                <Text style={styles.photoBtnText}>Câmara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoBtn, styles.photoBtnOutline]} onPress={pickFromGallery}>
                <Ionicons name="images" size={24} color="#6c63ff" />
                <Text style={[styles.photoBtnText, { color: '#6c63ff' }]}>Galeria</Text>
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            )}

            {analyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color="#6c63ff" />
                <Text style={styles.analyzingText}>🤖 A IA está a analisar a tua refeição...</Text>
              </View>
            )}

            {aiResult && (
              <View style={styles.aiResult}>
                <Text style={styles.aiResultTitle}>🤖 Análise da IA</Text>
                <Text style={styles.aiResultName}>{aiResult.name}</Text>
                <View style={styles.aiMacros}>
                  <View style={styles.aiMacroItem}>
                    <Text style={styles.aiMacroValue}>{aiResult.calories}</Text>
                    <Text style={styles.aiMacroLabel}>kcal</Text>
                  </View>
                  <View style={styles.aiMacroItem}>
                    <Text style={styles.aiMacroValue}>{aiResult.protein}g</Text>
                    <Text style={styles.aiMacroLabel}>Proteína</Text>
                  </View>
                  <View style={styles.aiMacroItem}>
                    <Text style={styles.aiMacroValue}>{aiResult.carbs}g</Text>
                    <Text style={styles.aiMacroLabel}>Hidratos</Text>
                  </View>
                  <View style={styles.aiMacroItem}>
                    <Text style={styles.aiMacroValue}>{aiResult.fat}g</Text>
                    <Text style={styles.aiMacroLabel}>Gordura</Text>
                  </View>
                </View>
                <Text style={styles.aiDisclaimer}>* Valores estimados pela IA, podem não ser 100% precisos</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddModal(false)
                  setSelectedImage(null)
                  setAiResult(null)
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !aiResult && styles.modalConfirmBtnDisabled]}
                onPress={saveMeal}
                disabled={!aiResult}
              >
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal metas */}
      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.goalModal}>
            <Text style={styles.modalTitle}>🎯 Metas diárias</Text>
            {[
              { key: 'calories', label: 'Calorias (kcal)' },
              { key: 'protein', label: 'Proteína (g)' },
              { key: 'carbs', label: 'Hidratos (g)' },
              { key: 'fat', label: 'Gordura (g)' },
            ].map(field => (
              <View key={field.key} style={styles.goalField}>
                <Text style={styles.modalLabel}>{field.label}</Text>
                <TextInput
                  style={styles.goalInput}
                  value={goalInputs[field.key as keyof typeof goalInputs]}
                  onChangeText={v => setGoalInputs(prev => ({ ...prev, [field.key]: v }))}
                  keyboardType="numeric"
                  placeholderTextColor="#888"
                />
              </View>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowGoalModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={saveGoal}>
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 20, paddingTop: 56 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  caloriesCard: { backgroundColor: '#1e1e2e', borderRadius: 20, padding: 20, marginBottom: 16 },
  caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  caloriesValue: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  caloriesLabel: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 2 },
  caloriesDivider: { width: 1, height: 40, backgroundColor: '#2e2e3e' },
  caloriesBar: { height: 8, backgroundColor: '#2e2e3e', borderRadius: 4, overflow: 'hidden' },
  caloriesBarFill: { height: '100%', borderRadius: 4 },
  macrosRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  macroCard: { flex: 1, backgroundColor: '#1e1e2e', borderRadius: 16, padding: 12 },
  macroValue: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  macroLabel: { fontSize: 11, color: '#888', marginBottom: 8 },
  macroBar: { height: 4, backgroundColor: '#2e2e3e', borderRadius: 2, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 2 },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  addMealBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#6c63ff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  addMealText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  emptyMeals: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  emptySub: { color: '#888', fontSize: 13, textAlign: 'center' },
  mealCard: {
    backgroundColor: '#1e1e2e', borderRadius: 16, padding: 16,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  mealPhoto: { width: 64, height: 64, borderRadius: 12 },
  mealInfo: { flex: 1 },
  mealName: { color: '#ffffff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  mealType: { color: '#888', fontSize: 12, marginBottom: 6 },
  mealMacros: { flexDirection: 'row', gap: 8 },
  mealMacroText: { color: '#555', fontSize: 11 },
  mealCalories: { color: '#6c63ff', fontSize: 16, fontWeight: 'bold' },
  hint: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  addModal: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  goalModal: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 24 },
  modalLabel: { fontSize: 13, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  mealTypeBtn: {
    flex: 1, minWidth: 70, alignItems: 'center', padding: 10,
    backgroundColor: '#0f0f1a', borderRadius: 12, borderWidth: 2, borderColor: 'transparent',
  },
  mealTypeBtnActive: { borderColor: '#6c63ff', backgroundColor: '#6c63ff22' },
  mealTypeIcon: { fontSize: 20, marginBottom: 4 },
  mealTypeLabelSmall: { fontSize: 10, color: '#888', textAlign: 'center' },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#6c63ff', borderRadius: 12, padding: 14,
  },
  photoBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6c63ff' },
  photoBtnText: { color: '#ffffff', fontWeight: 'bold' },
  imagePreview: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
  analyzingContainer: { alignItems: 'center', padding: 24, gap: 12 },
  analyzingText: { color: '#888', fontSize: 14, textAlign: 'center' },
  aiResult: { backgroundColor: '#0f0f1a', borderRadius: 16, padding: 16, marginBottom: 24 },
  aiResultTitle: { fontSize: 14, color: '#6c63ff', fontWeight: 'bold', marginBottom: 8 },
  aiResultName: { fontSize: 18, color: '#ffffff', fontWeight: 'bold', marginBottom: 16 },
  aiMacros: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  aiMacroItem: { alignItems: 'center' },
  aiMacroValue: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  aiMacroLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  aiDisclaimer: { color: '#555', fontSize: 11, fontStyle: 'italic' },
  goalField: { marginBottom: 16 },
  goalInput: {
    backgroundColor: '#0f0f1a', borderRadius: 12, padding: 16,
    color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: '#2e2e3e',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  modalCancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#2e2e3e', alignItems: 'center' },
  modalCancelText: { color: '#888', fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#6c63ff', alignItems: 'center' },
  modalConfirmBtnDisabled: { backgroundColor: '#2e2e3e' },
  modalConfirmText: { color: '#ffffff', fontWeight: 'bold' },
})