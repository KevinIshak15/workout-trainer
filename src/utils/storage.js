export const STORAGE_KEY = 'workoutData'
export const SCHEMA_VERSION = 2

export function uid(prefix = '') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}${crypto.randomUUID()}`
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyData() {
  return { version: SCHEMA_VERSION, workouts: [], history: [], prs: [] }
}

const LEGACY_DAY_NAMES = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

// v1 stored `days: { monday: [exercises] }` plus flat history rows tagged with `dayId`.
// Each day becomes one legacy session, and history rows are re-linked to the matching
// completed set so later edits replace rather than duplicate them.
function migrateV1(data) {
  const rawHistory = Array.isArray(data.history) ? data.history : []
  const workouts = Object.entries(data.days || {}).map(([dayId, exercises]) => {
    const dayDates = rawHistory.filter(h => h.dayId === dayId && h.date).map(h => h.date).sort()
    return {
      id: uid('w'),
      legacyDayId: dayId,
      splitId: 'legacy',
      label: LEGACY_DAY_NAMES[dayId] || dayId,
      createdAt: dayDates[dayDates.length - 1] || new Date(0).toISOString(),
      exercises: (exercises || []).map(ex => ({
        id: uid('e'),
        name: ex.name,
        sets: (ex.sets || []).map(s => ({
          id: uid('s'),
          weight: s.weight == null ? '' : String(s.weight),
          reps: s.reps == null ? '' : String(s.reps),
          completed: !!s.completed,
        })),
      })),
    }
  })

  const byDay = Object.fromEntries(workouts.map(w => [w.legacyDayId, w]))
  const claimed = new Set()

  const history = rawHistory.map(h => {
    const workout = byDay[h.dayId]
    let setKey = null
    if (workout) {
      for (const ex of workout.exercises) {
        if (ex.name !== h.exercise) continue
        const set = ex.sets.find(s => s.completed && String(s.weight) === String(h.weight) && String(s.reps) === String(h.reps)
          && !claimed.has(`${workout.id}:${ex.id}:${s.id}`))
        if (set) {
          setKey = `${workout.id}:${ex.id}:${set.id}`
          claimed.add(setKey)
          break
        }
      }
    }
    return {
      id: uid('h'),
      date: h.date,
      exercise: h.exercise,
      weight: String(h.weight ?? ''),
      reps: String(h.reps ?? ''),
      splitId: 'legacy',
      workoutId: workout?.id ?? null,
      setKey,
    }
  })

  for (const w of workouts) delete w.legacyDayId
  return { version: SCHEMA_VERSION, workouts, history, prs: [] }
}

function normalizeV2(parsed) {
  return {
    version: SCHEMA_VERSION,
    workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
    prs: Array.isArray(parsed.prs) ? parsed.prs : [],
  }
}

// Returns { data, ok }. `ok` is false when the stored blob was unreadable; callers must not
// persist over it until the user makes a real change, so a transient failure cannot wipe data.
export function loadData() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { data: emptyData(), ok: true }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
    if (!parsed.version || parsed.version < 2) return { data: migrateV1(parsed), ok: true }
    return { data: normalizeV2(parsed), ok: true }
  } catch {
    try { if (raw) localStorage.setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, raw) } catch { /* nothing more we can do */ }
    return { data: emptyData(), ok: false }
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export async function exportData(data) {
  const json = JSON.stringify(data, null, 2)
  const filename = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([json], filename, { type: 'application/json' })

  // Home-screen PWAs on iOS cannot trigger anchor downloads reliably; the share sheet can save to Files.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Workout backup' })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function parseImport(text) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Not a workout backup file')
  if (!parsed.version || parsed.version < 2) {
    if (!parsed.days && !parsed.history) throw new Error('Not a workout backup file')
    return migrateV1(parsed)
  }
  if (!Array.isArray(parsed.workouts) || !Array.isArray(parsed.history)) throw new Error('Backup is missing workouts or history')
  return normalizeV2(parsed)
}
