import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Camera, Layer, Map, Marker, RasterSource, type CameraRef } from '@maplibre/maplibre-react-native'
import { PORTUGAL_MAINLAND_BOUNDS, anacomExportUrl } from '@portugal-hoje/core'
import { OSM_STYLE } from '../lib/maps'

const { west, south, east, north } = PORTUGAL_MAINLAND_BOUNDS
const FOCUS_ZOOM = 12

type CoverageMapProps = {
  /** Camada ANACOM (operadora + tecnologia) a sobrepor. */
  layerId: number
  opacity: number
  point: { lat: number; lon: number } | null
  /** Muda quando o ponto vem do GPS ou da alternativa (Lisboa): o mapa centra-se nele. */
  focusKey: number
  onPick: (lat: number, lon: number) => void
  height?: number
  style?: StyleProp<ViewStyle>
}

// Mapa da cobertura móvel (MOB-020): OSM + imagens `export` da ANACOM como mosaicos raster
// (o MapLibre substitui `{bbox-epsg-3857}` pela bbox de cada mosaico). Tocar no mapa escolhe o ponto.
export function CoverageMap({ layerId, opacity, point, focusKey, onPick, height = 340, style }: CoverageMapProps) {
  const cameraRef = useRef<CameraRef>(null)
  const [mapReady, setMapReady] = useState(false)
  // Lido por ref: o ponto só centra o mapa quando o `focusKey` muda, não a cada toque.
  const pointRef = useRef(point)
  pointRef.current = point

  useEffect(() => {
    const p = pointRef.current
    if (!mapReady || !p || focusKey === 0) return
    cameraRef.current?.easeTo({ center: [p.lon, p.lat], zoom: FOCUS_ZOOM, duration: 600 })
  }, [mapReady, focusKey])

  return (
    <View style={[styles.container, { height }, style]}>
      <Map
        style={styles.map}
        mapStyle={OSM_STYLE}
        logo={false}
        compass={false}
        touchPitch={false}
        attribution
        attributionPosition={{ bottom: 4, right: 4 }}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onPress={event => {
          const [lon, lat] = event.nativeEvent.lngLat
          onPick(lat, lon)
        }}
      >
        <Camera ref={cameraRef} initialViewState={{ bounds: [west, south, east, north] }} maxZoom={18} />
        {/* `key` por camada: a fonte é recriada ao mudar de operadora/tecnologia, em vez de mudar os `tiles`. */}
        <RasterSource
          key={`anacom-${layerId}`}
          id={`anacom-${layerId}`}
          tiles={[anacomExportUrl(layerId)]}
          tileSize={256}
          maxzoom={18}
          attribution="© ANACOM"
        >
          <Layer id={`anacom-layer-${layerId}`} type="raster" paint={{ 'raster-opacity': opacity }} />
        </RasterSource>
        {point && (
          <Marker id="coverage-point" lngLat={[point.lon, point.lat]} anchor="center">
            <View style={styles.pin} />
          </Marker>
        )}
      </Map>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  map: { flex: 1 },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: 'white',
    backgroundColor: '#1d4ed8',
    elevation: 3,
  },
})
