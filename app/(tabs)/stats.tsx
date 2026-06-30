import { View, Text, StyleSheet } from 'react-native'

export default function Stats() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📊 Estatísticas</Text>
      <Text style={styles.sub}>Em breve...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  text: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  sub: { fontSize: 16, color: '#888' },
})