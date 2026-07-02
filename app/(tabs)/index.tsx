import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  completed: boolean;
};

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState("");

  async function fetchHabits() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Buscar perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    if (profile) setUsername(profile.username);

    // Buscar hábitos
    const { data: habitsData } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false);

    if (!habitsData) return;

    // Ver quais foram completados hoje
    const today = new Date().toISOString().split("T")[0];
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id")
      .gte("completed_at", `${today}T00:00:00`)
      .lte("completed_at", `${today}T23:59:59`);

    const completedIds = new Set(logs?.map((l) => l.habit_id) || []);

    setHabits(
      habitsData.map((h) => ({
        ...h,
        completed: completedIds.has(h.id),
      })),
    );
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      fetchHabits();
    }, []),
  );

  async function toggleHabit(habit: Habit) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    if (habit.completed) {
      // Remover log de hoje
      await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", habit.id)
        .gte("completed_at", `${today}T00:00:00`)
        .lte("completed_at", `${today}T23:59:59`);
    } else {
      // Adicionar log
      await supabase.from("habit_logs").insert({ habit_id: habit.id });

      // Dar XP ao utilizador
      await supabase.rpc("increment_xp", { user_id: user.id, amount: 10 });
    }

    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id ? { ...h, completed: !h.completed } : h,
      ),
    );
  }

  const completed = habits.filter((h) => h.completed).length;
  const total = habits.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Olá, {username || "aventureiro"} 👋
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("pt-PT", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/create-habit")}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Progresso do dia */}
      {total > 0 && (
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {completed}/{total} hábitos completos hoje
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completed / total) * 100}%` },
              ]}
            />
          </View>
          {completed === total && (
            <Text style={styles.allDone}>
              🎉 Completaste todos os hábitos hoje!
            </Text>
          )}
        </View>
      )}

      {/* Lista de hábitos */}
      {loading ? (
        <Text style={styles.emptyText}>A carregar...</Text>
      ) : habits.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyText}>Ainda não tens hábitos!</Text>
          <Text style={styles.emptySub}>
            Clica no + para criar o teu primeiro hábito
          </Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchHabits} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.habitCard, item.completed && styles.habitCardDone]}
              onPress={() => toggleHabit(item)}
              onLongPress={() => router.push(`/habit/${item.id}` as any)}
            >
              <View
                style={[
                  styles.habitIcon,
                  { backgroundColor: item.color + "33" },
                ]}
              >
                <Text style={styles.habitEmoji}>{item.icon}</Text>
              </View>
              <Text
                style={[
                  styles.habitName,
                  item.completed && styles.habitNameDone,
                ]}
              >
                {item.name}
              </Text>
              <View
                style={[
                  styles.checkbox,
                  item.completed && {
                    backgroundColor: item.color,
                    borderColor: item.color,
                  },
                ]}
              >
                {item.completed && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1a",
    padding: 20,
    paddingTop: 56,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#ffffff" },
  date: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
    textTransform: "capitalize",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6c63ff",
    justifyContent: "center",
    alignItems: "center",
  },
  progressCard: {
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  progressText: { color: "#ffffff", fontSize: 14, marginBottom: 10 },
  progressBar: {
    height: 8,
    backgroundColor: "#2e2e3e",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#6c63ff", borderRadius: 4 },
  allDone: {
    color: "#43e97b",
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySub: { color: "#888", fontSize: 14, textAlign: "center" },
  habitCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  habitCardDone: { opacity: 0.6 },
  habitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  habitEmoji: { fontSize: 22 },
  habitName: { flex: 1, color: "#ffffff", fontSize: 16, fontWeight: "500" },
  habitNameDone: { textDecorationLine: "line-through", color: "#888" },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#2e2e3e",
    justifyContent: "center",
    alignItems: "center",
  },
});
