import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Tabs } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Text } from 'react-native'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false },
  },
})

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#16a34a',
            tabBarStyle: { borderTopColor: '#e2e8f0' },
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#16a34a',
          }}
        >
          <Tabs.Screen
            name="(tabs)/index"
            options={{
              title: 'Início',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
              headerTitle: '🇵🇹 Portugal Hoje',
            }}
          />
          <Tabs.Screen
            name="(tabs)/combustivel"
            options={{
              title: 'Combustível',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⛽</Text>,
            }}
          />
          <Tabs.Screen
            name="(tabs)/tempo"
            options={{
              title: 'Tempo',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🌤️</Text>,
            }}
          />
          <Tabs.Screen
            name="(tabs)/ev"
            options={{
              title: 'EV',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚡</Text>,
            }}
          />
          <Tabs.Screen
            name="(tabs)/economia"
            options={{
              title: 'Economia',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
            }}
          />
        </Tabs>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
