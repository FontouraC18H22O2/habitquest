import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from './i18n'

type Language = 'pt' | 'en'

type LanguageContextType = {
  language: Language
  changeLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'pt',
  changeLanguage: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('pt')

  useEffect(() => {
    AsyncStorage.getItem('language').then(saved => {
      if (saved === 'pt' || saved === 'en') {
        setLanguage(saved)
        i18n.changeLanguage(saved)
      }
    })
  }, [])

  function changeLanguage(lang: Language) {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    AsyncStorage.setItem('language', lang)
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}