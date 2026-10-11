import { useEffect, useState } from 'react'
import Storage from 'expo-sqlite/kv-store'
import { DEFAULT_FUEL_TANK_LITRES, FUEL_TANK_STORAGE_KEY, parseTankLitres } from '@portugal-hoje/core'

// Litros do depósito para o custo de atestar (WEB-045), guardados no expo-sqlite/kv-store quando válidos.
function readTankLitres(): string {
  try {
    const stored = Storage.getItemSync(FUEL_TANK_STORAGE_KEY)
    return stored !== null && parseTankLitres(stored) !== null ? stored : String(DEFAULT_FUEL_TANK_LITRES)
  } catch {
    return String(DEFAULT_FUEL_TANK_LITRES)
  }
}

export function useFuelTankLitres() {
  const [text, setText] = useState(readTankLitres)
  useEffect(() => {
    if (parseTankLitres(text) === null) return
    Storage.setItemAsync(FUEL_TANK_STORAGE_KEY, text).catch(() => {
      // Se falhar, fica só em memória.
    })
  }, [text])
  return [text, setText] as const
}
