// Gera apps/web/public/data/public-services.sqlite a partir do OpenStreetMap (Overpass API),
// cobrindo esquadras PSP / postos GNR / polícia municipal / polícia marítima em Portugal
// (amenity=police). Corre em Node no momento do build/CI — nunca em runtime no browser.
//
// Ver .Docs/Justica.txt e WEB-023 (.maestru/tracks/mobile/). O documento propõe três
// categorias (Lojas do Cidadão, Tribunais, Polícia); esta primeira fase implementa a
// "Fase 1 — Esquadras PSP/GNR" recomendada no documento (a mais simples, cobertura
// nacional imediata via Overpass, sem necessidade de scraping de portais oficiais).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../public/data')
const OUT_FILE = path.join(OUT_DIR, 'public-services.sqlite')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// node + way + relation: algumas esquadras estão mapeadas como edifícios/áreas, não só pontos.
const OVERPASS_QUERY = `
[out:json][timeout:120];
area["ISO3166-1"="PT"][admin_level=2]->.portugal;
(
  node["amenity"="police"](area.portugal);
  way["amenity"="police"](area.portugal);
  relation["amenity"="police"](area.portugal);
);
out center tags;
`

async function fetchOverpass() {
  console.log('→ a consultar Overpass API (amenity=police, Portugal)...')
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'portugal-agora-build (github.com/Victor-Candeias/portugal-agora)',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Overpass respondeu ${res.status}`)
  const json = await res.json()
  const elements = json.elements ?? []
  console.log(`  ${elements.length} elemento(s) devolvido(s).`)
  return elements
}

/**
 * Classificação PSP/GNR/Municipal/Marítima a partir dos campos disponíveis no OSM,
 * conforme as regras descritas em .Docs/Justica.txt.
 */
function classify(tags) {
  const text = [tags.name, tags.operator, tags.brand, tags.police]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('psp') || text.includes('polícia de segurança pública') || text.includes('policia de seguranca publica')) {
    return 'police_psp'
  }
  if (text.includes('gnr') || text.includes('guarda nacional republicana')) {
    return 'police_gnr'
  }
  if (text.includes('polícia municipal') || text.includes('policia municipal')) {
    return 'police_municipal'
  }
  if (text.includes('polícia marítima') || text.includes('policia maritima')) {
    return 'police_maritime'
  }
  return 'police_other'
}

/** Nível de confiança sugerido no documento: 70 com operador PSP/GNR conhecido, 50 sem. */
function confidenceFor(category, tags) {
  const hasKnownOperator = !!(tags.operator || tags.brand || tags.police)
  if (category !== 'police_other' && hasKnownOperator) return 70
  return 50
}

function addressFrom(tags) {
  const parts = [
    tags['addr:street'],
    tags['addr:housenumber'],
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function centerOf(el) {
  if (el.type === 'node') return { lat: el.lat, lon: el.lon }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon }
  return { lat: null, lon: null }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  if (fs.existsSync(OUT_FILE)) fs.rmSync(OUT_FILE)

  const elements = await fetchOverpass()

  const db = new Database(OUT_FILE)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE public_services (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT,
      name TEXT NOT NULL,

      address TEXT,
      postal_code TEXT,
      locality TEXT,
      municipality TEXT,
      district TEXT,

      latitude REAL,
      longitude REAL,

      phone TEXT,
      email TEXT,
      website TEXT,
      opening_hours TEXT,

      operator TEXT,
      source TEXT NOT NULL,
      source_id TEXT,
      source_url TEXT,

      official INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      confidence INTEGER DEFAULT 0,
      last_updated TEXT
    );

    CREATE INDEX idx_public_services_category ON public_services(category);
    CREATE INDEX idx_public_services_coords ON public_services(latitude, longitude);
  `)

  const insert = db.prepare(`
    INSERT OR REPLACE INTO public_services
      (id, category, subcategory, name, address, postal_code, locality, municipality, district,
       latitude, longitude, phone, email, website, opening_hours, operator,
       source, source_id, source_url, official, active, confidence, last_updated)
    VALUES
      (@id, @category, @subcategory, @name, @address, @postal_code, @locality, @municipality, @district,
       @latitude, @longitude, @phone, @email, @website, @opening_hours, @operator,
       @source, @source_id, @source_url, @official, @active, @confidence, @last_updated)
  `)

  const now = new Date().toISOString()
  let saved = 0
  const bySubcategory = new Map()

  db.transaction(() => {
    for (const el of elements) {
      const tags = el.tags ?? {}
      const name = tags.name || null
      if (!name) continue // sem nome não é utilizável para o utilizador final

      const { lat, lon } = centerOf(el)
      const category = classify(tags)
      const subcategory = category === 'police_psp' ? 'Esquadra PSP'
        : category === 'police_gnr' ? 'Posto GNR'
        : category === 'police_municipal' ? 'Polícia Municipal'
        : category === 'police_maritime' ? 'Polícia Marítima'
        : 'Polícia'

      insert.run({
        id: `${el.type}/${el.id}`,
        category,
        subcategory,
        name,
        address: addressFrom(tags),
        postal_code: tags['addr:postcode'] || null,
        locality: tags['addr:city'] || null,
        municipality: tags['addr:city'] || null,
        district: null,
        latitude: lat,
        longitude: lon,
        phone: tags.phone || tags['contact:phone'] || null,
        email: tags.email || tags['contact:email'] || null,
        website: tags.website || tags['contact:website'] || null,
        opening_hours: tags.opening_hours || null,
        operator: tags.operator || null,
        source: 'openstreetmap',
        source_id: `${el.type}/${el.id}`,
        source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        official: 0,
        active: 1,
        confidence: confidenceFor(category, tags),
        last_updated: now,
      })
      saved++
      bySubcategory.set(subcategory, (bySubcategory.get(subcategory) ?? 0) + 1)
    }
  })()

  console.log(`  ${saved} local(is) guardado(s):`)
  for (const [sub, count] of bySubcategory) console.log(`    ${sub}: ${count}`)

  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('generated_at', now)
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('source', 'OpenStreetMap Overpass API (amenity=police, Portugal)')

  db.exec('VACUUM')
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()

  const stats = fs.statSync(OUT_FILE)
  console.log(`✔ ${OUT_FILE} gerado (${(stats.size / 1024).toFixed(0)} KB).`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
