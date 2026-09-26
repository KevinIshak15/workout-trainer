import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SPLITS, CATALOG, getSplit } from './data/splits'
import { loadData, saveData, exportData, parseImport, uid } from './utils/storage'
import {
  buildExerciseSeries, summarizeSeries, listTrackedExercises, lastPerformance,
  overallStats, formatShortDate, dayKey,
  METRICS, RANGES, filterRange, toChartPoints, linearTrend, weeklyVolumeSeries,
  prSeriesFor, prPoints, summarizePRs,
} from './utils/progress'
import LineChart, { Sparkline, formatFullDate } from './components/ProgressChart'
import {
  DumbbellIcon, ClipboardIcon, TrendingIcon, ClockIcon, TrashIcon, CheckIcon,
  ChevronRightIcon, ChevronLeftIcon, CloseIcon, PlusIcon, TrophyIcon,
  ArrowUpIcon, ArrowDownIcon, DownloadIcon,
} from './components/Icons'

const REST_SECONDS = 90

function newSet(weight = '') {
  return { id: uid('s'), weight, reps: '', completed: false }
}

function newExercise(name, weight = '') {
  return { id: uid('e'), name, sets: [newSet(weight)] }
}

function formatWorkoutDate(iso) {
  const key = dayKey(iso)
  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString())
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return formatShortDate(key)
}

function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

function todayInputValue() {
  return dayKey(new Date().toISOString())
}

// A date picked in the form becomes local noon, so it never rolls into the neighbouring day.
function inputDateToISO(value) {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return new Date().toISOString()
  return new Date(y, m - 1, d, 12).toISOString()
}

function splitColorFor(exerciseName) {
  return getSplit(CATALOG.find(c => c.name === exerciseName)?.splitIds[0]).color
}

function formatSigned(n, digits = 0) {
  const rounded = Number(n.toFixed(digits))
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
}

function hasValues(set) {
  return (parseFloat(set.weight) || 0) > 0 && (parseInt(set.reps, 10) || 0) > 0
}

// Inputs are controlled strings, so carried-over weights are stored as strings too.
function lastWeightFor(history, exerciseName) {
  const last = lastPerformance(history, exerciseName)
  return last ? String(last.maxWeight) : ''
}

// Text inputs with numeric keypads: keep digits (and one decimal point for weight) only.
function sanitizeNumber(value, allowDecimal) {
  const cleaned = value.replace(allowDecimal ? /[^\d.]/g : /\D/g, '')
  if (!allowDecimal) return cleaned
  const [head, ...rest] = cleaned.split('.')
  return rest.length ? `${head}.${rest.join('')}` : head
}

