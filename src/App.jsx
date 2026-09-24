import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SPLITS, CATALOG, getSplit } from './data/splits'
import { loadData, saveData, exportData, parseImport, uid } from './utils/storage'
import {
  buildExerciseSeries, summarizeSeries, listTrackedExercises, lastPerformance,
  overallStats, formatShortDate, dayKey,
} from './utils/progress'
import ProgressChart, { Sparkline } from './components/ProgressChart'
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

  const modalOpen = showNewWorkout || showAddExercise
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
    if (startsRest) setRestEndsAt(Date.now() + REST_SECONDS * 1000)
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
    }
    setTab(next)
  }

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
    return (
      <>
        <header className="header">
          <h1>Progress</h1>
          <p className="header-subtitle">Estimated 1RM trend per exercise</p>
        </header>
        <div className="content">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{stats.trainingDays}</div><div className="stat-label">Training days</div></div>
            <div className="stat-card"><div className="stat-value">{stats.setsLogged}</div><div className="stat-label">Sets logged</div></div>
            <div className="stat-card"><div className="stat-value">{Math.round(stats.totalVolume).toLocaleString()}</div><div className="stat-label">Total volume (lbs)</div></div>
            <div className="stat-card"><div className="stat-value">{stats.exercises}</div><div className="stat-label">Exercises tracked</div></div>
          </div>

          {exercises.length === 0 ? (
            <div className="empty-state">
              <TrendingIcon className="icon-large" />
              <h3 className="empty-state-title">Nothing to chart yet</h3>
              <p className="empty-state-text">Complete sets with weight and reps to see your progress</p>
            </div>
          ) : (
            <>
              <p className="section-title">Exercises</p>
              {exercises.map(name => {
                const series = seriesByExercise.get(name)
                const summary = summarizeSeries(series)
                const split = getSplit(CATALOG.find(c => c.name === name)?.splitIds[0])
                return (
                  <div key={name} className="card card-clickable progress-row" onClick={() => setProgressExercise(name)}>
                    <div className="progress-row-main">
                      <div className="exercise-name">{name}</div>
                      <div className="workout-meta">{summary.sessions} session{summary.sessions === 1 ? '' : 's'} · best {summary.bestWeight} lbs</div>
                    </div>
                    <Sparkline series={series} color={split.color} />
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
    const series = seriesByExercise.get(name) || []
    if (series.length === 0) {
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
    const summary = summarizeSeries(series)
    const split = getSplit(CATALOG.find(c => c.name === name)?.splitIds[0])
    return (
      <>
        <header className="header">
          <button className="header-back" onClick={() => setProgressExercise(null)}><ChevronLeftIcon className="icon-small" /> Progress</button>
          <h1>{name}</h1>
          <p className="header-subtitle">{summary.sessions} session{summary.sessions === 1 ? '' : 's'} · first logged {formatShortDate(series[0].date)}</p>
        </header>
        <div className="content">
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-label">Est. 1RM</div>
              <div className="hero-stat-value" style={{ color: split.color }}>{summary.lastSession.e1rm}<span> lbs</span></div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Since first session</div>
              <TrendPill pct={summary.changePct} sessions={summary.sessions} large />
            </div>
          </div>

          <div className="card chart-card">
            <div className="chart-legend">
              <span><i className="legend-swatch" style={{ backgroundColor: split.color }} /> Est. 1RM</span>
              <span><i className="legend-swatch bar" /> Volume</span>
              <span><i className="legend-swatch ring" /> PR</span>
            </div>
            <ProgressChart key={name} series={series} color={split.color} prIndex={summary.prIndex} />
            {series.length === 1 && <p className="chart-hint">Log this exercise in another session to see a trend line.</p>}
          </div>

          <div className="pr-banner">
            <TrophyIcon className="icon-small" />
            <div>
              <div className="pr-title">Personal record</div>
              <div className="pr-detail">{series[summary.prIndex].bestSet.weight} lbs × {series[summary.prIndex].bestSet.reps} · est. {summary.bestE1rm} lbs · {formatShortDate(summary.prDate)}</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{summary.bestWeight}</div><div className="stat-label">Heaviest set (lbs)</div></div>
            <div className="stat-card"><div className="stat-value">{Math.round(summary.totalVolume).toLocaleString()}</div><div className="stat-label">Lifetime volume</div></div>
          </div>

          <p className="section-title">Session log</p>
          <div className="card">
            {[...series].reverse().slice(0, 8).map(p => (
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

  const renderContent = () => {
    if (tab === 'history') return renderHistory()
    if (tab === 'progress') return progressExercise ? renderProgressDetail() : renderProgressList()
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
      </nav>

      {restLeft > 0 && (
        <div className="rest-timer">
          <div className="rest-timer-info">
            <ClockIcon className="rest-timer-icon" />
            <div><div className="rest-timer-text">Rest</div><div className="rest-timer-time">{formatClock(restLeft)}</div></div>
          </div>
          <button className="icon-btn subtle" onClick={() => setRestEndsAt(null)} aria-label="Dismiss timer"><CloseIcon className="icon-small" /></button>
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
