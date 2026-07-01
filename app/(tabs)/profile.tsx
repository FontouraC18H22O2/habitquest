import { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { sendInstantNotification } from "../../lib/notifications";

type Profile = {
  username: string;
  xp_total: number;
  level: number;
};

function XPBar({ xp, level }: { xp: number; level: number }) {
  const xpForCurrentLevel = (level - 1) * 100;
  const xpForNextLevel = level * 100;
  const progress = ((xp - xpForCurrentLevel) / 100) * 100;

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpLabelRow}>
        <Text style={styles.xpLabel}>XP para nível {level + 1}</Text>
        <Text style={styles.xpValue}>{xp - xpForCurrentLevel}/100</Text>
      </View>
      <View style={styles.xpBar}>
        <View
          style={[styles.xpFill, { width: `${Math.min(progress, 100)}%` }]}
        />
      </View>
    </View>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [habitsCount, setHabitsCount] = useState(0);
  const [completionsCount, setCompletionsCount] = useState(0);

  async function fetchProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("username, xp_total, level")
      .eq("id", user.id)
      .single();

    if (data) setProfile(data);

    // Total de hábitos ativos
    const { count: habits } = await supabase
      .from("habits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("archived", false);

    setHabitsCount(habits || 0);

    // Total de completions
    const { count: completions } = await supabase
      .from("habit_logs")
      .select("*", { count: "exact", head: true })
      .in(
        "habit_id",
        (
          await supabase.from("habits").select("id").eq("user_id", user.id)
        ).data?.map((h) => h.id) || [],
      );

    setCompletionsCount(completions || 0);
  }

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, []),
  );

  async function handleLogout() {
    Alert.alert("Sair", "Tens a certeza que queres sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  function getLevelEmoji(level: number) {
    if (level < 5) return "🌱";
    if (level < 10) return "⚡";
    if (level < 20) return "🔥";
    if (level < 50) return "💎";
    return "👑";
  }

  if (!profile)
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>A carregar...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* Avatar e nome */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{getLevelEmoji(profile.level)}</Text>
        </View>
        <Text style={styles.username}>{profile.username}</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Nível {profile.level}</Text>
        </View>
      </View>

      {/* Barra de XP */}
      <XPBar xp={profile.xp_total} level={profile.level} />

      {/* Estatísticas rápidas */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.xp_total}</Text>
          <Text style={styles.statLabel}>XP Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{habitsCount}</Text>
          <Text style={styles.statLabel}>Hábitos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completionsCount}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
      </View>

      {/* Badges placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏆 Conquistas</Text>
        <View style={styles.badgesRow}>
          {completionsCount >= 1 && (
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>🌟</Text>
              <Text style={styles.badgeLabel}>Primeiro passo</Text>
            </View>
          )}
          {completionsCount >= 10 && (
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>🔥</Text>
              <Text style={styles.badgeLabel}>Em chamas</Text>
            </View>
          )}
          {completionsCount >= 50 && (
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>💎</Text>
              <Text style={styles.badgeLabel}>Dedicado</Text>
            </View>
          )}
          {completionsCount === 0 && (
            <Text style={styles.noBadges}>
              Completa hábitos para desbloquear conquistas!
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: "#6c63ff", marginBottom: 12 }]}
        onPress={() =>
          sendInstantNotification(
            "🎯 Teste!",
            "As notificações estão a funcionar!",
          )
        }
      >
        <Text style={[styles.logoutText, { color: "#6c63ff" }]}>
          Testar notificação
        </Text>
      </TouchableOpacity>

      {/* Botão de logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1a",
    padding: 24,
    paddingTop: 56,
  },
  loading: { color: "#888", textAlign: "center", marginTop: 40 },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1e1e2e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#6c63ff",
  },
  avatarEmoji: { fontSize: 48 },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  levelBadge: {
    backgroundColor: "#6c63ff33",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#6c63ff",
  },
  levelText: { color: "#6c63ff", fontWeight: "bold", fontSize: 14 },
  xpContainer: { marginBottom: 32 },
  xpLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpLabel: { color: "#888", fontSize: 13 },
  xpValue: { color: "#888", fontSize: 13 },
  xpBar: {
    height: 10,
    backgroundColor: "#1e1e2e",
    borderRadius: 5,
    overflow: "hidden",
  },
  xpFill: { height: "100%", backgroundColor: "#6c63ff", borderRadius: 5 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 32 },
  statCard: {
    flex: 1,
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: "#888" },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
  },
  badgesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  badge: {
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    minWidth: 90,
  },
  badgeEmoji: { fontSize: 32, marginBottom: 8 },
  badgeLabel: { color: "#888", fontSize: 12, textAlign: "center" },
  noBadges: { color: "#555", fontSize: 14, fontStyle: "italic" },
  logoutBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ff6584",
  },
  logoutText: { color: "#ff6584", fontSize: 16, fontWeight: "bold" },
});
