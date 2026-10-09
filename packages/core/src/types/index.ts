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
