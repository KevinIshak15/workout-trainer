import { useMemo, useState } from 'react'
import { formatShortDate } from '../utils/progress'

const W = 320
const H = 170
const PAD = { top: 18, right: 14, bottom: 26, left: 36 }

function scale(series, key, innerH) {
  const values = series.map(p => p[key])
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || max || 1
  const lo = Math.max(0, min - span * 0.25)
  const hi = max + span * 0.15
  return v => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH
}

export function Sparkline({ series, color, width = 84, height = 28 }) {
  if (!series || series.length === 0) return <svg width={width} height={height} />
  const xs = series.length === 1 ? [width / 2] : series.map((_, i) => (i / (series.length - 1)) * (width - 4) + 2)
  const values = series.map(p => p.e1rm)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const ys = values.map(v => height - 3 - ((v - min) / span) * (height - 6))
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const last = series.length - 1
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[last]} cy={ys[last]} r="3" fill={color} />
    </svg>
  )
}

export default function ProgressChart({ series, color, prIndex }) {
  const [selected, setSelected] = useState(series.length - 1)

  const geometry = useMemo(() => {
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const n = series.length
    const xAt = i => (n === 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW)
    const yE1rm = scale(series, 'e1rm', innerH)
    const maxVolume = Math.max(...series.map(p => p.volume)) || 1
    const barW = Math.max(6, Math.min(26, innerW / Math.max(n, 1) - 8))

    const points = series.map((p, i) => ({ x: xAt(i), y: yE1rm(p.e1rm), p }))
    const linePath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
    const baseline = PAD.top + innerH
    const areaPath = n > 1
      ? `${linePath} L${points[n - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`
      : ''

    const bars = series.map((p, i) => {
      const h = (p.volume / maxVolume) * innerH * 0.55
      return { x: xAt(i) - barW / 2, y: baseline - h, w: barW, h }
    })

    const e1rms = series.map(p => p.e1rm)
    const yTicks = [Math.max(...e1rms), Math.min(...e1rms)].filter((v, i, a) => a.indexOf(v) === i)
    const labelIdx = n <= 3 ? series.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]

    return { points, linePath, areaPath, bars, baseline, yE1rm, yTicks, labelIdx }
  }, [series])

  const active = series[selected] || series[series.length - 1]
  const gradId = `grad-${color.replace('#', '')}`

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Progress chart">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geometry.yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geometry.yE1rm(v)} y2={geometry.yE1rm(v)} className="chart-grid" />
            <text x={PAD.left - 6} y={geometry.yE1rm(v) + 4} className="chart-axis" textAnchor="end">{v}</text>
          </g>
        ))}

        {geometry.bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="3" className="chart-bar" opacity={i === selected ? 0.5 : 0.22} />
        ))}

        {geometry.areaPath && <path d={geometry.areaPath} fill={`url(#${gradId})`} />}
        <path d={geometry.linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {geometry.points.map((pt, i) => (
          <g key={i} onClick={() => setSelected(i)} className="chart-point">
            <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
            {i === prIndex && <circle cx={pt.x} cy={pt.y} r="8" fill="none" stroke="#f59e0b" strokeWidth="2" />}
            <circle cx={pt.x} cy={pt.y} r={i === selected ? 5 : 3.5} fill={i === selected ? '#fff' : color} stroke={color} strokeWidth="2" />
          </g>
        ))}

        {geometry.labelIdx.map(i => (
          <text key={i} x={geometry.points[i].x} y={H - 8} className="chart-axis" textAnchor={i === 0 && series.length > 1 ? 'start' : i === series.length - 1 && series.length > 1 ? 'end' : 'middle'}>
            {formatShortDate(series[i].date)}
          </text>
        ))}
      </svg>

      {active && (
        <div className="chart-tooltip">
          <span className="chart-tooltip-date">{formatShortDate(active.date)}</span>
          <span className="chart-tooltip-item"><strong>{active.e1rm}</strong> est. 1RM</span>
          <span className="chart-tooltip-item"><strong>{active.bestSet.weight}</strong> × {active.bestSet.reps}</span>
          <span className="chart-tooltip-item"><strong>{Math.round(active.volume).toLocaleString()}</strong> vol</span>
        </div>
      )}
    </div>
  )
}
