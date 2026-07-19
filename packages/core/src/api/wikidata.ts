// Wikidata / Wikimedia Commons — enriquecimento *on-demand* de pontos de interesse turísticos
// (descrição curta + fotografia livre), conforme .Docs/turismo.v2.txt.
//
// Diferente da tentativa anterior (ver WEB-020, descartada "por agora"): aqui o pedido só é
// feito quando o utilizador pede explicitamente mais informação sobre UM ponto já listado
// (ex. abrir o cartão), não para todos os pontos de uma listagem — evita o problema N+1 e o
// risco de rate-limit identificado anteriormente.
//
// A API do Wikidata suporta CORS para qualquer origem quando se usa o parâmetro `origin=*`
// (confirmado: `access-control-allow-origin: *` na resposta), pelo que não é necessário
// proxy/JSONP como no SIGTUR. As fotografias são servidas diretamente via
// `commons.wikimedia.org/wiki/Special:FilePath/<ficheiro>`, que funciona como `<img src>` sem
// necessitar de CORS (só pedidos `fetch`/XHR estão sujeitos à mesma origem).
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

export interface WikidataEnrichment {
  qid: string
  description?: string
  wikipediaUrl?: string
  imageUrl?: string
}

interface WbSearchEntitiesResponse {
  search?: Array<{ id: string }>
}

interface WbGetEntitiesResponse {
  entities?: Record<string, {
    descriptions?: Record<string, { value: string }>
    sitelinks?: Record<string, { title: string }>
    claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value: unknown } } }>>
  }>
}

function commonsFilePathUrl(fileName: string, width = 480): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`
}

/**
 * Procura o item Wikidata correspondente ao nome de um ponto de interesse e devolve uma
 * descrição curta, ligação para a Wikipédia (pt, com fallback en) e fotografia (via P18 /
 * Wikimedia Commons), quando existirem. Devolve `null` se não houver correspondência.
 */
export async function getWikidataEnrichment(name: string, municipality?: string): Promise<WikidataEnrichment | null> {
  const searchUrl = new URL(WIKIDATA_API)
  searchUrl.searchParams.set('action', 'wbsearchentities')
  searchUrl.searchParams.set('search', name)
  searchUrl.searchParams.set('language', 'pt')
  searchUrl.searchParams.set('format', 'json')
  searchUrl.searchParams.set('limit', '1')
  searchUrl.searchParams.set('origin', '*')

  const searchRes = await fetch(searchUrl.toString())
  if (!searchRes.ok) throw new Error(`Wikidata search error: ${searchRes.status}`)
  const searchData = await searchRes.json() as WbSearchEntitiesResponse
  const qid = searchData.search?.[0]?.id
  if (!qid) return null

  const entityUrl = new URL(WIKIDATA_API)
  entityUrl.searchParams.set('action', 'wbgetentities')
  entityUrl.searchParams.set('ids', qid)
  entityUrl.searchParams.set('props', 'descriptions|sitelinks|claims')
  entityUrl.searchParams.set('languages', 'pt|en')
  entityUrl.searchParams.set('sitefilter', 'ptwiki|enwiki')
  entityUrl.searchParams.set('format', 'json')
  entityUrl.searchParams.set('origin', '*')

  const entityRes = await fetch(entityUrl.toString())
  if (!entityRes.ok) throw new Error(`Wikidata entity error: ${entityRes.status}`)
  const entityData = await entityRes.json() as WbGetEntitiesResponse
  const entity = entityData.entities?.[qid]
  if (!entity) return null

  const description = entity.descriptions?.pt?.value ?? entity.descriptions?.en?.value
  const ptTitle = entity.sitelinks?.ptwiki?.title
  const enTitle = entity.sitelinks?.enwiki?.title
  const wikipediaUrl = ptTitle
    ? `https://pt.wikipedia.org/wiki/${encodeURIComponent(ptTitle)}`
    : enTitle
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle)}`
      : undefined

  const imageClaim = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  const imageUrl = typeof imageClaim === 'string' ? commonsFilePathUrl(imageClaim) : undefined

  // Nota: `municipality` reservado para desambiguação futura (ex. filtrar resultados de
  // pesquisa por proximidade geográfica quando o nome for ambíguo); não usado ainda.
  void municipality

  return { qid, description, wikipediaUrl, imageUrl }
}
