import type { FuelType } from '../types/index.js'

export function formatPrice(eur: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(eur)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export const FUEL_LABELS: Record<FuelType, string> = {
  gasoline_95: 'Gasolina 95',
  gasoline_98: 'Gasolina 98',
  diesel: 'Gasóleo',
  diesel_plus: 'Gasóleo +',
  lpg: 'GPL',
  adblue: 'AdBlue',
}

export const FUEL_COLORS: Record<FuelType, string> = {
  gasoline_95: '#22c55e',
  gasoline_98: '#3b82f6',
  diesel: '#f59e0b',
  diesel_plus: '#f97316',
  lpg: '#a855f7',
  adblue: '#06b6d4',
}

export const SEVERITY_COLORS = {
  low: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  extreme: '#ef4444',
} as const

export const FIRE_RISK_LABELS = {
  reduced: 'Reduzido',
  moderate: 'Moderado',
  high: 'Elevado',
  very_high: 'Muito Elevado',
  extreme: 'Máximo',
} as const

export const FIRE_RISK_COLORS = {
  reduced: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  very_high: '#ef4444',
  extreme: '#7f1d1d',
} as const

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
