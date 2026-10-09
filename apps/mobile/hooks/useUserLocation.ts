import { useCallback, useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'

export type Coords = { latitude: number; longitude: number }
export type LocationStatus = 'loading' | 'granted' | 'denied'

/** Coordenadas de Lisboa, usadas como fallback quando a localização não é concedida. */
export const LISBON_COORDS: Coords = { latitude: 38.716, longitude: -9.139 }

/**
 * Localização atual (permissão "when in use" do expo-location). Sem permissão ou sem fix,
 * `coords` fica `fallback` (por omissão `null`) e `status` passa a `denied`.
 * `request()` volta a pedir (ex.: botão "Usar a minha localização").
 */
export function useUserLocation(fallback: Coords | null = null) {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<LocationStatus>('loading')
  const fallbackRef = useRef(fallback)

  const request = useCallback(async () => {
    setStatus('loading')
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync()
      if (permission !== 'granted') throw new Error('denied')
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      setStatus('granted')
    } catch {
      setCoords(fallbackRef.current)
      setStatus('denied')
    }
  }, [])

  useEffect(() => {
    void request()
  }, [request])

  return { coords, status, request }
}
