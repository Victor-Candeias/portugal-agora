import { useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native'
import { boundaryBounds, type GeoBoundary } from '@portugal-hoje/core'
import { OSM_STYLE } from '../lib/maps'

const PADDING = { top: 24, right: 24, bottom: 24, left: 24 }

// Fronteira de um concelho (GeoJSON) no mapa nativo, enquadrada nos seus limites (WEB-042).
export function BoundaryMap({
  boundary,
  height = 280,
  color = '#16a34a',
  style,
}: {
  boundary: GeoBoundary
  height?: number
  color?: string
  style?: StyleProp<ViewStyle>
}) {
  const bounds = useMemo(() => boundaryBounds(boundary), [boundary])

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
        <Camera bounds={bounds} padding={PADDING} />
        <GeoJSONSource id="boundary" data={boundary as GeoJSON.Feature}>
          <Layer id="boundary-fill" type="fill" paint={{ 'fill-color': color, 'fill-opacity': 0.12 }} />
          <Layer id="boundary-line" type="line" paint={{ 'line-color': color, 'line-width': 2 }} />
        </GeoJSONSource>
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
