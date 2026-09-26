// Epley formula: a reasonable estimate of one-rep max from a working set.
export function estimate1RM(weight, reps) {
  const w = parseFloat(weight) || 0
  const r = parseInt(reps, 10) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30))
}

// Local calendar day, so an evening session is not pushed into tomorrow by UTC.
export function dayKey(isoDate) {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return String(isoDate).slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatShortDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Collapses raw set history into one point per training day for a single exercise.
export function buildExerciseSeries(history, exerciseName) {
  const byDay = new Map()
  for (const h of history) {
    if (h.exercise !== exerciseName) continue
    const w = parseFloat(h.weight) || 0
    const r = parseInt(h.reps, 10) || 0
    if (w <= 0 || r <= 0) continue
    const key = dayKey(h.date)
    if (!byDay.has(key)) byDay.set(key, { date: key, maxWeight: 0, volume: 0, e1rm: 0, sets: 0, reps: 0, bestSet: null })
    const p = byDay.get(key)
    p.sets += 1
    p.reps += r
    p.volume += w * r
    if (w > p.maxWeight) p.maxWeight = w
    const e = estimate1RM(w, r)
    if (e > p.e1rm) {
      p.e1rm = e
      p.bestSet = { weight: w, reps: r }
    }
  }
  return Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function summarizeSeries(series) {
  if (series.length === 0) return null
  const first = series[0]
  const last = series[series.length - 1]
  let prIndex = 0
  for (let i = 1; i < series.length; i++) {
    if (series[i].e1rm > series[prIndex].e1rm) prIndex = i
  }
  const changePct = first.e1rm > 0 ? Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 100) : 0
  return {
    sessions: series.length,
    bestWeight: Math.max(...series.map(p => p.maxWeight)),
    bestE1rm: series[prIndex].e1rm,
    prDate: series[prIndex].date,
    prIndex,
    lastSession: last,
    changePct,
    totalVolume: series.reduce((s, p) => s + p.volume, 0),
  }
}

// Every exercise that has at least one logged set, sorted by most recently trained.
export function listTrackedExercises(history) {
  const seen = new Map()
  for (const h of history) {
    const w = parseFloat(h.weight) || 0
    const r = parseInt(h.reps, 10) || 0
    if (w <= 0 || r <= 0) continue
    const prev = seen.get(h.exercise)
    if (!prev || h.date > prev) seen.set(h.exercise, h.date)
  }
  return Array.from(seen.entries())
    .sort((a, b) => (a[1] > b[1] ? -1 : 1))
    .map(([name]) => name)
}

export function lastPerformance(history, exerciseName) {
  const series = buildExerciseSeries(history, exerciseName)
  return series.length ? series[series.length - 1] : null
}

// ---------- line chart helpers ----------

export const METRICS = [
  { id: 'e1rm', label: 'Est. 1RM', unit: 'lbs', value: p => p.e1rm },
  { id: 'maxWeight', label: 'Max weight', unit: 'lbs', value: p => p.maxWeight },
  { id: 'volume', label: 'Volume', unit: 'lbs', value: p => Math.round(p.volume) },
  { id: 'reps', label: 'Reps', unit: 'reps', value: p => p.reps },
]

export const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
]

// Local noon, so the point sits in the middle of its day regardless of DST shifts.
export function dayKeyToTime(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

export function filterRange(series, rangeId) {
  const range = RANGES.find(r => r.id === rangeId)
  if (!range || range.days == null) return series
  const cutoff = Date.now() - range.days * 86400000
  return series.filter(p => dayKeyToTime(p.date) >= cutoff)
}

export function toChartPoints(series, metricId) {
  const metric = METRICS.find(m => m.id === metricId) || METRICS[0]
  return series.map(p => ({ t: dayKeyToTime(p.date), v: metric.value(p), source: p }))
}

// Least-squares line through the points; slope is reported per week so it reads naturally.
export function linearTrend(points) {
  const n = points.length
  if (n < 2) return null
  const t0 = points[0].t
  const xs = points.map(p => (p.t - t0) / 86400000)
  const ys = points.map(p => p.v)
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = my - slope * mx
  return {
    perWeek: slope * 7,
    at: t => intercept + slope * ((t - t0) / 86400000),
  }
}

// "Nice" 1-2-5 axis ticks covering [min, max].
export function niceTicks(min, max, target = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1)
    min -= pad
    max += pad
  }
  const rawStep = (max - min) / target
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const ticks = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  const offset = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - offset)
  return d
}

// Total volume per calendar week (Monday start) for the last N weeks, zero-filled.
export function weeklyVolumeSeries(history, weeks = 12) {
  const thisWeek = startOfWeek(new Date())
  const buckets = []
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek)
    d.setDate(d.getDate() - i * 7)
    buckets.push({ t: d.getTime(), v: 0, sets: 0 })
  }
  const first = buckets[0].t
  for (const h of history) {
    const w = parseFloat(h.weight) || 0
    const r = parseInt(h.reps, 10) || 0
    if (w <= 0 || r <= 0) continue
    const start = startOfWeek(new Date(h.date)).getTime()
    if (start < first) continue
    const idx = buckets.findIndex(b => b.t === start)
    if (idx === -1) continue
    buckets[idx].v += w * r
    buckets[idx].sets += 1
  }
  return buckets.map(b => ({ ...b, v: Math.round(b.v) }))
}

// ---------- one-rep PRs ----------

// Sorted oldest → newest, so the chart and "current best" derive from the same list.
export function prSeriesFor(prs, exerciseName) {
  return prs
    .filter(p => p.exercise === exerciseName && (parseFloat(p.weight) || 0) > 0)
    .map(p => ({ ...p, w: parseFloat(p.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export function prPoints(prSeries) {
  return prSeries.map(p => ({ t: new Date(p.date).getTime(), v: p.w, source: p }))
}

// Per-exercise summary: current best, previous best (for the delta) and the most recent attempt.
export function summarizePRs(prs) {
  const byExercise = new Map()
  for (const p of prs) {
    if ((parseFloat(p.weight) || 0) <= 0) continue
    if (!byExercise.has(p.exercise)) byExercise.set(p.exercise, [])
    byExercise.get(p.exercise).push(p)
  }
  const out = []
  for (const [exercise, list] of byExercise) {
    const sorted = prSeriesFor(list, exercise)
    let best = sorted[0]
    let previousBest = null
    for (const p of sorted) {
      if (p.w > best.w) {
        previousBest = best
        best = p
      }
    }
    out.push({
      exercise,
      best,
      previousBest,
      latest: sorted[sorted.length - 1],
      attempts: sorted.length,
      first: sorted[0],
    })
  }
  return out.sort((a, b) => b.latest.date.localeCompare(a.latest.date))
}

export function overallStats(history) {
  const valid = history.filter(h => (parseFloat(h.weight) || 0) > 0 && (parseInt(h.reps, 10) || 0) > 0)
  const days = new Set(valid.map(h => dayKey(h.date)))
  return {
    trainingDays: days.size,
    setsLogged: valid.length,
    totalVolume: valid.reduce((s, h) => s + parseFloat(h.weight) * parseInt(h.reps, 10), 0),
    exercises: new Set(valid.map(h => h.exercise)).size,
  }
}
