import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native'
import { OSM_STYLE, openDirections, viewForPoints, type MapPoint } from '../lib/maps'

export type { MapPoint } from '../lib/maps'

const PADDING = { top: 40, right: 40, bottom: 40, left: 40 }

type PointsMapProps = {
  points: MapPoint[]
  height?: number
  // Ponto selecionado inicialmente (por omissão, o único ponto quando há só um).
  initialSelectedId?: string
  color?: string
  style?: StyleProp<ViewStyle>
}

// Mapa nativo (MapLibre + OpenStreetMap) com um ou vários pontos; tocar num marcador mostra o nome e "Direções".
export function PointsMap({ points, height = 224, initialSelectedId, color = '#ea580c', style }: PointsMapProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialSelectedId ?? (points.length === 1 ? points[0].id : undefined),
  )
  const view = useMemo(() => viewForPoints(points), [points])
  const stop = useMemo(
    () => (view && 'bounds' in view ? { bounds: view.bounds, padding: PADDING } : view ?? undefined),
    [view],
  )
  const selected = points.find(p => p.id === selectedId)

  if (!stop) {
    return (
      <View style={[styles.container, styles.empty, { height }, style]}>
        <Text style={styles.emptyText}>Sem localização disponível.</Text>
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
        <Camera {...stop} maxZoom={18} />
        {points.map(p => (
          <Marker
            key={p.id}
            id={p.id}
            lngLat={[p.longitude, p.latitude]}
            anchor="bottom"
            onPress={() => setSelectedId(p.id)}
          >
            <View style={styles.pinHitArea}>
              <View style={[styles.pin, { backgroundColor: p.id === selectedId ? color : '#2563eb' }]} />
            </View>
          </Marker>
        ))}
      </Map>

      {selected && (
        <View style={styles.callout}>
          <View style={styles.calloutText}>
            <Text style={styles.calloutLabel} numberOfLines={2}>{selected.label}</Text>
            {selected.description && (
              <Text style={styles.calloutDescription} numberOfLines={2}>{selected.description}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => openDirections(selected.latitude, selected.longitude)}>
            <Text style={styles.calloutAction}>🧭 Direções</Text>
          </TouchableOpacity>
          {points.length > 1 && (
            <TouchableOpacity onPress={() => setSelectedId(undefined)} hitSlop={8}>
              <Text style={styles.calloutClose}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

type SinglePointMapProps = {
  latitude: number
  longitude: number
  label: string
  description?: string
  height?: number
  style?: StyleProp<ViewStyle>
}

export function SinglePointMap({ latitude, longitude, label, description, height, style }: SinglePointMapProps) {
  const points = useMemo(
    () => [{ id: 'point', latitude, longitude, label, description }],
    [latitude, longitude, label, description],
  )
  return <PointsMap points={points} height={height} style={style} />
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
  pinHitArea: { padding: 6 },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: 'white',
    elevation: 3,
  },
  callout: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 4,
  },
  calloutText: { flex: 1 },
  calloutLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  calloutDescription: { fontSize: 11, color: '#64748b', marginTop: 2 },
  calloutAction: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  calloutClose: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 2 },
})
