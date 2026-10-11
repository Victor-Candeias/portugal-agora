// Custo de atestar o depósito (WEB-045): litros editáveis, guardados no dispositivo.
import { parseDecimal } from './evCharge.js'

export const DEFAULT_FUEL_TANK_LITRES = 50
export const MAX_FUEL_TANK_LITRES = 200
export const FUEL_TANK_STORAGE_KEY = 'portugal-hoje:fuel-tank-litres'

/** Litros válidos (1 a 200, aceita vírgula) ou null. */
export function parseTankLitres(text: string | null | undefined): number | null {
  const value = text == null ? null : parseDecimal(text)
  return value !== null && value > 0 && value <= MAX_FUEL_TANK_LITRES ? value : null
}

/** Custo de `litres` ao preço por litro, arredondado ao cêntimo. */
export function fuelTankCost(pricePerLitre: number, litres: number): number {
  return Math.round(pricePerLitre * litres * 100) / 100
}

/** `87,45 €` */
export function formatEuros(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

/** `50 L`, `42,5 L` */
export function formatLitres(value: number): string {
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)} L`
}
