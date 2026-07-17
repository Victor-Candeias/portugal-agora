import { configureSigturTransport, type ArcGisGeoJsonResponse } from '@portugal-hoje/core'

// O servidor SIGTUR/ArcGIS só devolve cabeçalhos CORS para origens oficiais, pelo que a app
// web (browser) não pode usar `fetch` diretamente. Proxies de terceiros (corsproxy.io,
// allorigins, codetabs) mostraram-se pouco fiáveis (corsproxy.io passou a exigir plano pago;
// os outros não conseguem alcançar este servidor a partir de infraestrutura cloud).
// A solução robusta é usar JSONP — mecanismo nativo dos servidores ArcGIS REST (parâmetro
// `callback`), que contorna CORS por completo porque o pedido é feito via <script>, não via
// fetch/XHR, e por isso não está sujeito à política de mesma origem do browser.
const JSONP_TIMEOUT_MS = 15000

function requestJsonp(url: URL): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const callbackName = `__sigtur_cb_${Math.random().toString(36).slice(2)}`
    url.searchParams.set('f', 'json')
    url.searchParams.set('callback', callbackName)

    const script = document.createElement('script')
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('SIGTUR JSONP: pedido excedeu o tempo limite'))
    }, JSONP_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timeout)
      delete (window as unknown as Record<string, unknown>)[callbackName]
      script.remove()
    }

    ;(window as unknown as Record<string, unknown>)[callbackName] = (data: unknown) => {
      cleanup()
      resolve(data)
    }

    script.src = url.toString()
    script.onerror = () => {
      cleanup()
      reject(new Error('SIGTUR JSONP: falha ao carregar o script'))
    }
    document.head.appendChild(script)
  })
}

interface EsriJsonFeature {
  attributes: Record<string, unknown>
  geometry?: { x: number; y: number }
}

interface EsriJsonResponse {
  features?: EsriJsonFeature[]
  error?: { message: string }
}

/** Converte a resposta Esri JSON (usada pelo JSONP) para o formato GeoJSON esperado pelo core. */
function esriJsonToGeoJson(data: EsriJsonResponse): ArcGisGeoJsonResponse {
  if (data.error) throw new Error(`SIGTUR ArcGIS error: ${data.error.message}`)

  return {
    features: (data.features ?? []).map(feature => ({
      type: 'Feature',
      geometry: feature.geometry
        ? { type: 'Point', coordinates: [feature.geometry.x, feature.geometry.y] }
        : null,
      properties: feature.attributes ?? {},
    })),
  }
}

configureSigturTransport(async (url) => {
  const data = await requestJsonp(url)
  return esriJsonToGeoJson(data as EsriJsonResponse)
})
