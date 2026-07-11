const BASE = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb'

export interface DgegDistrict {
  Id: number
  Descritivo: string
}

export interface DgegMunicipality {
  Id: number
  Descritivo: string
  IdDistrito: number
  Distrito: DgegDistrict
}

export interface DgegFuelType {
  Id: number
  Descritivo: string
  UnidadeMedida: string
  fl_rodoviario: boolean
  fl_ativo: boolean
}

export interface DgegStation {
  Id: number
  Nome: string
  TipoPosto: string
  Municipio: string
  Distrito: string
  Preco: string
  price_eur: number
  Marca: string
  Combustivel: string
  DataAtualizacao: string
  Morada: string
  Localidade: string
  CodPostal: string
  Latitude: number
  Longitude: number
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`DGEG API error: ${res.status}`)
  const json = await res.json()
  if (!json.status) throw new Error(json.mensagem ?? 'DGEG API error')
  return json.resultado as T
}

function parsePrice(preco: string): number {
  return parseFloat(preco.replace(',', '.').replace(/[^\d.]/g, ''))
}

export const dgegClient = {
  async getDistricts(): Promise<DgegDistrict[]> {
    return get<DgegDistrict[]>('GetDistritos')
  },

  async getMunicipalities(districtId: number): Promise<DgegMunicipality[]> {
    return get<DgegMunicipality[]>('GetMunicipios', { IdDistrito: districtId })
  },

  async getFuelTypes(): Promise<DgegFuelType[]> {
    const all = await get<DgegFuelType[]>('GetTiposCombustiveis')
    return all.filter(f => f.fl_rodoviario && f.fl_ativo)
  },

  async searchStations(params: {
    fuelTypeId: number
    districtId?: number
    municipalityId?: number
    page?: number
    pageSize?: number
  }): Promise<DgegStation[]> {
    const raw = await get<any[]>('PesquisarPostos', {
      idsTiposComb: params.fuelTypeId,
      idDistrito: params.districtId,
      idsMunicipios: params.municipalityId,
      qtdPorPagina: params.pageSize ?? 9999,
      pagina: params.page ?? 1,
    })
    return raw.map(s => ({
      ...s,
      price_eur: parsePrice(s.Preco),
    }))
  },
}

// Mapeamento dos tipos de combustível usados na app → IDs DGEG
export const DGEG_FUEL_IDS: Record<string, number> = {
  gasoline_95:   3201,
  gasoline_98:   3400,
  diesel:        2101,
  diesel_plus:   2105,
  lpg:           1120,
  gasoline_95_e: 3205,
  gasoline_98_e: 3405,
}
