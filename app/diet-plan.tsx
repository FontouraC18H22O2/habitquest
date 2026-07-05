import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useTheme } from "../lib/ThemeContext";
import { useTabBarHeight } from "../lib/useTabBarHeight";

type PlanMeal = {
  id: string;
  day_of_week: number;
  meal_type: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string | null;
};

const DAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MEAL_TYPES = [
  { id: "breakfast", label: "Pequeno-almoço", icon: "🌅" },
  { id: "lunch", label: "Almoço", icon: "☀️" },
  { id: "dinner", label: "Jantar", icon: "🌙" },
  { id: "snack", label: "Snack", icon: "🍎" },
];

const GOALS = [
  { id: "lose_weight", label: "Perder peso", icon: "⬇️" },
  { id: "maintain", label: "Manter peso", icon: "⚖️" },
  { id: "gain_muscle", label: "Ganhar músculo", icon: "💪" },
];

export default function DietPlan() {
  const { colors } = useTheme();
  const [plan, setPlan] = useState<PlanMeal[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("maintain");
  const [selectedMeal, setSelectedMeal] = useState<PlanMeal | null>(null);
  const [selectedMealType, setSelectedMealType] = useState("breakfast");
  const [editForm, setEditForm] = useState({
    meal_name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    notes: "",
  });
  const [addForm, setAddForm] = useState({
    meal_name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    notes: "",
  });
  const [restrictions, setRestrictions] = useState("");
  const tabBarHeight = useTabBarHeight();

  useEffect(() => {
    fetchPlan();
  }, []);

  async function fetchPlan() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("diet_plan")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week");
    if (data) setPlan(data);
    setLoading(false);
  }

  async function generatePlan() {
    setGenerating(true);
    setShowGoalModal(false);
    try {
      const { data: goalData } = await supabase
        .from("diet_goals")
        .select("daily_calories, daily_protein, daily_carbs, daily_fat")
        .single();
      const genAI = new GoogleGenerativeAI(
        process.env.EXPO_PUBLIC_GEMINI_API_KEY!,
      );
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const goalLabel =
        GOALS.find((g) => g.id === selectedGoal)?.label || "manter peso";
      const calories = goalData?.daily_calories || 2000;
      const protein = goalData?.daily_protein || 150;
      const carbs = goalData?.daily_carbs || 250;
      const fat = goalData?.daily_fat || 65;

      const prompt = `Cria um plano alimentar semanal completo em português Europeu para uma pessoa com o objetivo de "${goalLabel}".
      Metas diárias: ${calories} kcal, ${protein}g proteína, ${carbs}g hidratos, ${fat}g gordura.
      ${restrictions ? `Restrições alimentares: ${restrictions}` : ""}
      Responde APENAS com um array JSON válido, sem markdown, sem texto extra, com exatamente 28 objetos (4 refeições x 7 dias):
      [{"day_of_week": 0,"meal_type": "breakfast","meal_name": "nome da refeição","calories": 000,"protein": 00,"carbs": 00,"fat": 00,"notes": "dica ou nota opcional"}]
      day_of_week: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
      meal_type: "breakfast", "lunch", "dinner" ou "snack"
      Varia as refeições ao longo da semana. Usa comida portuguesa e mediterrânica.`;

      const result = await model.generateContent(prompt);
      const text = result.response
        .text()
        .trim()
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const meals = JSON.parse(text);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("diet_plan").delete().eq("user_id", user.id);
      await supabase
        .from("diet_plan")
        .insert(meals.map((m: any) => ({ ...m, user_id: user.id })));
      await fetchPlan();
      Alert.alert(
        "✅ Plano gerado!",
        "O teu plano semanal foi criado pela IA!",
      );
    } catch (e) {
      console.log(e);
      Alert.alert("Erro", "Não foi possível gerar o plano. Tenta novamente.");
    }
    setGenerating(false);
  }

  async function saveMealEdit() {
    if (!selectedMeal) return;
    const { error } = await supabase
      .from("diet_plan")
      .update({
        meal_name: editForm.meal_name,
        calories: parseInt(editForm.calories),
        protein: parseInt(editForm.protein),
        carbs: parseInt(editForm.carbs),
        fat: parseInt(editForm.fat),
        notes: editForm.notes || null,
      })
      .eq("id", selectedMeal.id);
    if (!error) {
      await fetchPlan();
      setShowEditModal(false);
      Alert.alert("✅ Refeição atualizada!");
    }
  }

  async function addMealToPlan() {
    if (!addForm.meal_name.trim()) {
      Alert.alert("Erro", "Dá um nome à refeição!");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("diet_plan").insert({
      user_id: user.id,
      day_of_week: selectedDay,
      meal_type: selectedMealType,
      meal_name: addForm.meal_name.trim(),
      calories: parseInt(addForm.calories) || 0,
      protein: parseInt(addForm.protein) || 0,
      carbs: parseInt(addForm.carbs) || 0,
      fat: parseInt(addForm.fat) || 0,
      notes: addForm.notes || null,
    });
    if (!error) {
      await fetchPlan();
      setShowAddModal(false);
      setAddForm({
        meal_name: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
        notes: "",
      });
      Alert.alert("✅ Refeição adicionada!");
    }
  }

  async function deleteMealFromPlan() {
    if (!selectedMeal) return;
    Alert.alert(
      "Apagar refeição",
      "Tens a certeza que queres apagar esta refeição do plano?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            await supabase.from("diet_plan").delete().eq("id", selectedMeal.id);
            await fetchPlan();
            setShowEditModal(false);
            Alert.alert("✅ Refeição apagada!");
          },
        },
      ],
    );
  }

  const dayMeals = plan.filter((m) => m.day_of_week === selectedDay);
  const dayCalories = dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          📋 Plano de Dieta
        </Text>
        <TouchableOpacity onPress={() => setShowGoalModal(true)}>
          <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {generating && (
        <View style={styles.generatingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.generatingText, { color: colors.text }]}>
            🤖 A IA está a criar o teu plano semanal...
          </Text>
          <Text
            style={[styles.generatingSubText, { color: colors.textSecondary }]}
          >
            Isto pode demorar alguns segundos
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daysRow}
      >
        {DAYS_SHORT.map((day, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.dayBtn,
              { backgroundColor: colors.card },
              selectedDay === i && { backgroundColor: colors.primary },
            ]}
            onPress={() => setSelectedDay(i)}
          >
            <Text
              style={[
                styles.dayText,
                { color: colors.textSecondary },
                selectedDay === i && { color: "#ffffff" },
              ]}
            >
              {day}
            </Text>
            {i === new Date().getDay() && <View style={styles.todayDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {dayMeals.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            {DAYS[selectedDay]}
          </Text>
          <Text style={[styles.summaryCalories, { color: colors.primary }]}>
            {dayCalories} kcal
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : dayMeals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Sem plano para este dia
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Gera um plano com IA ou adiciona as tuas refeições manualmente
          </Text>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowGoalModal(true)}
          >
            <Ionicons name="sparkles" size={20} color="#ffffff" />
            <Text style={styles.generateBtnText}>Gerar com IA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.generateBtn,
              {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.primary,
                marginTop: 8,
              },
            ]}
            onPress={() => {
              setSelectedMealType("breakfast");
              setAddForm({
                meal_name: "",
                calories: "",
                protein: "",
                carbs: "",
                fat: "",
                notes: "",
              });
              setShowAddModal(true);
            }}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={[styles.generateBtnText, { color: colors.primary }]}>
              Adicionar manualmente
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        MEAL_TYPES.map((mealType) => {
          const meal = dayMeals.find((m) => m.meal_type === mealType.id);
          return (
            <View key={mealType.id} style={styles.mealSection}>
              <Text
                style={[styles.mealTypeTitle, { color: colors.textSecondary }]}
              >
                {mealType.icon} {mealType.label}
              </Text>
              {meal ? (
                <TouchableOpacity
                  style={[styles.mealCard, { backgroundColor: colors.card }]}
                  onPress={() => {
                    setSelectedMeal(meal);
                    setEditForm({
                      meal_name: meal.meal_name,
                      calories: String(meal.calories),
                      protein: String(meal.protein),
                      carbs: String(meal.carbs),
                      fat: String(meal.fat),
                      notes: meal.notes || "",
                    });
                    setShowEditModal(true);
                  }}
                >
                  <View style={styles.mealCardInfo}>
                    <Text style={[styles.mealName, { color: colors.text }]}>
                      {meal.meal_name}
                    </Text>
                    {meal.notes && (
                      <Text
                        style={[
                          styles.mealNotes,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {meal.notes}
                      </Text>
                    )}
                    <View style={styles.mealMacros}>
                      <Text
                        style={[
                          styles.mealMacroText,
                          { color: colors.textMuted },
                        ]}
                      >
                        P: {meal.protein}g
                      </Text>
                      <Text
                        style={[
                          styles.mealMacroText,
                          { color: colors.textMuted },
                        ]}
                      >
                        H: {meal.carbs}g
                      </Text>
                      <Text
                        style={[
                          styles.mealMacroText,
                          { color: colors.textMuted },
                        ]}
                      >
                        G: {meal.fat}g
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mealCardRight}>
                    <Text
                      style={[styles.mealCalories, { color: colors.primary }]}
                    >
                      {meal.calories}
                    </Text>
                    <Text
                      style={[styles.mealKcal, { color: colors.textMuted }]}
                    >
                      kcal
                    </Text>
                    <Ionicons
                      name="pencil-outline"
                      size={14}
                      color={colors.textMuted}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.emptyMeal,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedMealType(mealType.id);
                    setAddForm({
                      meal_name: "",
                      calories: "",
                      protein: "",
                      carbs: "",
                      fat: "",
                      notes: "",
                    });
                    setShowAddModal(true);
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={24}
                    color={colors.textMuted}
                  />
                  <Text
                    style={[styles.emptyMealText, { color: colors.textMuted }]}
                  >
                    Adicionar refeição
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      {/* Modal objetivo */}
      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              🤖 Gerar plano com IA
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              A IA vai criar um plano semanal personalizado baseado nas tuas
              metas de dieta
            </Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Objetivo
            </Text>
            {GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.goalBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: "transparent",
                  },
                  selectedGoal === goal.id && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "11",
                  },
                ]}
                onPress={() => setSelectedGoal(goal.id)}
              >
                <Text style={styles.goalIcon}>{goal.icon}</Text>
                <Text
                  style={[
                    styles.goalLabel,
                    { color: colors.text },
                    selectedGoal === goal.id && { color: colors.primary },
                  ]}
                >
                  {goal.label}
                </Text>
                {selectedGoal === goal.id && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Restrições alimentares (opcional)
            </Text>
            <TextInput
              style={[
                styles.restrictionsInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Ex: sem glúten, vegetariano..."
              placeholderTextColor={colors.textSecondary}
              value={restrictions}
              onChangeText={setRestrictions}
              multiline
            />
            <Text style={styles.warningText}>
              ⚠️ Isto vai substituir o plano atual
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: colors.card2 },
                ]}
                onPress={() => setShowGoalModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={generatePlan}
              >
                <Ionicons name="sparkles" size={16} color="#ffffff" />
                <Text style={styles.modalConfirmText}>Gerar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal editar refeição */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            style={[styles.editModal, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              ✏️ Editar Refeição
            </Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Nome
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={editForm.meal_name}
              onChangeText={(v) => setEditForm((p) => ({ ...p, meal_name: v }))}
              placeholderTextColor={colors.textSecondary}
              placeholder="Nome da refeição"
            />
            <View style={styles.macroInputRow}>
              {[
                { key: "calories", label: "Kcal" },
                { key: "protein", label: "Proteína (g)" },
                { key: "carbs", label: "Hidratos (g)" },
                { key: "fat", label: "Gordura (g)" },
              ].map((field) => (
                <View key={field.key} style={styles.macroInputItem}>
                  <Text
                    style={[styles.modalLabel, { color: colors.textSecondary }]}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    style={[
                      styles.macroInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    value={editForm[field.key as keyof typeof editForm]}
                    onChangeText={(v) =>
                      setEditForm((p) => ({ ...p, [field.key]: v }))
                    }
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Notas
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  height: 80,
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={editForm.notes}
              onChangeText={(v) => setEditForm((p) => ({ ...p, notes: v }))}
              placeholderTextColor={colors.textSecondary}
              placeholder="Dica ou nota opcional"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.card2 }]}
                onPress={deleteMealFromPlan}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={colors.danger}
                />
                <Text style={[styles.deleteBtnText, { color: colors.danger }]}>
                  Apagar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: colors.card2 },
                ]}
                onPress={() => setShowEditModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={saveMealEdit}
              >
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal adicionar refeição */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            style={[styles.editModal, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              ➕ Nova Refeição
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {MEAL_TYPES.find((t) => t.id === selectedMealType)?.icon}{" "}
              {MEAL_TYPES.find((t) => t.id === selectedMealType)?.label} —{" "}
              {DAYS[selectedDay]}
            </Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Tipo de refeição
            </Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.mealTypeBtn,
                    {
                      backgroundColor: colors.background,
                      borderColor: "transparent",
                    },
                    selectedMealType === type.id && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + "22",
                    },
                  ]}
                  onPress={() => setSelectedMealType(type.id)}
                >
                  <Text style={styles.mealTypeIcon}>{type.icon}</Text>
                  <Text
                    style={[
                      styles.mealTypeLabelSmall,
                      { color: colors.textSecondary },
                      selectedMealType === type.id && { color: colors.primary },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Nome
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={addForm.meal_name}
              onChangeText={(v) => setAddForm((p) => ({ ...p, meal_name: v }))}
              placeholderTextColor={colors.textSecondary}
              placeholder="Ex: Frango grelhado com arroz"
              autoFocus
            />
            <View style={styles.macroInputRow}>
              {[
                { key: "calories", label: "Kcal" },
                { key: "protein", label: "Proteína (g)" },
                { key: "carbs", label: "Hidratos (g)" },
                { key: "fat", label: "Gordura (g)" },
              ].map((field) => (
                <View key={field.key} style={styles.macroInputItem}>
                  <Text
                    style={[styles.modalLabel, { color: colors.textSecondary }]}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    style={[
                      styles.macroInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    value={addForm[field.key as keyof typeof addForm]}
                    onChangeText={(v) =>
                      setAddForm((p) => ({ ...p, [field.key]: v }))
                    }
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                    placeholder="0"
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Notas (opcional)
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  height: 80,
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={addForm.notes}
              onChangeText={(v) => setAddForm((p) => ({ ...p, notes: v }))}
              placeholderTextColor={colors.textSecondary}
              placeholder="Dica ou nota opcional"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: colors.card2 },
                ]}
                onPress={() => {
                  setShowAddModal(false);
                  setAddForm({
                    meal_name: "",
                    calories: "",
                    protein: "",
                    carbs: "",
                    fat: "",
                    notes: "",
                  });
                }}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={addMealToPlan}
              >
                <Text style={styles.modalConfirmText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  generatingContainer: { alignItems: "center", padding: 32, gap: 12 },
  generatingText: { fontSize: 16, fontWeight: "bold", textAlign: "center" },
  generatingSubText: { fontSize: 13, textAlign: "center" },
  daysRow: { marginBottom: 20 },
  dayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    alignItems: "center",
  },
  dayText: { fontWeight: "bold", fontSize: 13 },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#43e97b",
    marginTop: 4,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: { fontSize: 18, fontWeight: "bold" },
  summaryCalories: { fontSize: 20, fontWeight: "bold" },
  emptyContainer: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyText: { fontSize: 18, fontWeight: "bold" },
  emptySub: { fontSize: 14, textAlign: "center" },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  generateBtnText: { color: "#ffffff", fontWeight: "bold", fontSize: 16 },
  mealSection: { marginBottom: 20 },
  mealTypeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mealCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  mealCardInfo: { flex: 1 },
  mealName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  mealNotes: { fontSize: 12, marginBottom: 8, fontStyle: "italic" },
  mealMacros: { flexDirection: "row", gap: 12 },
  mealMacroText: { fontSize: 12 },
  mealCardRight: { alignItems: "center" },
  mealCalories: { fontSize: 22, fontWeight: "bold" },
  mealKcal: { fontSize: 11 },
  emptyMeal: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyMealText: { fontSize: 14, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  editModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 8 },
  modalSub: { fontSize: 14, marginBottom: 24 },
  modalLabel: {
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  goalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
  },
  goalIcon: { fontSize: 24 },
  goalLabel: { flex: 1, fontSize: 16 },
  restrictionsInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 16,
    minHeight: 80,
  },
  warningText: { color: "#f7971e", fontSize: 12, marginBottom: 16 },
  editInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  macroInputRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  macroInputItem: { width: "47%" },
  macroInput: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1 },
  mealTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  mealTypeBtn: {
    flex: 1,
    minWidth: 70,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  mealTypeIcon: { fontSize: 20, marginBottom: 4 },
  mealTypeLabelSmall: { fontSize: 10, textAlign: "center" },
  modalButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 32,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ff6584",
  },
  deleteBtnText: { fontWeight: "bold", fontSize: 13 },
  modalCancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "bold" },
  modalConfirmBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modalConfirmText: { color: "#ffffff", fontWeight: "bold" },
});