export default function App() {
  const [loaded] = useState(loadData)
  const [data, setData] = useState(loaded.data)
  const [storageNotice, setStorageNotice] = useState(
    loaded.ok ? null : 'Saved data could not be read. A copy was kept in storage; new entries will still be saved.',
  )
  const [tab, setTab] = useState('workouts')
  const [activeWorkoutId, setActiveWorkoutId] = useState(null)
  const [progressExercise, setProgressExercise] = useState(null)
  const [metricId, setMetricId] = useState('e1rm')
  const [rangeId, setRangeId] = useState('all')
  const [chartSel, setChartSel] = useState(null)
  const [weekSel, setWeekSel] = useState(null)

  const [prExercise, setPrExercise] = useState(null)
  const [prSel, setPrSel] = useState(null)
  const [showRecordPR, setShowRecordPR] = useState(false)
  const [prForm, setPrForm] = useState({ exercise: '', weight: '', date: todayInputValue(), note: '' })
  const [prSearch, setPrSearch] = useState('')

  const [showNewWorkout, setShowNewWorkout] = useState(false)
  const [newSplitId, setNewSplitId] = useState(SPLITS[0].id)
  const [prefill, setPrefill] = useState(true)

  const [showAddExercise, setShowAddExercise] = useState(false)
  const [search, setSearch] = useState('')
  const [catalogFilter, setCatalogFilter] = useState('current')
  const [justAdded, setJustAdded] = useState(null)
  const flashTimer = useRef(null)
  const importInput = useRef(null)

  const [restEndsAt, setRestEndsAt] = useState(null)
  const [restLeft, setRestLeft] = useState(0)

  // Skip the mount-time save: if loading failed we must not overwrite whatever is in storage
  // until the user actually changes something.
  const isFirstSave = useRef(true)
  useEffect(() => {
    if (isFirstSave.current) { isFirstSave.current = false; return }
    if (!saveData(data)) setStorageNotice('Could not save. Storage may be full or blocked (private browsing).')
    else if (storageNotice?.startsWith('Could not save')) setStorageNotice(null)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive the countdown from a wall-clock deadline so it stays correct after the phone is locked.
  useEffect(() => {
    if (!restEndsAt) { setRestLeft(0); return undefined }
    const tick = () => {
      const left = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000))
      setRestLeft(left)
      if (left === 0) {
        setRestEndsAt(null)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      }
    }
    tick()
    const interval = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick) }
  }, [restEndsAt])

  const modalOpen = showNewWorkout || showAddExercise || showRecordPR
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modalOpen])

  const activeWorkout = data.workouts.find(w => w.id === activeWorkoutId) || null
  const sortedWorkouts = useMemo(
    () => [...data.workouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.workouts],
  )

  // Previous best set per exercise, excluding the session currently open.
  const lastByExercise = useMemo(() => {
    const rows = activeWorkoutId ? data.history.filter(h => h.workoutId !== activeWorkoutId) : data.history
    const map = new Map()
    for (const name of new Set(rows.map(h => h.exercise))) map.set(name, lastPerformance(rows, name))
    return map
  }, [data.history, activeWorkoutId])

  const seriesByExercise = useMemo(() => {
    const map = new Map()
    for (const name of listTrackedExercises(data.history)) map.set(name, buildExerciseSeries(data.history, name))
    return map
  }, [data.history])

  const weeklyPoints = useMemo(() => weeklyVolumeSeries(data.history, 12), [data.history])
  const prSummaries = useMemo(() => summarizePRs(data.prs), [data.prs])

  const openProgress = (name) => {
    setChartSel(null)
    setProgressExercise(name)
  }

  const openPR = (name) => {
    setPrSel(null)
    setPrExercise(name)
  }

  // ---------- PR mutations ----------

  const openRecordPR = (exercise = '') => {
    setPrForm({ exercise, weight: '', date: todayInputValue(), note: '' })
    setPrSearch('')
    setShowRecordPR(true)
  }

  const savePR = () => {
    const exercise = prForm.exercise.trim()
    const weight = parseFloat(prForm.weight) || 0
    if (!exercise || weight <= 0) return
    const entry = {
      id: uid('pr'),
      exercise,
      weight: String(weight),
      date: inputDateToISO(prForm.date),
      note: prForm.note.trim(),
    }
    setData(prev => ({ ...prev, prs: [...prev.prs, entry] }))
    setShowRecordPR(false)
    setPrSel(null)
    if (tab === 'prs') setPrExercise(exercise)
  }

  const deletePR = (id) => {
    const entry = data.prs.find(p => p.id === id)
    if (!entry || !window.confirm(`Delete the ${entry.weight} lbs ${entry.exercise} PR?`)) return
    setData(prev => ({ ...prev, prs: prev.prs.filter(p => p.id !== id) }))
    setPrSel(null)
    const remaining = data.prs.filter(p => p.id !== id && p.exercise === entry.exercise)
    if (remaining.length === 0) setPrExercise(null)
  }

  // ---------- workout mutations ----------

  const updateWorkout = (workoutId, fn) => {
    setData(prev => ({
      ...prev,
      workouts: prev.workouts.map(w => (w.id === workoutId ? fn(w) : w)),
    }))
  }

  const createWorkout = (splitId, withExercises) => {
    const split = getSplit(splitId)
    const workout = {
      id: uid('w'),
      splitId,
      createdAt: new Date().toISOString(),
      exercises: withExercises
        ? split.exercises.map(name => newExercise(name, lastWeightFor(data.history, name)))
        : [],
    }
    setData(prev => ({ ...prev, workouts: [...prev.workouts, workout] }))
    setActiveWorkoutId(workout.id)
    setShowNewWorkout(false)
  }

  const repeatWorkout = (source) => {
    const workout = {
      id: uid('w'),
      splitId: source.splitId,
      label: source.label,
      createdAt: new Date().toISOString(),
      exercises: source.exercises.map(ex => {
        const lastWeight = ex.sets.filter(hasValues).slice(-1)[0]?.weight || ''
        return { id: uid('e'), name: ex.name, sets: ex.sets.map(() => newSet(lastWeight)) }
      }),
    }
    setData(prev => ({ ...prev, workouts: [...prev.workouts, workout] }))
    setActiveWorkoutId(workout.id)
  }

  const deleteWorkout = (workoutId) => {
    if (!window.confirm('Delete this workout and all sets logged in it?')) return
    setData(prev => ({
      ...prev,
      workouts: prev.workouts.filter(w => w.id !== workoutId),
      history: prev.history.filter(h => h.workoutId !== workoutId),
    }))
    setActiveWorkoutId(null)
  }

  const addExerciseToActive = (name) => {
    const trimmed = name.trim()
    if (!trimmed || !activeWorkout) return
    updateWorkout(activeWorkout.id, w => ({ ...w, exercises: [...w.exercises, newExercise(trimmed, lastWeightFor(data.history, trimmed))] }))
    setJustAdded(trimmed)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setJustAdded(null), 900)
  }

  const deleteExercise = (exerciseId) => {
    const exercise = activeWorkout.exercises.find(e => e.id === exerciseId)
    const logged = exercise?.sets.some(s => s.completed && hasValues(s))
    if (logged && !window.confirm(`Remove ${exercise.name} and its logged sets from this session?`)) return
    updateWorkout(activeWorkout.id, w => ({ ...w, exercises: w.exercises.filter(e => e.id !== exerciseId) }))
    setData(prev => ({
      ...prev,
      history: prev.history.filter(h => !h.setKey?.startsWith(`${activeWorkout.id}:${exerciseId}:`)),
    }))
  }

  const updateExercise = (exerciseId, fn) => {
    updateWorkout(activeWorkout.id, w => ({
      ...w,
      exercises: w.exercises.map(e => (e.id === exerciseId ? fn(e) : e)),
    }))
  }

  const addSet = (exerciseId) => {
    updateExercise(exerciseId, ex => {
      const last = ex.sets[ex.sets.length - 1]
      return { ...ex, sets: [...ex.sets, newSet(last?.weight || '')] }
    })
  }

  const deleteSet = (exerciseId, setId) => {
    const exercise = activeWorkout.exercises.find(e => e.id === exerciseId)
    if (!exercise || exercise.sets.length <= 1) return
    updateExercise(exerciseId, ex => ({ ...ex, sets: ex.sets.filter(s => s.id !== setId) }))
    setData(prev => ({ ...prev, history: prev.history.filter(h => h.setKey !== `${activeWorkout.id}:${exerciseId}:${setId}`) }))
  }

  // A set belongs to its session's day, so editing a typo later never moves it to "today".
  const syncHistory = (prev, workout, exercise, set) => {
    const setKey = `${workout.id}:${exercise.id}:${set.id}`
    const others = prev.history.filter(h => h.setKey !== setKey)
    if (!set.completed || !hasValues(set)) return others
    const existing = prev.history.find(h => h.setKey === setKey)
    return [...others, {
      id: existing?.id || uid('h'),
      date: existing?.date || workout.createdAt,
      exercise: exercise.name,
      weight: set.weight,
      reps: set.reps,
      splitId: workout.splitId,
      workoutId: workout.id,
      setKey,
    }]
  }

  const updateSetField = (exerciseId, setId, field, value) => {
    setData(prev => {
      const workout = prev.workouts.find(w => w.id === activeWorkoutId)
      const exercise = workout?.exercises.find(e => e.id === exerciseId)
      const set = exercise?.sets.find(s => s.id === setId)
      if (!set) return prev
      const updated = { ...set, [field]: value }
      const workouts = prev.workouts.map(w => w.id !== workout.id ? w : {
        ...w,
        exercises: w.exercises.map(e => e.id !== exerciseId ? e : {
          ...e,
          sets: e.sets.map(s => (s.id === setId ? updated : s)),
        }),
      })
      const history = set.completed ? syncHistory(prev, workout, exercise, updated) : prev.history
      return { ...prev, workouts, history }
    })
  }

  const toggleSetComplete = (exerciseId, setId) => {
    // Decide about the rest timer from the current snapshot; the updater below may run lazily.
    const currentSet = activeWorkout?.exercises.find(e => e.id === exerciseId)?.sets.find(s => s.id === setId)
    if (!currentSet) return
    // A set with no weight/reps has nothing to log, so it cannot be marked complete.
    if (!currentSet.completed && !hasValues(currentSet)) return
    const startsRest = !currentSet.completed
    setData(prev => {
      const workout = prev.workouts.find(w => w.id === activeWorkoutId)
      const exercise = workout?.exercises.find(e => e.id === exerciseId)
      const set = exercise?.sets.find(s => s.id === setId)
      if (!set) return prev
      const updated = { ...set, completed: !set.completed }
      const workouts = prev.workouts.map(w => w.id !== workout.id ? w : {
        ...w,
        exercises: w.exercises.map(e => e.id !== exerciseId ? e : {
          ...e,
          sets: e.sets.map(s => (s.id === setId ? updated : s)),
        }),
      })
      return { ...prev, workouts, history: syncHistory(prev, workout, exercise, updated) }
    })
    if (startsRest) {
      setRestEndsAt(Date.now() + REST_SECONDS * 1000)
      setRestLeft(REST_SECONDS)
    }
  }

  const dismissRest = () => {
    setRestEndsAt(null)
    setRestLeft(0)
  }

  const importBackup = async (file) => {
    if (!file) return
    try {
      const incoming = parseImport(await file.text())
      const count = incoming.workouts.length
      if (!window.confirm(`Replace everything in this app with the backup (${count} workout${count === 1 ? '' : 's'}, ${incoming.history.length} logged sets)?`)) return
      setData(incoming)
      setActiveWorkoutId(null)
      setProgressExercise(null)
      setPrExercise(null)
      setStorageNotice(null)
    } catch (err) {
      window.alert(`Could not import: ${err.message}`)
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  // ---------- derived ----------

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    const splitId = catalogFilter === 'current' ? activeWorkout?.splitId : catalogFilter
    return CATALOG.filter(item => {
      if (splitId && splitId !== 'all' && !item.splitIds.includes(splitId)) return false
      return !q || item.name.toLowerCase().includes(q)
    })
  }, [search, catalogFilter, activeWorkout])

  // Only hide the custom-add button when the exact match is actually visible in the current list.
  const exactCatalogMatch = filteredCatalog.some(c => c.name.toLowerCase() === search.trim().toLowerCase())

  const openAddExercise = () => {
    setSearch('')
    setCatalogFilter(activeWorkout && activeWorkout.splitId !== 'legacy' ? 'current' : 'all')
    setShowAddExercise(true)
  }

  // Switching tabs keeps the open session so you can peek at Progress mid-workout;
  // tapping the current tab again returns to its list.
  const goToTab = (next) => {
    if (next === tab) {
      setActiveWorkoutId(null)
      setProgressExercise(null)
      setPrExercise(null)
    }
    setTab(next)
  }

  // Exercise suggestions for the PR form: catalog plus anything custom already tracked or recorded.
  const prExerciseOptions = useMemo(() => {
    const names = new Set(CATALOG.map(c => c.name))
    for (const h of data.history) names.add(h.exercise)
    for (const p of data.prs) names.add(p.exercise)
    const q = prSearch.trim().toLowerCase()
    const recorded = new Set(data.prs.map(p => p.exercise))
    return Array.from(names)
      .filter(n => !q || n.toLowerCase().includes(q))
      .sort((a, b) => (recorded.has(b) - recorded.has(a)) || a.localeCompare(b))
  }, [data.history, data.prs, prSearch])

  // ---------- views ----------

  const renderWorkoutList = () => (
    <>
      <header className="header">
        <h1>Workouts</h1>
        <p className="header-subtitle">{data.workouts.length} session{data.workouts.length === 1 ? '' : 's'} logged</p>
      </header>
      <div className="content">
        {sortedWorkouts.length === 0 ? (
          <div className="empty-state">
            <DumbbellIcon className="icon-large" />
            <h3 className="empty-state-title">No workouts yet</h3>
            <p className="empty-state-text">Start a session from one of your splits</p>
            <button className="btn btn-primary" onClick={() => setShowNewWorkout(true)}>Start Workout</button>
          </div>
        ) : (
          <>
            <p className="section-title">Sessions</p>
            {sortedWorkouts.map(w => {
              const split = getSplit(w.splitId)
              const total = w.exercises.reduce((n, e) => n + e.sets.length, 0)
              const done = w.exercises.reduce((n, e) => n + e.sets.filter(s => s.completed).length, 0)
              const pct = total ? Math.round((done / total) * 100) : 0
              return (
                <div key={w.id} className="card card-clickable" onClick={() => setActiveWorkoutId(w.id)}>
                  <div className="workout-row">
                    <div className="split-badge" style={{ backgroundColor: split.color }}>{split.short}</div>
                    <div className="workout-info">
                      <div className="workout-title">{w.label || split.name}</div>
                      <div className="workout-meta">{formatWorkoutDate(w.createdAt)} · {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'} · {done}/{total} sets</div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: split.color }} /></div>
                    </div>
                    <ChevronRightIcon className="chevron" />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
      {sortedWorkouts.length > 0 && (
        <button className={`fab ${restLeft > 0 ? 'raised' : ''}`} onClick={() => setShowNewWorkout(true)} aria-label="Start workout"><PlusIcon className="fab-icon" /></button>
      )}
    </>
  )

  const renderWorkoutDetail = () => {
    const w = activeWorkout
    const split = getSplit(w.splitId)
    const total = w.exercises.reduce((n, e) => n + e.sets.length, 0)
    const done = w.exercises.reduce((n, e) => n + e.sets.filter(s => s.completed).length, 0)
    return (
      <>
        <header className="header">
          <button className="header-back" onClick={() => setActiveWorkoutId(null)}><ChevronLeftIcon className="icon-small" /> Workouts</button>
          <div className="header-row">
            <div className="split-badge" style={{ backgroundColor: split.color }}>{split.short}</div>
            <div>
              <h1>{w.label || split.name}</h1>
              <p className="header-subtitle">{split.subtitle ? `${split.subtitle} · ` : ''}{formatWorkoutDate(w.createdAt)}</p>
            </div>
          </div>
        </header>
        <div className="content">
          {total > 0 && (
            <div className="workout-summary" style={{ borderLeftColor: split.color }}>
              <div className="workout-summary-title">Session progress</div>
              <div className="workout-summary-value">{done} / {total} sets</div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: split.color }} /></div>
            </div>
          )}

          {w.exercises.length === 0 ? (
            <div className="empty-state">
              <ClipboardIcon className="icon-large" />
              <h3 className="empty-state-title">No exercises yet</h3>
              <p className="empty-state-text">Add exercises from your {split.name} list</p>
              <button className="btn btn-primary" onClick={openAddExercise}>Add Exercise</button>
            </div>
          ) : (
            w.exercises.map(ex => {
              const last = lastByExercise.get(ex.name) || null
              return (
                <div key={ex.id} className="exercise-card">
                  <div className="exercise-header">
                    <div>
                      <div className="exercise-name">{ex.name}</div>
                      {last && <div className="exercise-last">Last: {last.bestSet.weight} lbs × {last.bestSet.reps} · {formatShortDate(last.date)}</div>}
                    </div>
                    <button className="icon-btn danger" onClick={() => deleteExercise(ex.id)} aria-label="Remove exercise"><TrashIcon className="icon-small" /></button>
                  </div>
                  <div className="sets-container">
                    {ex.sets.map((set, idx) => (
                      <div key={set.id} className={`set-row ${set.completed ? 'done' : ''}`}>
                        <div className="set-number">{idx + 1}</div>
                        <div className="set-inputs">
                          <label className="input-group">
                            <span className="input-label">lbs</span>
                            <input type="text" className="input-field" value={set.weight} placeholder="0" inputMode="decimal" autoComplete="off"
                              onChange={e => updateSetField(ex.id, set.id, 'weight', sanitizeNumber(e.target.value, true))} />
                          </label>
                          <label className="input-group">
                            <span className="input-label">reps</span>
                            <input type="text" className="input-field" value={set.reps} placeholder="0" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                              onChange={e => updateSetField(ex.id, set.id, 'reps', sanitizeNumber(e.target.value, false))} />
                          </label>
                        </div>
                        <button className={`set-complete ${set.completed ? 'completed' : ''}`} onClick={() => toggleSetComplete(ex.id, set.id)}
                          disabled={!set.completed && !hasValues(set)} aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                          title={!set.completed && !hasValues(set) ? 'Enter weight and reps first' : undefined}>
                          <CheckIcon className="icon-small" />
                        </button>
                        <button className="icon-btn subtle" onClick={() => deleteSet(ex.id, set.id)} disabled={ex.sets.length === 1} aria-label="Remove set">
                          <CloseIcon className="icon-small" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="btn add-set-btn" onClick={() => addSet(ex.id)}>+ Add Set</button>
                </div>
              )
            })
          )}

          {w.exercises.length > 0 && (
            <button className="btn btn-secondary" onClick={openAddExercise}>+ Add Exercise</button>
          )}
          <div className="detail-actions">
            <button className="btn btn-ghost" onClick={() => repeatWorkout(w)}>Repeat this workout</button>
            <button className="btn btn-ghost danger" onClick={() => deleteWorkout(w.id)}>Delete workout</button>
          </div>
        </div>
      </>
    )
  }

  const renderHistory = () => {
    const grouped = new Map()
    for (const h of [...data.history].sort((a, b) => b.date.localeCompare(a.date))) {
      const key = dayKey(h.date)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(h)
    }
    return (
      <>
        <header className="header">
          <h1>History</h1>
          <p className="header-subtitle">Every completed set</p>
        </header>
        <div className="content">
          {grouped.size === 0 ? (
            <div className="empty-state">
              <ClipboardIcon className="icon-large" />
              <h3 className="empty-state-title">No history yet</h3>
              <p className="empty-state-text">Complete sets during a workout to build your log</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([key, items]) => (
              <div key={key}>
                <div className="history-date">{formatShortDate(key)}</div>
                <div className="card">
                  {items.map(h => {
                    const split = getSplit(h.splitId)
                    return (
                      <div key={h.id} className="history-item">
                        <span className="history-dot" style={{ backgroundColor: split.color }} />
                        <div className="history-exercise">{h.exercise}</div>
                        <div className="history-details">{h.weight} × {h.reps}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </>
    )
  }

  const renderProgressList = () => {
    const stats = overallStats(data.history)
    const exercises = Array.from(seriesByExercise.keys())
    const weekIdx = weekSel ?? weeklyPoints.length - 1
    const week = weeklyPoints[weekIdx]
    const prevWeek = weeklyPoints[weekIdx - 1]
    const weekDelta = prevWeek && prevWeek.v > 0 ? Math.round(((week.v - prevWeek.v) / prevWeek.v) * 100) : null
    const hasWeekly = weeklyPoints.some(p => p.v > 0)
    return (
      <>
        <header className="header">
          <h1>Progress</h1>
          <p className="header-subtitle">
            {stats.trainingDays} training day{stats.trainingDays === 1 ? '' : 's'} · {stats.setsLogged} sets · {Math.round(stats.totalVolume).toLocaleString()} lbs lifted
          </p>
        </header>
        <div className="content">
          {exercises.length === 0 ? (
            <div className="empty-state">
              <TrendingIcon className="icon-large" />
              <h3 className="empty-state-title">Nothing to chart yet</h3>
              <p className="empty-state-text">Complete sets with weight and reps to see your progress</p>
            </div>
          ) : (
            <>
              <div className="card chart-card">
                <div className="chart-head">
                  <div>
                    <div className="chart-title">Weekly volume</div>
                    <div className="chart-sub">Week of {formatShortDate(dayKey(new Date(week.t).toISOString()))}{week.sets ? ` · ${week.sets} sets` : ''}</div>
                  </div>
                  <div className="chart-head-right">
                    <div className="chart-value">{week.v.toLocaleString()}<span> lbs</span></div>
                    {weekDelta != null && <TrendPill pct={weekDelta} sessions={2} />}
                  </div>
                </div>
                <LineChart
                  points={weeklyPoints}
                  color="#3b82f6"
                  height={150}
                  selected={weekIdx}
                  onSelect={setWeekSel}
                  showTrend={false}
                  smooth={false}
                  unit="lbs"
                  emptyLabel="No volume yet"
                />
                {!hasWeekly && <p className="chart-hint">Your last 12 weeks will fill in as you train.</p>}
              </div>

              <p className="section-title">Exercises</p>
              {exercises.map(name => {
                const series = seriesByExercise.get(name)
                const summary = summarizeSeries(series)
                const color = splitColorFor(name)
                return (
                  <div key={name} className="card card-clickable progress-row" onClick={() => openProgress(name)}>
                    <div className="progress-row-main">
                      <div className="exercise-name">{name}</div>
                      <div className="workout-meta">{summary.sessions} session{summary.sessions === 1 ? '' : 's'} · est. 1RM {summary.lastSession.e1rm} lbs</div>
                    </div>
                    <Sparkline points={toChartPoints(series, 'e1rm')} color={color} />
                    <TrendPill pct={summary.changePct} sessions={summary.sessions} />
                  </div>
                )
              })}
            </>
          )}

          <div className="backup-row">
            <button className="btn btn-ghost" onClick={() => exportData(data)}><DownloadIcon className="icon-small" /> Export backup</button>
            <button className="btn btn-ghost" onClick={() => importInput.current?.click()}>Import backup</button>
            <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={e => importBackup(e.target.files?.[0])} />
          </div>
        </div>
      </>
    )
  }

  const renderProgressDetail = () => {
    const name = progressExercise
    const fullSeries = seriesByExercise.get(name) || []
    if (fullSeries.length === 0) {
      return (
        <>
          <header className="header">
            <button className="header-back" onClick={() => setProgressExercise(null)}><ChevronLeftIcon className="icon-small" /> Progress</button>
            <h1>{name}</h1>
          </header>
          <div className="content"><p className="empty-inline">No logged sets for this exercise yet.</p></div>
        </>
      )
    }
    const color = splitColorFor(name)
    const metric = METRICS.find(m => m.id === metricId) || METRICS[0]
    const series = filterRange(fullSeries, rangeId)
    const points = toChartPoints(series, metric.id)
    const summary = summarizeSeries(fullSeries)
    const rangeSummary = series.length ? summarizeSeries(series) : null
    const prIndex = rangeSummary ? rangeSummary.prIndex : -1
    const selIdx = chartSel != null && chartSel < points.length ? chartSel : points.length - 1
    const selPoint = points[selIdx]
    const first = points[0]
    const changePct = first && first.v > 0 && selPoint ? Math.round(((selPoint.v - first.v) / first.v) * 100) : 0
    const trend = linearTrend(points)
    const recordedPR = prSummaries.find(p => p.exercise === name)

    return (
      <>
        <header className="header">
          <button className="header-back" onClick={() => setProgressExercise(null)}><ChevronLeftIcon className="icon-small" /> Progress</button>
          <h1>{name}</h1>
          <p className="header-subtitle">{summary.sessions} session{summary.sessions === 1 ? '' : 's'} · first logged {formatShortDate(fullSeries[0].date)}</p>
        </header>
        <div className="content">
          <div className="segmented" role="tablist" aria-label="Metric">
            {METRICS.map(m => (
              <button key={m.id} role="tab" aria-selected={metricId === m.id} className={`segment ${metricId === m.id ? 'active' : ''}`}
                onClick={() => { setMetricId(m.id); setChartSel(null) }}>{m.label}</button>
            ))}
          </div>

          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <div className="chart-value big" style={{ color }}>
                  {selPoint ? selPoint.v.toLocaleString() : '—'}<span> {metric.unit}</span>
                </div>
                <div className="chart-sub">{selPoint ? formatFullDate(selPoint.t) : 'No sessions in this range'}</div>
              </div>
              {points.length > 1 && (
                <div className="chart-head-right">
                  <TrendPill pct={changePct} sessions={points.length} />
                  <div className="chart-sub">since {rangeId === 'all' ? 'first session' : 'start of range'}</div>
                </div>
              )}
            </div>

            <LineChart
              points={points}
              color={color}
              height={230}
              selected={selIdx}
              onSelect={setChartSel}
              prIndex={metric.id === 'e1rm' ? prIndex : -1}
              unit={metric.unit}
            />

            <div className="segmented small" role="tablist" aria-label="Time range">
              {RANGES.map(r => (
                <button key={r.id} role="tab" aria-selected={rangeId === r.id} className={`segment ${rangeId === r.id ? 'active' : ''}`}
                  onClick={() => { setRangeId(r.id); setChartSel(null) }}>{r.label}</button>
              ))}
            </div>

            {selPoint && (
              <div className="chart-detail">
                <div className="chart-detail-item"><span>Best set</span><strong>{selPoint.source.bestSet.weight} × {selPoint.source.bestSet.reps}</strong></div>
                <div className="chart-detail-item"><span>Sets</span><strong>{selPoint.source.sets}</strong></div>
                <div className="chart-detail-item"><span>Volume</span><strong>{Math.round(selPoint.source.volume).toLocaleString()}</strong></div>
                <div className="chart-detail-item"><span>Est. 1RM</span><strong>{selPoint.source.e1rm}</strong></div>
              </div>
            )}

            {points.length === 1 && <p className="chart-hint">Log this exercise again to draw a line.</p>}
            {points.length === 2 && <p className="chart-hint">Drag on the chart to compare sessions. A trend line appears after three.</p>}
            {trend && points.length >= 3 && (
              <p className="trend-note">
                <strong className={trend.perWeek > 0 ? 'up' : trend.perWeek < 0 ? 'down' : ''}>{formatSigned(trend.perWeek, 1)} {metric.unit} / week</strong>
                {' '}across {points.length} sessions. Drag on the chart to inspect any session.
              </p>
            )}
          </div>

          <div className="pr-banner">
            <TrophyIcon className="icon-small" />
            <div>
              <div className="pr-title">Best session</div>
              <div className="pr-detail">{fullSeries[summary.prIndex].bestSet.weight} lbs × {fullSeries[summary.prIndex].bestSet.reps} · est. {summary.bestE1rm} lbs · {formatShortDate(summary.prDate)}</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{summary.bestWeight}</div><div className="stat-label">Heaviest set (lbs)</div></div>
            <div className="stat-card card-clickable" onClick={() => { setTab('prs'); openPR(recordedPR ? name : null); if (!recordedPR) openRecordPR(name) }}>
              <div className="stat-value" style={{ color: recordedPR ? 'var(--warning)' : undefined }}>{recordedPR ? recordedPR.best.w : '—'}</div>
              <div className="stat-label">{recordedPR ? 'Recorded 1RM (lbs)' : 'Record a 1RM'}</div>
            </div>
          </div>

          <p className="section-title">Session log</p>
          <div className="card">
            {[...fullSeries].reverse().slice(0, 8).map(p => (
              <div key={p.date} className="history-item">
                <div className="history-exercise">{formatShortDate(p.date)}</div>
                <div className="history-details">{p.sets} set{p.sets === 1 ? '' : 's'} · {p.bestSet.weight} × {p.bestSet.reps} · {Math.round(p.volume).toLocaleString()} vol</div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const renderPRList = () => {
    const total = data.prs.length
    return (
      <>
        <header className="header">
          <h1>1-Rep PRs</h1>
          <p className="header-subtitle">
            {prSummaries.length === 0 ? 'Record your heaviest single lifts' : `${prSummaries.length} exercise${prSummaries.length === 1 ? '' : 's'} · ${total} lift${total === 1 ? '' : 's'} recorded`}
          </p>
        </header>
        <div className="content">
          {prSummaries.length === 0 ? (
            <div className="empty-state">
              <TrophyIcon className="icon-large" />
              <h3 className="empty-state-title">No PRs recorded</h3>
              <p className="empty-state-text">Log a true one-rep max and watch it climb over time</p>
              <button className="btn btn-primary" onClick={() => openRecordPR()}>Record a PR</button>
            </div>
          ) : (
            <>
              <p className="section-title">Current bests</p>
              {prSummaries.map(s => {
                const color = splitColorFor(s.exercise)
                const points = prPoints(prSeriesFor(data.prs, s.exercise))
                const gain = s.previousBest ? s.best.w - s.previousBest.w : null
                return (
                  <div key={s.exercise} className="card card-clickable pr-row" onClick={() => openPR(s.exercise)}>
                    <div className="pr-row-main">
                      <div className="exercise-name">{s.exercise}</div>
                      <div className="workout-meta">{formatShortDate(dayKey(s.best.date))} · {s.attempts} attempt{s.attempts === 1 ? '' : 's'}</div>
                    </div>
                    <Sparkline points={points} color={color} width={72} />
                    <div className="pr-row-value">
                      <div className="pr-weight" style={{ color }}>{s.best.w}<span> lbs</span></div>
                      {gain != null && <div className={`pr-gain ${gain > 0 ? 'up' : ''}`}>{formatSigned(gain, 1)} lbs</div>}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
        {prSummaries.length > 0 && (
          <button className={`fab ${restLeft > 0 ? 'raised' : ''}`} onClick={() => openRecordPR()} aria-label="Record PR"><PlusIcon className="fab-icon" /></button>
        )}
      </>
    )
  }

  const renderPRDetail = () => {
    const name = prExercise
    const series = prSeriesFor(data.prs, name)
    if (series.length === 0) {
      return (
        <>
          <header className="header">
            <button className="header-back" onClick={() => setPrExercise(null)}><ChevronLeftIcon className="icon-small" /> PRs</button>
            <h1>{name}</h1>
          </header>
          <div className="content">
            <p className="empty-inline">No PRs recorded for this exercise yet.</p>
            <button className="btn btn-primary" onClick={() => openRecordPR(name)}>Record a PR</button>
          </div>
        </>
      )
    }
    const color = splitColorFor(name)
    const points = prPoints(series)
    const summary = prSummaries.find(s => s.exercise === name)
    const bestIndex = series.findIndex(p => p.id === summary.best.id)
    const selIdx = prSel != null && prSel < points.length ? prSel : points.length - 1
    const sel = series[selIdx]
    const gainSinceFirst = series.length > 1 ? summary.best.w - series[0].w : null
    const trend = linearTrend(points)
    const trainingSeries = seriesByExercise.get(name)
    const trainingE1rm = trainingSeries ? summarizeSeries(trainingSeries).bestE1rm : null
    const isBestSelected = sel.id === summary.best.id

    return (
      <>
        <header className="header">
          <button className="header-back" onClick={() => setPrExercise(null)}><ChevronLeftIcon className="icon-small" /> PRs</button>
          <h1>{name}</h1>
          <p className="header-subtitle">{series.length} attempt{series.length === 1 ? '' : 's'} · first recorded {formatShortDate(dayKey(series[0].date))}</p>
        </header>
        <div className="content">
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <div className="chart-value big" style={{ color }}>{sel.w}<span> lbs</span></div>
                <div className="chart-sub">{formatFullDate(new Date(sel.date).getTime())}{isBestSelected ? ' · current best' : ''}</div>
              </div>
              {gainSinceFirst != null && (
                <div className="chart-head-right">
                  <span className={`trend-pill ${gainSinceFirst > 0 ? 'up' : gainSinceFirst < 0 ? 'down' : 'neutral'}`}>
                    {gainSinceFirst > 0 && <ArrowUpIcon className="icon-xs" />}{formatSigned(gainSinceFirst, 1)} lbs
                  </span>
                  <div className="chart-sub">since first PR</div>
                </div>
              )}
            </div>

            <LineChart
              points={points}
              color={color}
              height={220}
              selected={selIdx}
              onSelect={setPrSel}
              prIndex={bestIndex}
              unit="lbs"
            />

            {sel.note && <p className="chart-hint note">“{sel.note}”</p>}
            {points.length === 1 && <p className="chart-hint">Record another attempt to see the line climb.</p>}
            {trend && points.length >= 3 && (
              <p className="trend-note">
                <strong className={trend.perWeek > 0 ? 'up' : trend.perWeek < 0 ? 'down' : ''}>{formatSigned(trend.perWeek, 1)} lbs / week</strong>
                {' '}across {points.length} attempts. Drag on the chart to inspect any attempt.
              </p>
            )}
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value" style={{ color: 'var(--warning)' }}>{summary.best.w}</div><div className="stat-label">Best 1RM (lbs)</div></div>
            <div className="stat-card">
              <div className="stat-value">{trainingE1rm ?? '—'}</div>
              <div className="stat-label">{trainingE1rm ? 'Training est. 1RM' : 'No training data'}</div>
            </div>
          </div>
          {trainingE1rm && (
            <p className="compare-note">
              {summary.best.w >= trainingE1rm
                ? `Your recorded max beats the estimate from your working sets by ${formatSigned(summary.best.w - trainingE1rm, 1)} lbs.`
                : `Your working sets estimate about ${trainingE1rm} lbs, ${(trainingE1rm - summary.best.w).toFixed(0)} lbs above your recorded max. A new PR may be waiting.`}
            </p>
          )}

          <button className="btn btn-primary" onClick={() => openRecordPR(name)}><PlusIcon className="icon-small" /> Record new attempt</button>

          <p className="section-title" style={{ marginTop: 20 }}>Attempts</p>
          <div className="card">
            {[...series].reverse().map(p => (
              <div key={p.id} className={`history-item pr-attempt ${p.id === summary.best.id ? 'best' : ''}`}>
                <div className="history-exercise">
                  <span className="pr-attempt-date">
                    {formatShortDate(dayKey(p.date))}
                    {p.id === summary.best.id && <span className="best-tag">Best</span>}
                  </span>
                  {p.note && <div className="pr-note">{p.note}</div>}
                </div>
                <div className="history-details">{p.w} lbs</div>
                <button className="icon-btn subtle" onClick={() => deletePR(p.id)} aria-label="Delete PR"><TrashIcon className="icon-small" /></button>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const renderContent = () => {
    if (tab === 'history') return renderHistory()
    if (tab === 'progress') return progressExercise ? renderProgressDetail() : renderProgressList()
    if (tab === 'prs') return prExercise ? renderPRDetail() : renderPRList()
    return activeWorkout ? renderWorkoutDetail() : renderWorkoutList()
  }

  return (
    <div className={`app ${restLeft > 0 ? 'with-timer' : ''}`}>
      {storageNotice && (
        <div className="notice" role="alert">
          <span>{storageNotice}</span>
          <button className="icon-btn subtle" onClick={() => setStorageNotice(null)} aria-label="Dismiss"><CloseIcon className="icon-small" /></button>
        </div>
      )}
      {renderContent()}

      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'workouts' ? 'active' : ''}`} onClick={() => goToTab('workouts')}>
          <DumbbellIcon className="nav-icon" /><span className="nav-item-label">Workouts</span>
        </button>
        <button className={`nav-item ${tab === 'history' ? 'active' : ''}`} onClick={() => goToTab('history')}>
          <ClipboardIcon className="nav-icon" /><span className="nav-item-label">History</span>
        </button>
        <button className={`nav-item ${tab === 'progress' ? 'active' : ''}`} onClick={() => goToTab('progress')}>
          <TrendingIcon className="nav-icon" /><span className="nav-item-label">Progress</span>
        </button>
        <button className={`nav-item ${tab === 'prs' ? 'active' : ''}`} onClick={() => goToTab('prs')}>
          <TrophyIcon className="nav-icon" /><span className="nav-item-label">PRs</span>
        </button>
      </nav>

      {restLeft > 0 && (
        <div className="rest-timer">
          <div className="rest-timer-info">
            <ClockIcon className="rest-timer-icon" />
            <div><div className="rest-timer-text">Rest</div><div className="rest-timer-time">{formatClock(restLeft)}</div></div>
          </div>
          <button className="icon-btn subtle" onClick={dismissRest} aria-label="Dismiss timer"><CloseIcon className="icon-small" /></button>
        </div>
      )}

      {showNewWorkout && (
        <Modal title="Start Workout" onClose={() => setShowNewWorkout(false)}>
          <div className="modal-body">
            <p className="section-title">Choose a split</p>
            <div className="split-grid">
              {SPLITS.map(s => (
                <button key={s.id} className={`split-option ${newSplitId === s.id ? 'selected' : ''}`} onClick={() => setNewSplitId(s.id)}>
                  <span className="split-badge" style={{ backgroundColor: s.color }}>{s.short}</span>
                  <span className="split-option-text">
                    <span className="split-option-name">{s.name}</span>
                    <span className="split-option-sub">{s.subtitle || `${s.exercises.length} exercises`}</span>
                  </span>
                </button>
              ))}
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={prefill} onChange={e => setPrefill(e.target.checked)} />
              <span>Pre-fill exercises from this split</span>
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowNewWorkout(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => createWorkout(newSplitId, prefill)}>Start</button>
          </div>
        </Modal>
      )}

      {showAddExercise && activeWorkout && (
        <Modal title="Add Exercise" onClose={() => setShowAddExercise(false)}>
          <div className="modal-body">
            <input type="text" className="form-input" placeholder="Search or type a custom exercise" value={search}
              onChange={e => setSearch(e.target.value)} autoComplete="off" />
            {search.trim() && !exactCatalogMatch && (
              <button className="btn btn-secondary custom-add" onClick={() => { addExerciseToActive(search); setSearch('') }}>
                <PlusIcon className="icon-small" /> Add “{search.trim()}”
              </button>
            )}
            <div className="chip-row">
              {activeWorkout.splitId !== 'legacy' && (
                <button className={`chip ${catalogFilter === 'current' ? 'active' : ''}`} onClick={() => setCatalogFilter('current')}>This split</button>
              )}
              <button className={`chip ${catalogFilter === 'all' ? 'active' : ''}`} onClick={() => setCatalogFilter('all')}>All</button>
              {SPLITS.map(s => (
                <button key={s.id} className={`chip ${catalogFilter === s.id ? 'active' : ''}`} onClick={() => setCatalogFilter(s.id)}>{s.name}</button>
              ))}
            </div>
            <div className="catalog-list">
              {filteredCatalog.length === 0 && <p className="empty-inline">No matches. Use the button above to add it as a custom exercise.</p>}
              {filteredCatalog.map(item => {
                const count = activeWorkout.exercises.filter(e => e.name === item.name).length
                const flash = justAdded === item.name
                return (
                  <button key={item.name} className={`catalog-item ${flash ? 'flash' : ''}`} onClick={() => addExerciseToActive(item.name)}>
                    <span className="catalog-item-name">{item.name}</span>
                    <span className="catalog-item-right">
                      {count > 0 && <span className="count-pill">×{count}</span>}
                      <span className="split-dots">{item.splitIds.map(id => <i key={id} style={{ backgroundColor: getSplit(id).color }} />)}</span>
                      {flash ? <CheckIcon className="icon-small success" /> : <PlusIcon className="icon-small" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setShowAddExercise(false)}>Done</button>
          </div>
        </Modal>
      )}

      {showRecordPR && (
        <Modal title="Record 1-Rep PR" onClose={() => setShowRecordPR(false)}>
          <div className="modal-body">
            {prForm.exercise ? (
              <div className="pr-form-exercise">
                <div>
                  <div className="input-label">Exercise</div>
                  <div className="pr-form-exercise-name">{prForm.exercise}</div>
                </div>
                <button className="btn btn-ghost pr-change" onClick={() => setPrForm(f => ({ ...f, exercise: '' }))}>Change</button>
              </div>
            ) : (
              <>
                <input type="text" className="form-input" placeholder="Search or type an exercise" value={prSearch}
                  onChange={e => setPrSearch(e.target.value)} autoComplete="off" autoFocus />
                {prSearch.trim() && !prExerciseOptions.some(n => n.toLowerCase() === prSearch.trim().toLowerCase()) && (
                  <button className="btn btn-secondary custom-add" onClick={() => setPrForm(f => ({ ...f, exercise: prSearch.trim() }))}>
                    <PlusIcon className="icon-small" /> Use “{prSearch.trim()}”
                  </button>
                )}
                <div className="catalog-list pr-picker">
                  {prExerciseOptions.map(name => {
                    const existing = prSummaries.find(s => s.exercise === name)
                    return (
                      <button key={name} className="catalog-item" onClick={() => setPrForm(f => ({ ...f, exercise: name }))}>
                        <span className="catalog-item-name">{name}</span>
                        <span className="catalog-item-right">
                          {existing && <span className="count-pill">{existing.best.w} lbs</span>}
                          <ChevronRightIcon className="icon-small" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {prForm.exercise && (
              <div className="pr-form-fields">
                <label className="input-group">
                  <span className="input-label">Weight (lbs)</span>
                  <input type="text" className="form-input pr-weight-input" value={prForm.weight} placeholder="0" inputMode="decimal" autoComplete="off" autoFocus
                    onChange={e => setPrForm(f => ({ ...f, weight: sanitizeNumber(e.target.value, true) }))} />
                </label>
                <label className="input-group">
                  <span className="input-label">Date</span>
                  <input type="date" className="form-input" value={prForm.date} max={todayInputValue()}
                    onChange={e => setPrForm(f => ({ ...f, date: e.target.value || todayInputValue() }))} />
                </label>
                <label className="input-group">
                  <span className="input-label">Note (optional)</span>
                  <input type="text" className="form-input" value={prForm.note} placeholder="Belt, paused, felt easy…" maxLength={80}
                    onChange={e => setPrForm(f => ({ ...f, note: e.target.value }))} />
                </label>
                {(() => {
                  const current = prSummaries.find(s => s.exercise === prForm.exercise)
                  const w = parseFloat(prForm.weight) || 0
                  if (!current || w <= 0) return null
                  const diff = w - current.best.w
                  return (
                    <p className={`pr-compare ${diff > 0 ? 'up' : ''}`}>
                      {diff > 0 ? `New PR: ${formatSigned(diff, 1)} lbs over your ${current.best.w} lbs best.` : `Current best is ${current.best.w} lbs. This attempt will still be saved.`}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowRecordPR(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePR} disabled={!prForm.exercise || (parseFloat(prForm.weight) || 0) <= 0}>Save PR</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="swipe-hint" />
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn subtle" onClick={onClose} aria-label="Close"><CloseIcon className="icon-small" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TrendPill({ pct, sessions, large }) {
  if (sessions < 2) return <span className={`trend-pill neutral ${large ? 'large' : ''}`}>New</span>
  const up = pct > 0
  const flat = pct === 0
  return (
    <span className={`trend-pill ${flat ? 'neutral' : up ? 'up' : 'down'} ${large ? 'large' : ''}`}>
      {!flat && (up ? <ArrowUpIcon className="icon-xs" /> : <ArrowDownIcon className="icon-xs" />)}
      {Math.abs(pct)}%
    </span>
  )
}
