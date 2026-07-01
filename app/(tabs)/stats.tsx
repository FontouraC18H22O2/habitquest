import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect } from 'expo-router'
import { VictoryBar, VictoryChart, VictoryTheme, VictoryAxis } from 'victory-native'

const SCREEN_WIDTH = Dimensions.get('window').width

type DayLog = {
  date: string
  count: number
}

export default function Stats() {
  const [weekData, setWeekData] = useState<{ x: string; y: number }[]>([])
  const [heatmap, setHeatmap] = useState<DayLog[]>([])
  const [totalCompletions, setTotalCompletions] = useState(0)
  const [totalHabits, setTotalHabits] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  async function fetchStats() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: habits } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', user.id)
      .eq('archived', false)

    if (!habits) return
    const habitIds = habits.map(h => h.id)
    setTotalHabits(habits.length)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: logs } = await supabase
      .from('habit_logs')
      .select('completed_at')
      .in('habit_id', habitIds)
      .gte('completed_at', thirtyDaysAgo.toISOString())

    if (!logs) return
    setTotalCompletions(logs.length)

    // Heatmap
    const dayMap: Record<string, number> = {}
    logs.forEach(log => {
      const day = log.completed_at.split('T')[0]
      dayMap[day] = (dayMap[day] || 0) + 1
    })

    const heatmapData: DayLog[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      heatmapData.push({ date: key, count: dayMap[key] || 0 })
    }
    setHeatmap(heatmapData)

    // Gráfico semanal
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const weekMap: Record<string, number> = {}
    const weekDates: string[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      weekDates.push(key)
      weekMap[key] = 0
    }

    logs.forEach(log => {
      const day = log.completed_at.split('T')[0]
      if (weekMap[day] !== undefined) weekMap[day]++
    })

    const barData = weekDates.map(date => ({
      x: days[new Date(date).getDay()],
      y: weekMap[date],
    }))
    setWeekData(barData)

    // Melhor streak
    let streak = 0
    let maxStreak = 0
    heatmapData.forEach(day => {
      if (day.count > 0) {
        streak++
        maxStreak = Math.max(maxStreak, streak)
      } else {
        streak = 0
      }
    })
    setBestStreak(maxStreak)
  }

  useFocusEffect(
    useCallback(() => {
      fetchStats()
    }, [])
  )

  function getHeatmapColor(count: number) {
    if (count === 0) return '#1e1e2e'
    if (count === 1) return '#4a3f8f'
    if (count === 2) return '#5a4fbf'
    return '#6c63ff'
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Estatísticas</Text>

      {/* Cards resumo */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalHabits}</Text>
          <Text style={styles.statLabel}>Hábitos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalCompletions}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{bestStreak}</Text>
          <Text style={styles.statLabel}>Melhor streak</Text>
        </View>
      </View>

      {/* Gráfico semanal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Últimos 7 dias</Text>
        <View style={styles.chartContainer}>
          <VictoryChart
            theme={VictoryTheme.material}
            width={SCREEN_WIDTH - 48}
            height={220}
            padding={{ top: 20, bottom: 40, left: 40, right: 20 }}
          >
            <VictoryAxis
              style={{
                axis: { stroke: 'transparent' },
                tickLabels: { fill: '#888', fontSize: 12 },
                grid: { stroke: 'transparent' },
              }}
            />
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                tickLabels: { fill: '#888', fontSize: 12 },
                grid: { stroke: '#2e2e3e' },
              }}
            />
            <VictoryBar
              data={weekData}
              style={{ data: { fill: '#6c63ff', borderRadius: 4 } }}
              cornerRadius={{ top: 6 }}
            />
          </VictoryChart>
        </View>
      </View>

      {/* Heatmap */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Últimos 30 dias</Text>
        <View style={styles.heatmap}>
          {heatmap.map((day, i) => (
            <View
              key={i}
              style={[styles.heatmapCell, { backgroundColor: getHeatmapColor(day.count) }]}
            />
          ))}
        </View>
        <View style={styles.heatmapLegend}>
          <Text style={styles.legendText}>Menos</Text>
          {[0, 1, 2, 3].map(v => (
            <View key={v} style={[styles.legendCell, { backgroundColor: getHeatmapColor(v) }]} />
          ))}
          <Text style={styles.legendText}>Mais</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 20, paddingTop: 56 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statCard: {
    flex: 1, backgroundColor: '#1e1e2e', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#888' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  chartContainer: { backgroundColor: '#1e1e2e', borderRadius: 16, overflow: 'hidden' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: {
    width: (SCREEN_WIDTH - 80) / 10 - 4,
    height: (SCREEN_WIDTH - 80) / 10 - 4,
    borderRadius: 4,
  },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  legendCell: { width: 16, height: 16, borderRadius: 3 },
  legendText: { color: '#888', fontSize: 12 },
})