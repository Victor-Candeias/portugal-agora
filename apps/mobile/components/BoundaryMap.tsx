import { useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native'
import { boundaryBounds, parishesFeatureCollection, type GeoBoundary, type MunicipalityParish } from '@portugal-hoje/core'
import { OSM_STYLE } from '../lib/maps'

const PADDING = { top: 24, right: 24, bottom: 24, left: 24 }
const PARISH_LINE = '#15803d'
const SELECTED_FILL = '#f97316'
const SELECTED_LINE = '#c2410c'

// Fronteira de um concelho (GeoJSON) no mapa nativo, enquadrada nos seus limites (WEB-042).
// Com `parishes`, desenha também os limites das freguesias (WEB-049): o toque seleciona a freguesia,
// que fica destacada e enquadrada; sem seleção, a câmara volta ao concelho.
export function BoundaryMap({
  boundary,
  parishes,
  selectedParish = null,
  onSelectParish,
  height = 280,
  color = '#16a34a',
  style,
}: {
  boundary: GeoBoundary
  parishes?: MunicipalityParish[]
  selectedParish?: string | null
  onSelectParish?: (code: string | null) => void
  height?: number
  color?: string
  style?: StyleProp<ViewStyle>
}) {
  const bounds = useMemo(() => boundaryBounds(boundary), [boundary])
  const collection = useMemo(() => (parishes?.length ? parishesFeatureCollection(parishes) : null), [parishes])
  const selectedBounds = useMemo(() => {
    const parish = selectedParish ? parishes?.find(p => p.code === selectedParish) : null
    return parish ? boundaryBounds(parish.boundary) : null
  }, [parishes, selectedParish])

  if (!bounds) {
    return (
      <View style={[styles.container, styles.empty, { height }, style]}>
        <Text style={styles.emptyText}>Mapa não disponível.</Text>
      </View>
    )
  }

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
      >
        <Camera bounds={selectedBounds ?? bounds} padding={PADDING} duration={400} easing="ease" />
        {/* Fronteira por baixo: os toques chegam sempre à camada das freguesias.
            O GeoJSONSource descarta filhos `false` e reindexa os restantes; sem `key`, o React reutilizaria
            a instância do `boundary-fill` para o `boundary-line` e o MapLibre rebenta ("`id` cannot be changed"). */}
        <GeoJSONSource id="boundary" data={boundary as GeoJSON.Feature}>
          {!collection && (
            <Layer
              key="boundary-fill"
              id="boundary-fill"
              type="fill"
              paint={{ 'fill-color': color, 'fill-opacity': 0.12 }}
            />
          )}
          <Layer
            key="boundary-line"
            id="boundary-line"
            type="line"
            paint={{ 'line-color': color, 'line-width': collection ? 3 : 2 }}
          />
        </GeoJSONSource>
        {collection && (
          <GeoJSONSource
            id="parishes"
            data={collection as GeoJSON.FeatureCollection}
            onPress={(event) => {
              const code = event.nativeEvent.features?.[0]?.properties?.code
              if (typeof code === 'string') onSelectParish?.(code === selectedParish ? null : code)
            }}
          >
            <Layer id="parishes-fill" type="fill" paint={{ 'fill-color': color, 'fill-opacity': 0.06 }} />
            <Layer id="parishes-line" type="line" paint={{ 'line-color': PARISH_LINE, 'line-width': 1 }} />
            <Layer
              id="parish-selected-fill"
              type="fill"
              filter={['==', ['get', 'code'], selectedParish ?? '']}
              paint={{ 'fill-color': SELECTED_FILL, 'fill-opacity': 0.3 }}
            />
            <Layer
              id="parish-selected-line"
              type="line"
              filter={['==', ['get', 'code'], selectedParish ?? '']}
              paint={{ 'line-color': SELECTED_LINE, 'line-width': 2.5 }}
            />
          </GeoJSONSource>
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
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 12 },
})
