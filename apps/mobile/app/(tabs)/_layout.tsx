import { Tabs } from 'expo-router/js-tabs'
import { Text, type ColorValue } from 'react-native'

const icon = (emoji: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{emoji}</Text>
  }

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#16a34a',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#16a34a',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('🏠'), headerTitle: '🇵🇹 Portugal Hoje' }} />
      <Tabs.Screen name="combustivel" options={{ title: 'Combustível', tabBarIcon: icon('⛽') }} />
      <Tabs.Screen name="tempo" options={{ title: 'Tempo', tabBarIcon: icon('🌤️') }} />
      <Tabs.Screen name="ev" options={{ title: 'EV', tabBarIcon: icon('⚡') }} />
      <Tabs.Screen name="economia" options={{ title: 'Economia', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="turismo" options={{ title: 'Turismo', tabBarIcon: icon('🏖️') }} />
    </Tabs>
  )
}
