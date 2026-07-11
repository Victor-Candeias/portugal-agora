import { z } from 'zod'

// ── Geo ────────────────────────────────────────────────────────────────────
export const CoordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
})

export const DistrictSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
})

// ── Fuel ───────────────────────────────────────────────────────────────────
export const FuelTypeSchema = z.enum([
  'gasoline_95',
  'gasoline_98',
  'diesel',
  'diesel_plus',
  'lpg',
  'adblue',
])
export type FuelType = z.infer<typeof FuelTypeSchema>

export const FuelStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  address: z.string(),
  district: z.string(),
  municipality: z.string(),
  coordinates: CoordSchema.optional(),
  prices: z.record(FuelTypeSchema, z.number()).optional(),
  updated_at: z.string(),
})
export type FuelStation = z.infer<typeof FuelStationSchema>

export const FuelPriceSchema = z.object({
  station_id: z.string(),
  station_name: z.string(),
  brand: z.string().optional(),
  district: z.string(),
  municipality: z.string(),
  fuel_type: FuelTypeSchema,
  price_eur: z.number(),
  coordinates: CoordSchema.optional(),
  updated_at: z.string(),
})
export type FuelPrice = z.infer<typeof FuelPriceSchema>

// ── Weather ────────────────────────────────────────────────────────────────
export const WeatherForecastSchema = z.object({
  municipality: z.string(),
  date: z.string(),
  temp_min: z.number(),
  temp_max: z.number(),
  precipitation_prob: z.number(),
  wind_speed: z.number(),
  description: z.string(),
  icon: z.string().optional(),
})
export type WeatherForecast = z.infer<typeof WeatherForecastSchema>

export const WeatherObservationSchema = z.object({
  station: z.string(),
  temperature: z.number(),
  humidity: z.number(),
  wind_speed: z.number(),
  precipitation: z.number(),
  timestamp: z.string(),
})
export type WeatherObservation = z.infer<typeof WeatherObservationSchema>

// ── EV Stations ────────────────────────────────────────────────────────────
export const EvStationStatusSchema = z.enum(['available', 'occupied', 'out_of_service', 'unknown'])
export type EvStationStatus = z.infer<typeof EvStationStatusSchema>

export const EvConnectorSchema = z.object({
  type: z.string(),
  power_kw: z.number(),
  status: EvStationStatusSchema,
})

export const EvStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  operator: z.string().optional(),
  address: z.string(),
  coordinates: CoordSchema,
  connectors: z.array(EvConnectorSchema),
  updated_at: z.string(),
})
export type EvStation = z.infer<typeof EvStationSchema>

// ── Civil Protection ───────────────────────────────────────────────────────
export const AlertSeveritySchema = z.enum(['low', 'moderate', 'high', 'extreme'])
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>

export const CivilProtectionAlertSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  district: z.string(),
  severity: AlertSeveritySchema,
  start_at: z.string(),
  end_at: z.string().optional(),
})
export type CivilProtectionAlert = z.infer<typeof CivilProtectionAlertSchema>

export const FireRiskSchema = z.object({
  district: z.string(),
  district_code: z.string(),
  risk_level: z.enum(['reduced', 'moderate', 'high', 'very_high', 'extreme']),
  date: z.string(),
})
export type FireRisk = z.infer<typeof FireRiskSchema>

// ── Economy ────────────────────────────────────────────────────────────────
export const EconomicIndicatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  period: z.string(),
  updated_at: z.string(),
})
export type EconomicIndicator = z.infer<typeof EconomicIndicatorSchema>

export const InterestRateSchema = z.object({
  type: z.string(),
  rate: z.number(),
  period: z.string(),
  updated_at: z.string(),
})
export type InterestRate = z.infer<typeof InterestRateSchema>

// ── API envelope ───────────────────────────────────────────────────────────
export const ApiMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
})

export function listResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ meta: ApiMetaSchema, data: z.array(item) })
}

export function singleResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: item })
}
