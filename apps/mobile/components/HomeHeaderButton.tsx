// Botão "🏠 Início" do header (WEB-037): atalho para a tab Início a partir de qualquer outro ecrã.
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { COLORS } from './ui'

// `tab`: troca para a tab Início (o TabRouter não trata POP_TO, por isso usa navigate).
// `stack`: fecha os ecrãs empilhados na Stack raiz até `(tabs)` e mostra a tab Início.
export function HomeHeaderButton({ mode }: { mode: 'tab' | 'stack' }) {
  const goHome = () => (mode === 'stack' ? router.dismissTo('/') : router.navigate('/'))

  return (
    <Pressable
      onPress={goHome}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Ir para o Início"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>🏠 Início</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 8, paddingVertical: 4 },
  pressed: { opacity: 0.5 },
  label: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
})
