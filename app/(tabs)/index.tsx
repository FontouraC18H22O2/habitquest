import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Modal, TextInput
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

type Habit = {
  id: string
  name: string
  icon: string
  color: string
  completed: boolean
  goal_value: number | null
  goal_unit: string | null
  progress_today: number
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [username, setUsername] = useState('')
  const [progressModalVisible, setProgressModalVisible] = useState(false)
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null)
  const [progressValue, setProgressValue] = useState('')

  async function fetchHabits() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    if (profile) setUsername(profile.username)

    const { data: habitsData } = await supabase
      .from('habits')
      .select('id, name, icon, color, goal_value, goal_unit, archived')
      .eq('user_id', user.id)
      .eq('archived', false)

    if (!habitsData) return

    const today = new Date().toISOString().split('T')[0]

    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id')
      .gte('completed_at', `${today}T00:00:00`)
      .lte('completed_at', `${today}T23:59:59`)

    const completedIds = new Set(logs?.map(l => l.habit_id) || [])

    // Buscar progresso de hoje por hábito
    const { data: progressLogs } = await supabase
      .from('habit_logs')
      .select('habit_id, value')
      .gte('completed_at', `${today}T00:00:00`)
      .lte('completed_at', `${today}T23:59:59`)

    const progressMap: Record<string, number> = {}
    progressLogs?.forEach(log => {
      progressMap[log.habit_id] = (progressMap[log.habit_id] || 0) + (log.value || 0)
    })

    setHabits(habitsData.map(h => ({
      ...h,
      completed: completedIds.has(h.id),
      progress_today: progressMap[h.id] || 0
    })))
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchHabits()
    }, [])
  )

  async function toggleHabit(habit: Habit) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    if (habit.completed) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habit.id)
        .gte('completed_at', `${today}T00:00:00`)
        .lte('completed_at', `${today}T23:59:59`)

      await supabase.rpc('decrement_xp', { user_id: user.id, amount: 10 })
    } else {
      const { data: existingLog } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('habit_id', habit.id)
        .gte('completed_at', `${today}T00:00:00`)
        .lte('completed_at', `${today}T23:59:59`)
        .limit(1)

      if (existingLog && existingLog.length > 0) return

      await supabase.from('habit_logs').insert({ habit_id: habit.id })
      await supabase.rpc('increment_xp', { user_id: user.id, amount: 10 })
    }

    setHabits(prev => prev.map(h =>
      h.id === habit.id ? { ...h, completed: !h.completed } : h
    ))
  }

  async function toggleHabitWithValue(habit: Habit, value: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    if (habit.completed) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habit.id)
        .gte('completed_at', `${today}T00:00:00`)
        .lte('completed_at', `${today}T23:59:59`)

      await supabase.rpc('decrement_xp', { user_id: user.id, amount: 10 })

      setHabits(prev => prev.map(h =>
        h.id === habit.id ? { ...h, completed: false, progress_today: 0 } : h
      ))
      return
    }

    // Verificar progresso acumulado hoje
    const { data: todayLogs } = await supabase
      .from('habit_logs')
      .select('value')
      .eq('habit_id', habit.id)
      .gte('completed_at', `${today}T00:00:00`)
      .lte('completed_at', `${today}T23:59:59`)

    const totalToday = (todayLogs?.reduce((sum, log) => sum + (log.value || 0), 0) || 0) + value
    const goalReached = habit.goal_value ? totalToday >= habit.goal_value : true

    // Inserir log com o valor
    await supabase.from('habit_logs').insert({ habit_id: habit.id, value })

    if (goalReached) {
      await supabase.rpc('increment_xp', { user_id: user.id, amount: 10 })
      setHabits(prev => prev.map(h =>
        h.id === habit.id ? { ...h, completed: true, progress_today: totalToday } : h
      ))
      Alert.alert('🎉 Meta atingida!', `Completaste ${habit.name}!`)
    } else {
      const remaining = (habit.goal_value || 0) - totalToday
      setHabits(prev => prev.map(h =>
        h.id === habit.id ? { ...h, progress_today: totalToday } : h
      ))
      Alert.alert(
        '📊 Progresso registado!',
        `${totalToday} ${habit.goal_unit} de ${habit.goal_value} ${habit.goal_unit}\nFaltam ${remaining.toFixed(1)} ${habit.goal_unit} para a meta!`
      )
    }
  }

  const completed = habits.filter(h => h.completed).length
  const total = habits.length

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {username || 'aventureiro'} </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('pt-PT', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/create-habit')}
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
            <View style={[styles.progressFill, { width: `${(completed / total) * 100}%` }]} />
          </View>
          {completed === total && (
            <Text style={styles.allDone}>🎉 Completaste todos os hábitos hoje!</Text>
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
          <Text style={styles.emptySub}>Clica no + para criar o teu primeiro hábito</Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHabits} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.habitCard, item.completed && styles.habitCardDone]}
              onPress={() => {
                if (item.goal_value && !item.completed) {
                  setSelectedHabit(item)
                  setProgressModalVisible(true)
                } else {
                  toggleHabit(item)
                }
              }}
              onLongPress={() => router.push(`/habit/${item.id}` as any)}
            >
              <View style={[styles.habitIcon, { backgroundColor: item.color + '33' }]}>
                <Text style={styles.habitEmoji}>{item.icon}</Text>
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitName, item.completed && styles.habitNameDone]}>
                  {item.name}
                </Text>
                {item.goal_value && (
                  <View style={styles.goalContainer}>
                    <Text style={styles.habitGoal}>
                      {item.progress_today}/{item.goal_value} {item.goal_unit}
                    </Text>
                    <View style={styles.miniBar}>
                      <View style={[
                        styles.miniBarFill,
                        {
                          width: `${Math.min((item.progress_today / item.goal_value) * 100, 100)}%`,
                          backgroundColor: item.color
                        }
                      ]} />
                    </View>
                  </View>
                )}
              </View>
              <View style={[styles.checkbox, item.completed && { backgroundColor: item.color, borderColor: item.color }]}>
                {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal de progresso */}
      <Modal visible={progressModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.progressModal}>
            <Text style={styles.modalEmoji}>{selectedHabit?.icon}</Text>
            <Text style={styles.modalTitle}>{selectedHabit?.name}</Text>
            <Text style={styles.modalSub}>
              Meta: {selectedHabit?.goal_value} {selectedHabit?.goal_unit}
              {selectedHabit?.progress_today ? ` • Hoje: ${selectedHabit.progress_today} ${selectedHabit.goal_unit}` : ''}
            </Text>

            <TextInput
              style={styles.progressInput}
              placeholder={`Adicionar (${selectedHabit?.goal_unit})`}
              placeholderTextColor="#888"
              value={progressValue}
              onChangeText={setProgressValue}
              keyboardType="numeric"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setProgressModalVisible(false)
                  setProgressValue('')
                }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: selectedHabit?.color }]}
                onPress={async () => {
                  if (selectedHabit && progressValue) {
                    await toggleHabitWithValue(selectedHabit, parseFloat(progressValue))
                    setProgressModalVisible(false)
                    setProgressValue('')
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  date: { fontSize: 13, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#6c63ff', justifyContent: 'center', alignItems: 'center',
  },
  progressCard: { backgroundColor: '#1e1e2e', borderRadius: 16, padding: 16, marginBottom: 24 },
  progressText: { color: '#ffffff', fontSize: 14, marginBottom: 10 },
  progressBar: { height: 8, backgroundColor: '#2e2e3e', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6c63ff', borderRadius: 4 },
  allDone: { color: '#43e97b', fontSize: 13, marginTop: 10, textAlign: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptySub: { color: '#888', fontSize: 14, textAlign: 'center' },
  habitCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e2e',
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  habitCardDone: { opacity: 0.6 },
  habitIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  habitEmoji: { fontSize: 22 },
  habitInfo: { flex: 1 },
  habitName: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  habitNameDone: { textDecorationLine: 'line-through', color: '#888' },
  goalContainer: { marginTop: 4 },
  habitGoal: { color: '#888', fontSize: 12 },
  miniBar: { height: 4, backgroundColor: '#2e2e3e', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  miniBarFill: { height: '100%', borderRadius: 2 },
  checkbox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: '#2e2e3e',
    justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  progressModal: {
    backgroundColor: '#1e1e2e', borderRadius: 24,
    padding: 24, width: '100%', alignItems: 'center',
  },
  modalEmoji: { fontSize: 48, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#888', marginBottom: 24, textAlign: 'center' },
  progressInput: {
    backgroundColor: '#0f0f1a', borderRadius: 12, padding: 16,
    color: '#ffffff', fontSize: 24, fontWeight: 'bold',
    textAlign: 'center', width: '100%', marginBottom: 24,
    borderWidth: 1, borderColor: '#2e2e3e',
  },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: {
    flex: 1, padding: 16, borderRadius: 12,
    backgroundColor: '#2e2e3e', alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalConfirmText: { color: '#ffffff', fontWeight: 'bold' },
})