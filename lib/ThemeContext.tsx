import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Theme = 'dark' | 'light'

type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
  colors: typeof darkColors
}

const darkColors = {
  background: '#0f0f1a',
  card: '#1e1e2e',
  card2: '#2e2e3e',
  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#555555',
  border: '#2e2e3e',
  primary: '#6c63ff',
  danger: '#ff6584',
  success: '#43e97b',
}

const lightColors = {
  background: '#f0f0f7',
  card: '#ffffff',
  card2: '#e8e8f0',
  text: '#1a1a2e',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#e0e0e0',
  primary: '#6c63ff',
  danger: '#ff6584',
  success: '#2db869',
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  colors: darkColors,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    AsyncStorage.getItem('theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    })
  }, [])

  function toggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    AsyncStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      colors: theme === 'dark' ? darkColors : lightColors,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}