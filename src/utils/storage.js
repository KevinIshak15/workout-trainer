export const STORAGE_KEY = 'workoutData'
export const SCHEMA_VERSION = 2

let idCounter = 0
export function uid(prefix = '') {
  idCounter = (idCounter + 1) % 1000
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function emptyData() {
  return { version: SCHEMA_VERSION, workouts: [], history: [] }
}

const LEGACY_DAY_NAMES = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

// v1 stored `days: { monday: [exercises] }`. Each day becomes one legacy workout session so
// nothing the user already logged is lost.
function migrateV1(data) {
  const workouts = Object.entries(data.days || {}).map(([dayId, exercises], index) => ({
    id: uid('w'),
    splitId: 'legacy',
    label: LEGACY_DAY_NAMES[dayId] || dayId,
    createdAt: new Date(Date.now() - index).toISOString(),
    exercises: (exercises || []).map(ex => ({
      id: ex.id || uid('e'),
      name: ex.name,
      sets: (ex.sets || []).map(s => ({
        id: uid('s'),
        weight: s.weight ?? '',
        reps: s.reps ?? '',
        completed: !!s.completed,
      })),
    })),
  }))

  const history = (data.history || []).map(h => ({
    id: h.id || uid('h'),
    date: h.date,
    exercise: h.exercise,
    weight: h.weight,
    reps: h.reps,
    splitId: 'legacy',
    workoutId: null,
    setKey: null,
  }))

  return { version: SCHEMA_VERSION, workouts, history }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyData()
    if (!parsed.version || parsed.version < 2) return migrateV1(parsed)
    return {
      version: SCHEMA_VERSION,
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    }
  } catch {
    return emptyData()
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable (private mode). The in-memory state still works for the session.
  }
}

export function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
