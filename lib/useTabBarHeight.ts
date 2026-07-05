import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function useTabBarHeight() {
  const insets = useSafeAreaInsets()
  return 60 + insets.bottom + 16 
}