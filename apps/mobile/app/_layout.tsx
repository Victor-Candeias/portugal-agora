import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { HomeHeaderButton } from '../components/HomeHeaderButton'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false },
  },
})

// Stack raiz: as 6 tabs ficam no grupo `(tabs)` e as restantes secções abrem por cima, com botão
// Voltar (13 secções não cabem numa barra de tabs). A grelha "Todas as secções" do Início liga a todas.
// Todos os headers (exceto o Início) têm à direita o botão "🏠 Início" (WEB-037).
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTintColor: '#16a34a',
            headerTitleStyle: { color: '#0f172a' },
            contentStyle: { backgroundColor: '#f8fafc' },
            headerRight: () => <HomeHeaderButton mode="stack" />,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="protecao-civil" options={{ title: 'Proteção Civil' }} />
          <Stack.Screen name="hospitais" options={{ title: 'Hospitais' }} />
          <Stack.Screen name="transportes" options={{ title: 'Transportes' }} />
          <Stack.Screen name="metro-porto" options={{ title: 'Metro do Porto' }} />
          <Stack.Screen name="servicos-publicos" options={{ title: 'Serviços Públicos' }} />
          <Stack.Screen name="codigo-postal" options={{ title: 'Código Postal' }} />
          <Stack.Screen name="contratos/index" options={{ title: 'Contratos Públicos' }} />
          <Stack.Screen name="contratos/[id]" options={{ title: 'Contrato' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
