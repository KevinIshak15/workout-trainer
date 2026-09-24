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
    if (!byDay.has(key)) byDay.set(key, { date: key, maxWeight: 0, volume: 0, e1rm: 0, sets: 0, bestSet: null })
    const p = byDay.get(key)
    p.sets += 1
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
