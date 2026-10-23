// Gráfico de linhas com lacunas (MOB-021) em react-native-svg: cada troço contínuo é um `Path` e os
// dias sem dados ficam em branco, sombreados, nunca ligados nem desenhados como zero (equivalente ao
// `connectNulls={false}` do Recharts no web). Pontos isolados entre lacunas aparecem como círculos.
import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { COLORS } from './ui'

export interface LineChartPoint {
  /** Rótulo do eixo X (p. ex. `DD/MM`). */
  label: string
  /** `null` nas lacunas. */
  value: number | null
}

const PAD = { top: 10, right: 10, bottom: 22, left: 52 }
const Y_TICKS = 3

export function SnsLineChart({
  points,
  height = 220,
  color = COLORS.primary,
  formatTick = v => String(v),
  showDots = false,
  accessibilityLabel,
}: {
  points: LineChartPoint[]
  height?: number
  color?: string
  formatTick?: (value: number) => string
  showDots?: boolean
  accessibilityLabel?: string
}) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))

  const values = points.map(p => p.value).filter((v): v is number => v !== null)
  let lo = values.length ? Math.min(...values) : 0
  let hi = values.length ? Math.max(...values) : 1
  const span = hi - lo
  const pad = span > 0 ? span * 0.1 : Math.max(Math.abs(hi) * 0.1, 1)
  lo -= pad
  hi += pad
  if (Math.min(...values) >= 0 && lo < 0) lo = 0

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const step = points.length > 1 ? plotW / (points.length - 1) : 0
  const x = (i: number) => PAD.left + (points.length > 1 ? i * step : plotW / 2)
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH

  const runs: { index: number; value: number }[][] = []
  let run: { index: number; value: number }[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run)
      run = []
    } else run.push({ index: i, value: p.value })
  })
  if (run.length) runs.push(run)

  const ticks = Array.from({ length: Y_TICKS }, (_, i) => lo + ((hi - lo) * i) / (Y_TICKS - 1))
  const xLabels = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i)
  const gapW = Math.max(step, 2)

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {points.map((p, i) =>
            p.value === null ? (
              <Rect key={`gap-${i}`} x={x(i) - gapW / 2} y={PAD.top} width={gapW} height={plotH} fill="#f1f5f9" />
            ) : null,
          )}
          {ticks.map(t => (
            <Line key={`grid-${t}`} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={COLORS.border} strokeDasharray="3 3" />
          ))}
          {ticks.map(t => (
            <SvgText key={`tick-${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={10} fill={COLORS.muted} textAnchor="end">
              {formatTick(t)}
            </SvgText>
          ))}
          {xLabels.map((i, k) => (
            <SvgText
              key={`x-${i}`}
              x={x(i)}
              y={height - 6}
              fontSize={10}
              fill={COLORS.muted}
              textAnchor={k === 0 && xLabels.length > 1 ? 'start' : k === xLabels.length - 1 && xLabels.length > 1 ? 'end' : 'middle'}
            >
              {points[i]?.label}
            </SvgText>
          ))}
          {runs.map(r =>
            r.length > 1 ? (
              <Path
                key={`run-${r[0].index}`}
                d={r.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
                stroke={color}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          {runs.flatMap(r =>
            showDots || r.length === 1
              ? r.map(p => <Circle key={`dot-${p.index}`} cx={x(p.index)} cy={y(p.value)} r={3} fill={color} />)
              : [],
          )}
        </Svg>
      )}
    </View>
  )
}
