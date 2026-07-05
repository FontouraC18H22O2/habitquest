import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Theme = 'dark' | 'light'

type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
  colors: typeof darkColors
}

const darkColors = {
  background: '#0a1628',
  card: '#0f2235',
  card2: '#1a3a52',
  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#555555',
  border: '#1a3a52',
  primary: '#1a9e8f',
  danger: '#ff6584',
  success: '#43e97b',
}

const lightColors = {
  background: '#f0f7f6',
  card: '#ffffff',
  card2: '#e0f0ee',
  text: '#0a1628',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#c0dedd',
  primary: '#1a9e8f',
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