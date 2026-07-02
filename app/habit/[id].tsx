import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Camera from "expo-camera";

type Log = {
  id: string;
  completed_at: string;
  photo_url: string | null;
  note: string | null;
};

type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [streak, setStreak] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchHabit();
    fetchLogs();
  }, []);

  async function fetchHabit() {
    const { data } = await supabase
      .from("habits")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setHabit(data);
  }

  async function fetchLogs() {
    const { data } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("habit_id", id)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (data) {
      setLogs([...data]);
      calculateStreak(data);
    }
  }

  function calculateStreak(logs: Log[]) {
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const found = logs.find((l) => l.completed_at.split("T")[0] === key);
      if (found) streak++;
      else if (i > 0) break;
    }
    setStreak(streak);
  }

  async function takePhoto() {
    const { status } = await Camera.Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos de acesso à câmara!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Precisamos de acesso à galeria!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  }

  async function uploadPhoto(uri: string) {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const filename = `${user.id}/${id}/${Date.now()}.jpg`;

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "photo.jpg",
        type: "image/jpeg",
      } as any);

      const { error: uploadError } = await supabase.storage
        .from("habit-photos")
        .upload(filename, formData, { contentType: "image/jpeg" });

      if (uploadError) {
        Alert.alert("Erro", uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("habit-photos").getPublicUrl(filename);

      // Buscar o log de hoje diretamente da BD (não dos logs em memória)
      const today = new Date().toISOString().split("T")[0];
      const { data: todayLogs } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("habit_id", id)
        .gte("completed_at", `${today}T00:00:00`)
        .lte("completed_at", `${today}T23:59:59`)
        .order("completed_at", { ascending: false })
        .limit(1);

      if (todayLogs && todayLogs.length > 0) {
        // Guardar foto numa tabela separada ou adicionar novo log com a foto
        await supabase.from("habit_logs").insert({
          habit_id: id,
          photo_url: publicUrl,
          note: "Foto adicionada",
        });

        await fetchLogs();
        Alert.alert("✅ Foto guardada!");
      } else {
        Alert.alert(
          "Atenção",
          "Completa o hábito hoje primeiro antes de adicionar uma foto!",
        );
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Erro", "Não foi possível fazer upload da foto");
    }
    setUploading(false);
  }

  async function handleDelete() {
    Alert.alert(
      "Apagar hábito",
      "Tens a certeza? Todo o histórico será apagado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            await supabase.from("habits").delete().eq("id", id);
            router.back();
          },
        },
      ],
    );
  }

  if (!habit) return null;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {habit.icon} {habit.name}
        </Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={24} color="#ff6584" />
        </TouchableOpacity>
      </View>

      {/* Streak */}
      <View style={[styles.streakCard, { borderColor: habit.color }]}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakLabel}>dias seguidos</Text>
      </View>

      {/* Botões de foto */}
      <Text style={styles.sectionTitle}>Adicionar prova de hoje</Text>
      <View style={styles.photoButtons}>
        <TouchableOpacity
          style={[styles.photoBtn, { backgroundColor: habit.color }]}
          onPress={takePhoto}
          disabled={uploading}
        >
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.photoBtnText}>Câmara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.photoBtn,
            {
              backgroundColor: "#1e1e2e",
              borderWidth: 1,
              borderColor: habit.color,
            },
          ]}
          onPress={pickFromGallery}
          disabled={uploading}
        >
          <Ionicons name="images" size={24} color={habit.color} />
          <Text style={[styles.photoBtnText, { color: habit.color }]}>
            Galeria
          </Text>
        </TouchableOpacity>
      </View>

      {uploading && <Text style={styles.uploading}>A fazer upload...</Text>}

      {/* Histórico */}
      <Text style={styles.sectionTitle}>Histórico recente</Text>
      {logs.map((log) => (
        <View key={log.id} style={styles.logCard}>
          <View style={styles.logInfo}>
            <Text style={styles.logDate}>
              {new Date(log.completed_at).toLocaleDateString("pt-PT", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Text>
            {log.note && <Text style={styles.logNote}>{log.note}</Text>}
          </View>
          {log.photo_url && (
            <Image source={{ uri: log.photo_url }} style={styles.logPhoto} />
          )}
          {!log.photo_url && (
            <View style={styles.noPhoto}>
              <Ionicons name="image-outline" size={20} color="#555" />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    flex: 1,
    textAlign: "center",
  },
  streakCard: {
    backgroundColor: "#1e1e2e",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 2,
  },
  streakEmoji: { fontSize: 40, marginBottom: 8 },
  streakNumber: { fontSize: 56, fontWeight: "bold", color: "#ffffff" },
  streakLabel: { fontSize: 16, color: "#888", marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#888",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  photoButtons: { flexDirection: "row", gap: 12, marginBottom: 32 },
  photoBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  photoBtnText: { color: "#ffffff", fontWeight: "bold", fontSize: 14 },
  uploading: { color: "#888", textAlign: "center", marginBottom: 16 },
  logCard: {
    backgroundColor: "#1e1e2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  logInfo: { flex: 1 },
  logDate: { color: "#ffffff", fontSize: 14, fontWeight: "500" },
  logNote: { color: "#888", fontSize: 13, marginTop: 4 },
  logPhoto: { width: 60, height: 60, borderRadius: 12 },
  noPhoto: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#2e2e3e",
    justifyContent: "center",
    alignItems: "center",
  },
});
