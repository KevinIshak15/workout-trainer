import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { linearTrend, niceTicks } from '../utils/progress'

const PAD = { top: 26, right: 16, bottom: 26, left: 40 }

function useWidth(ref, fallback = 340) {
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => setWidth(el.clientWidth || fallback)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, fallback])
  return width
}

// Monotone cubic interpolation (Fritsch–Carlson): smooth, but never overshoots the data,
// so a PR still reads as the highest point on the curve.
function smoothPath(pts) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x},${pts[0].y}`
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`
  const dx = []
  const dy = []
  const m = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x || 1e-6)
    dy.push(pts[i + 1].y - pts[i].y)
    m.push(dy[i] / dx[i])
  }
  const tangents = [m[0]]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tangents.push(0)
    else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      tangents.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]))
    }
  }
  tangents.push(m[n - 2])
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    const c1x = pts[i].x + h / 3
    const c1y = pts[i].y + (tangents[i] * h) / 3
    const c2x = pts[i + 1].x - h / 3
    const c2y = pts[i + 1].y - (tangents[i + 1] * h) / 3
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`
  }
  return d
}

function compact(v) {
  if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)
}

function linearPath(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function formatAxisDate(t, spanDays) {
  const d = new Date(t)
  if (spanDays > 400) return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatFullDate(t) {
  return new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Interactive time-series line chart.
 * points: [{ t: epochMs, v: number }] sorted by t.
 */
export default function LineChart({
  points, color, height = 220, selected, onSelect, prIndex = -1,
  showTrend = true, showPoints = true, smooth = true, unit = '', yFormat = compact, emptyLabel = 'No data in this range',
}) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const [animKey, setAnimKey] = useState(0)
  const sig = points.map(p => `${p.t}:${p.v}`).join('|')
  useEffect(() => { setAnimKey(k => k + 1) }, [sig])

  const geo = useMemo(() => {
    const n = points.length
    if (n === 0) return null
    const innerW = Math.max(40, width - PAD.left - PAD.right)
    const innerH = height - PAD.top - PAD.bottom
    const t0 = points[0].t
    const t1 = points[n - 1].t
    const spanT = t1 - t0
    const spanDays = spanT / 86400000
    const xAt = t => (spanT === 0 ? PAD.left + innerW / 2 : PAD.left + ((t - t0) / spanT) * innerW)

    const values = points.map(p => p.v)
    let lo = Math.min(...values)
    let hi = Math.max(...values)
    const span = hi - lo || Math.max(hi, 1)
    lo = Math.max(0, lo - span * 0.3)
    hi = hi + span * 0.25
    if (lo === hi) hi = lo + 1
    const ticks = niceTicks(lo, hi, 4)
    const yAt = v => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

    const pts = points.map(p => ({ x: xAt(p.t), y: yAt(p.v), p }))
    const line = smooth ? smoothPath(pts) : linearPath(pts)
    const baseline = PAD.top + innerH
    const area = n > 1 ? `${line} L${pts[n - 1].x.toFixed(1)},${baseline} L${pts[0].x.toFixed(1)},${baseline} Z` : ''

    const trend = showTrend && n >= 3 ? linearTrend(points) : null
    const trendLine = trend
      ? { x1: pts[0].x, y1: yAt(trend.at(t0)), x2: pts[n - 1].x, y2: yAt(trend.at(t1)) }
      : null

    // Up to four evenly-spaced date labels, skipping ones that would collide.
    const labelCount = n <= 2 ? n : Math.min(4, n)
    const labelIdx = []
    for (let i = 0; i < labelCount; i++) labelIdx.push(Math.round((i / Math.max(labelCount - 1, 1)) * (n - 1)))
    const labels = Array.from(new Set(labelIdx)).map(i => ({
      x: pts[i].x,
      text: formatAxisDate(points[i].t, spanDays),
      anchor: n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle',
    }))

    return { pts, line, area, ticks, yAt, baseline, trendLine, labels, innerW }
  }, [points, width, height, showTrend, smooth])

  const pointerToIndex = (clientX) => {
    if (!geo || !wrapRef.current) return -1
    const rect = wrapRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    let best = 0
    let bestDist = Infinity
    geo.pts.forEach((pt, i) => {
      const d = Math.abs(pt.x - x)
      if (d < bestDist) { bestDist = d; best = i }
    })
    return best
  }

  const handlePointer = (e) => {
    if (!onSelect) return
    const idx = pointerToIndex(e.clientX)
    if (idx >= 0 && idx !== selected) onSelect(idx)
  }

  if (!geo) {
    return <div className="linechart linechart-empty" style={{ height }} ref={wrapRef}>{emptyLabel}</div>
  }

  const sel = selected != null && selected >= 0 && selected < geo.pts.length ? geo.pts[selected] : null
  const gradId = `lc-grad-${color.replace('#', '')}`
  const bubbleText = sel ? `${yFormat(sel.p.v)}${unit ? ` ${unit}` : ''}` : ''
  const bubbleW = Math.max(44, bubbleText.length * 7 + 16)
  const bubbleX = sel ? Math.min(Math.max(sel.x - bubbleW / 2, PAD.left - 30), width - PAD.right - bubbleW + 12) : 0

  return (
    <div
      className="linechart"
      ref={wrapRef}
      style={{ height, touchAction: 'pan-y' }}
      onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); handlePointer(e) }}
      onPointerMove={e => { if (e.buttons > 0 || e.pointerType === 'touch') handlePointer(e) }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="linechart-svg" role="img" aria-label="Progress line chart">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geo.ticks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={geo.yAt(v)} y2={geo.yAt(v)} className="lc-grid" />
            <text x={PAD.left - 8} y={geo.yAt(v) + 3.5} className="lc-axis" textAnchor="end">{yFormat(v)}</text>
          </g>
        ))}

        {geo.area && <path d={geo.area} fill={`url(#${gradId})`} className="lc-area" />}

        {geo.trendLine && (
          <line {...geo.trendLine} className="lc-trend" />
        )}

        <path key={animKey} d={geo.line} className="lc-line" stroke={color} pathLength="1" />

        {sel && (
          <line x1={sel.x} x2={sel.x} y1={PAD.top - 4} y2={geo.baseline} className="lc-cursor" />
        )}

        {showPoints && geo.pts.map((pt, i) => (
          <g key={i}>
            {i === prIndex && <circle cx={pt.x} cy={pt.y} r="9" className="lc-pr" />}
            {(geo.pts.length <= 24 || i === selected) && (
              <circle cx={pt.x} cy={pt.y} r={i === selected ? 5.5 : 3.5} className="lc-dot" fill={i === selected ? '#fff' : color} stroke={color} />
            )}
          </g>
        ))}

        {sel && (
          <g className="lc-bubble">
            <rect x={bubbleX} y={2} width={bubbleW} height={20} rx="6" />
            <text x={bubbleX + bubbleW / 2} y={16} textAnchor="middle" className="lc-bubble-text">{bubbleText}</text>
          </g>
        )}

        {geo.labels.map((l, i) => (
          <text key={i} x={l.x} y={height - 8} className="lc-axis" textAnchor={l.anchor}>{l.text}</text>
        ))}
      </svg>
    </div>
  )
}

export function Sparkline({ points, color, width = 84, height = 30 }) {
  if (!points || points.length === 0) return <svg width={width} height={height} />
  const n = points.length
  const t0 = points[0].t
  const spanT = points[n - 1].t - t0
  const xs = points.map(p => (spanT === 0 ? width / 2 : 3 + ((p.t - t0) / spanT) * (width - 6)))
  const values = points.map(p => p.v)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const ys = values.map(v => height - 4 - ((v - min) / span) * (height - 8))
  const pts = xs.map((x, i) => ({ x, y: ys[i] }))
  const d = smoothPath(pts)
  const area = n > 1 ? `${d} L${xs[n - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z` : ''
  const gradId = `sp-grad-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gradId})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[n - 1]} cy={ys[n - 1]} r="3" fill={color} />
    </svg>
  )
}
