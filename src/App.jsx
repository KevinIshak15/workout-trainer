import { useState, useEffect } from 'react'
import './App.css'

const DumbbellIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 6.5a2 2 0 0 1 3 0l8 8a2 2 0 0 1-3 3l-8-8a2 2 0 0 1 0-3z"/>
    <path d="m14 4 2 2"/><path d="m20 10-2-2"/><path d="m4 14 2-2"/><path d="m10 20-2-2"/>
  </svg>
)

const ClipboardIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
  </svg>
)

const ChartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const ClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

const TrashIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
)

const DAY_COLORS = {
  monday: '#3b82f6',
  tuesday: '#8b5cf6',
  wednesday: '#06b6d4',
  thursday: '#10b981',
  friday: '#f59e0b',
  saturday: '#ef4444',
  sunday: '#ec4899'
}

const EXERCISE_CATALOG = {
  Chest: ['Bench Press', 'Incline Bench Press', 'Dumbbell Flyes', 'Push-ups', 'Cable Crossover'],
  Back: ['Deadlift', 'Pull-ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row'],
  Legs: ['Squat', 'Leg Press', 'Lunges', 'Leg Curl', 'Leg Extension', 'Calf Raises'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pulls', 'Shrugs'],
  Arms: ['Bicep Curl', 'Tricep Pushdown', 'Hammer Curl', 'Skull Crushers', 'Preacher Curl'],
  Core: ['Plank', 'Crunches', 'Leg Raises', 'Russian Twists', 'Cable Woodchop']
}

const MUSCLE_GROUPS = Object.keys(EXERCISE_CATALOG)

const DAYS_OF_WEEK = [
  { id: 'monday', name: 'Monday', abbr: 'M' },
  { id: 'tuesday', name: 'Tuesday', abbr: 'T' },
  { id: 'wednesday', name: 'Wednesday', abbr: 'W' },
  { id: 'thursday', name: 'Thursday', abbr: 'T' },
  { id: 'friday', name: 'Friday', abbr: 'F' },
  { id: 'saturday', name: 'Saturday', abbr: 'S' },
  { id: 'sunday', name: 'Sunday', abbr: 'S' },
]

const VIEWS = { DAYS: 'days', DAY_DETAIL: 'day_detail', HISTORY: 'history', STATS: 'stats' }

function App() {
  const [view, setView] = useState(VIEWS.DAYS)
  const [selectedDay, setSelectedDay] = useState(null)
  const [workoutData, setWorkoutData] = useState(() => {
    const saved = localStorage.getItem('workoutData')
    return saved ? JSON.parse(saved) : { days: {}, history: [], exercises: {} }
  })
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [selectedDayForAdd, setSelectedDayForAdd] = useState('')
  const [restTimer, setRestTimer] = useState(null)
  const [restTimeLeft, setRestTimeLeft] = useState(0)
  const [navTab, setNavTab] = useState('workout')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('All')

  useEffect(() => {
    localStorage.setItem('workoutData', JSON.stringify(workoutData))
  }, [workoutData])

  useEffect(() => {
    let interval
    if (restTimer && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft(t => {
          if (t <= 1) {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200])
            setRestTimer(null)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [restTimer, restTimeLeft])

  const getDayExercises = (dayId) => workoutData.days[dayId] || []

  const getFilteredCatalogExercises = () => {
    const searchLower = catalogSearch.toLowerCase().trim()
    let exercises = []
    if (selectedMuscleGroup === 'All') {
      MUSCLE_GROUPS.forEach(group => {
        EXERCISE_CATALOG[group].forEach(exercise => {
          exercises.push({ name: exercise, muscleGroup: group })
        })
      })
    } else {
      exercises = EXERCISE_CATALOG[selectedMuscleGroup].map(exercise => ({
        name: exercise, muscleGroup: selectedMuscleGroup
      }))
    }
    if (searchLower) {
      exercises = exercises.filter(ex => ex.name.toLowerCase().includes(searchLower))
    }
    return exercises
  }

  const selectCatalogExercise = (exerciseName) => setNewExerciseName(exerciseName)

  const addWorkoutDay = (dayId) => {
    if (!workoutData.days[dayId]) {
      setWorkoutData(prev => ({ ...prev, days: { ...prev.days, [dayId]: [] } }))
    }
    setShowAddDay(false)
  }

  const addExercise = () => {
    if (!newExerciseName.trim() || !selectedDay) return
    const newExercise = {
      id: Date.now().toString(),
      name: newExerciseName.trim(),
      sets: [{ id: '1', weight: '', reps: '', completed: false }]
    }
    setWorkoutData(prev => ({
      ...prev,
      days: { ...prev.days, [selectedDay]: [...(prev.days[selectedDay] || []), newExercise] }
    }))
    setNewExerciseName('')
    setCatalogSearch('')
    setSelectedMuscleGroup('All')
    setShowAddExercise(false)
  }

  const deleteExercise = (exerciseId) => {
    setWorkoutData(prev => ({
      ...prev,
      days: { ...prev.days, [selectedDay]: prev.days[selectedDay].filter(e => e.id !== exerciseId) }
    }))
  }

  const addSet = (exerciseId) => {
    setWorkoutData(prev => {
      const dayExercises = prev.days[selectedDay].map(exercise => {
        if (exercise.id === exerciseId) {
          const newSetNumber = exercise.sets.length + 1
          return {
            ...exercise,
            sets: [...exercise.sets, { 
              id: newSetNumber.toString(), 
              weight: exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1].weight : '',
              reps: '', completed: false 
            }]
          }
        }
        return exercise
      })
      return { ...prev, days: { ...prev.days, [selectedDay]: dayExercises } }
    })
  }

  const deleteSet = (exerciseId, setIndex) => {
    setWorkoutData(prev => {
      const dayExercises = prev.days[selectedDay].map(exercise => {
        if (exercise.id === exerciseId && exercise.sets.length > 1) {
          return { ...exercise, sets: exercise.sets.filter((_, idx) => idx !== setIndex) }
        }
        return exercise
      })
      return { ...prev, days: { ...prev.days, [selectedDay]: dayExercises } }
    })
  }

  const updateSet = (exerciseId, setIndex, field, value) => {
    setWorkoutData(prev => {
      const dayExercises = prev.days[selectedDay].map(exercise => {
        if (exercise.id === exerciseId) {
          const newSets = [...exercise.sets]
          newSets[setIndex] = { ...newSets[setIndex], [field]: value }
          return { ...exercise, sets: newSets }
        }
        return exercise
      })
      return { ...prev, days: { ...prev.days, [selectedDay]: dayExercises } }
    })
  }

  const toggleSetComplete = (exerciseId, setIndex) => {
    const exercise = workoutData.days[selectedDay].find(e => e.id === exerciseId)
    const set = exercise.sets[setIndex]
    const wasCompleted = set.completed
    updateSet(exerciseId, setIndex, 'completed', !wasCompleted)
    if (!wasCompleted && set.weight && set.reps) {
      setRestTimer({ exerciseId, setIndex })
      setRestTimeLeft(90)
      setWorkoutData(prev => ({
        ...prev,
        history: [...prev.history, {
          date: new Date().toISOString(),
          exercise: exercise.name,
          weight: set.weight,
          reps: set.reps,
          dayId: selectedDay
        }]
      }))
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStats = () => {
    const history = workoutData.history
    const totalWorkouts = new Set(history.map(h => h.date.split('T')[0])).size
    const totalSets = history.length
    const totalWeight = history.reduce((sum, h) => sum + (parseFloat(h.weight) || 0) * (parseInt(h.reps) || 0), 0)
    const uniqueExercises = new Set(history.map(h => h.exercise)).size
    return { totalWorkouts, totalSets, totalWeight, uniqueExercises }
  }

  const getGroupedHistory = () => {
    const grouped = {}
    workoutData.history.slice().reverse().forEach(item => {
      const date = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(item)
    })
    return grouped
  }

  const getActiveDays = () => DAYS_OF_WEEK.filter(day => workoutData.days[day.id]?.length > 0)
  const getAvailableDays = () => DAYS_OF_WEEK.filter(day => !workoutData.days[day.id] || workoutData.days[day.id].length === 0)

  const deleteDay = (dayId) => {
    setWorkoutData(prev => {
      const newDays = { ...prev.days }
      delete newDays[dayId]
      return { ...prev, days: newDays }
    })
    setView(VIEWS.DAYS)
    setSelectedDay(null)
  }

  const renderContent = () => {
    if (navTab === 'history') return renderHistory()
    if (navTab === 'stats') return renderStats()
    switch (view) {
      case VIEWS.DAY_DETAIL: return renderDayDetail()
      default: return renderDays()
    }
  }

  const renderDays = () => {
    const activeDays = getActiveDays()
    return (
      <>
        <div className="header">
          <h1>Workout Trainer</h1>
          <p className="header-subtitle">Your personal fitness companion</p>
        </div>
        <div className="content">
          {activeDays.length === 0 ? (
            <div className="empty-state">
              <DumbbellIcon className="icon-large" />
              <h3 className="empty-state-title">No workout days yet</h3>
              <p className="empty-state-text">Create your first workout day to get started</p>
              <button className="btn btn-primary" onClick={() => setShowAddDay(true)}>Add Workout Day</button>
            </div>
          ) : (
            <>
              <p className="section-title">Your Workout Days</p>
              {activeDays.map(day => {
                const exercises = getDayExercises(day.id)
                return (
                  <div key={day.id} className="card card-clickable" onClick={() => { setSelectedDay(day.id); setView(VIEWS.DAY_DETAIL) }}>
                    <div className="day-card">
                      <div className="day-icon" style={{ backgroundColor: DAY_COLORS[day.id] }}>{day.abbr}</div>
                      <div className="day-info">
                        <div className="day-name">{day.name}</div>
                        <div className="day-exercises">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="day-arrow">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
        {activeDays.length > 0 && getAvailableDays().length > 0 && (
          <button className="fab" onClick={() => setShowAddDay(true)}>+</button>
        )}
      </>
    )
  }

  const renderDayDetail = () => {
    const day = DAYS_OF_WEEK.find(d => d.id === selectedDay)
    const exercises = getDayExercises(selectedDay)
    const completedSets = exercises.reduce((sum, e) => sum + e.sets.filter(s => s.completed).length, 0)
    const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0)
    return (
      <>
        <div className="header">
          <button className="header-back" onClick={() => { setView(VIEWS.DAYS); setSelectedDay(null) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h1>{day?.name}</h1>
          <p className="header-subtitle">{exercises.length} exercises</p>
        </div>
        <div className="content">
          {totalSets > 0 && (
            <div className="workout-summary">
              <div className="workout-summary-title">Today's Progress</div>
              <div className="workout-summary-value">{completedSets} / {totalSets} sets</div>
            </div>
          )}
          {exercises.length === 0 ? (
            <div className="empty-state">
              <ClipboardIcon className="icon-large" />
              <h3 className="empty-state-title">No exercises yet</h3>
              <p className="empty-state-text">Add exercises to your {day?.name} workout</p>
              <button className="btn btn-primary" onClick={() => setShowAddExercise(true)}>Add Exercise</button>
            </div>
          ) : (
            <>
              {exercises.map(exercise => (
                <div key={exercise.id} className="exercise-card">
                  <div className="exercise-header">
                    <div className="exercise-name">{exercise.name}</div>
                    <button className="exercise-delete" onClick={() => deleteExercise(exercise.id)}><TrashIcon className="icon-small" /></button>
                  </div>
                  <div className="sets-container">
                    {exercise.sets.map((set, idx) => (
                      <div key={set.id} className="set-row">
                        <div className="set-number">{idx + 1}</div>
                        <div className="set-inputs">
                          <div className="input-group">
                            <span className="input-label">Weight (lbs)</span>
                            <input type="number" className="input-field" value={set.weight} onChange={(e) => updateSet(exercise.id, idx, 'weight', e.target.value)} placeholder="0" inputMode="decimal" />
                          </div>
                          <div className="input-group">
                            <span className="input-label">Reps</span>
                            <input type="number" className="input-field" value={set.reps} onChange={(e) => updateSet(exercise.id, idx, 'reps', e.target.value)} placeholder="0" inputMode="numeric" />
                          </div>
                        </div>
                        <button className={`set-complete ${set.completed ? 'completed' : ''}`} onClick={() => toggleSetComplete(exercise.id, idx)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        {exercise.sets.length > 1 && (
                          <button className="set-delete" onClick={() => deleteSet(exercise.id, idx)}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="btn add-set-btn" onClick={() => addSet(exercise.id)}>+ Add Set</button>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={() => setShowAddExercise(true)} style={{ marginTop: '8px' }}>+ Add Exercise</button>
              <button className="btn btn-ghost" onClick={() => deleteDay(selectedDay)} style={{ marginTop: '16px', color: 'var(--danger)' }}>Delete This Day</button>
            </>
          )}
        </div>
        {exercises.length > 0 && <button className="fab" onClick={() => setShowAddExercise(true)}>+</button>}
      </>
    )
  }

  const renderHistory = () => {
    const grouped = getGroupedHistory()
    const dates = Object.keys(grouped)
    return (
      <>
        <div className="header">
          <h1>History</h1>
          <p className="header-subtitle">Your workout records</p>
        </div>
        <div className="content">
          {dates.length === 0 ? (
            <div className="empty-state">
              <ClipboardIcon className="icon-large" />
              <h3 className="empty-state-title">No history yet</h3>
              <p className="empty-state-text">Complete sets to build your history</p>
            </div>
          ) : (
            dates.map(date => (
              <div key={date}>
                <div className="history-date">{date}</div>
                <div className="card">
                  {grouped[date].map((item, idx) => (
                    <div key={idx} className="history-item">
                      <div className="history-exercise">{item.exercise}</div>
                      <div className="history-details">{item.weight} lbs × {item.reps} reps</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </>
    )
  }

  const renderStats = () => {
    const stats = getStats()
    return (
      <>
        <div className="header">
          <h1>Statistics</h1>
          <p className="header-subtitle">Track your progress</p>
        </div>
        <div className="content">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{stats.totalWorkouts}</div><div className="stat-label">Workout Days</div></div>
            <div className="stat-card"><div className="stat-value">{stats.totalSets}</div><div className="stat-label">Sets Completed</div></div>
            <div className="stat-card"><div className="stat-value">{Math.round(stats.totalWeight).toLocaleString()}</div><div className="stat-label">Total Volume (lbs)</div></div>
            <div className="stat-card"><div className="stat-value">{stats.uniqueExercises}</div><div className="stat-label">Unique Exercises</div></div>
          </div>
          {stats.totalSets === 0 && (
            <div className="empty-state">
              <ChartIcon className="icon-large" />
              <h3 className="empty-state-title">Start tracking</h3>
              <p className="empty-state-text">Complete workouts to see your stats</p>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="app">
      {renderContent()}
      
      <nav className="bottom-nav">
        <button className={`nav-item ${navTab === 'workout' ? 'active' : ''}`} onClick={() => { setNavTab('workout'); setView(VIEWS.DAYS); setSelectedDay(null) }}>
          <DumbbellIcon className="nav-icon" /><span className="nav-item-label">Workout</span>
        </button>
        <button className={`nav-item ${navTab === 'history' ? 'active' : ''}`} onClick={() => setNavTab('history')}>
          <ClipboardIcon className="nav-icon" /><span className="nav-item-label">History</span>
        </button>
        <button className={`nav-item ${navTab === 'stats' ? 'active' : ''}`} onClick={() => setNavTab('stats')}>
          <ChartIcon className="nav-icon" /><span className="nav-item-label">Stats</span>
        </button>
      </nav>

      {restTimer && (
        <div className="rest-timer">
          <div className="rest-timer-info">
            <ClockIcon className="rest-timer-icon" />
            <div><div className="rest-timer-text">Rest Timer</div><div className="rest-timer-time">{formatTime(restTimeLeft)}</div></div>
          </div>
          <button className="rest-timer-close" onClick={() => setRestTimer(null)}>×</button>
        </div>
      )}

      {showAddDay && (
        <div className="modal-overlay" onClick={() => setShowAddDay(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="swipe-hint"></div>
            <div className="modal-header">
              <h2 className="modal-title">Add Workout Day</h2>
              <button className="modal-close" onClick={() => setShowAddDay(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="section-title">Select a day</p>
              <div className="day-selector">
                {getAvailableDays().map(day => (
                  <button key={day.id} className={`day-option ${selectedDayForAdd === day.id ? 'selected' : ''}`} onClick={() => setSelectedDayForAdd(day.id)}>
                    <span className="day-option-badge" style={{ backgroundColor: DAY_COLORS[day.id] }}>{day.abbr}</span> {day.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddDay(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { if (selectedDayForAdd) { addWorkoutDay(selectedDayForAdd); setSelectedDay(selectedDayForAdd); setView(VIEWS.DAY_DETAIL); setSelectedDayForAdd('') } }} disabled={!selectedDayForAdd}>Add Day</button>
            </div>
          </div>
        </div>
      )}

      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="swipe-hint"></div>
            <div className="modal-header">
              <h2 className="modal-title">Add Exercise</h2>
              <button className="modal-close" onClick={() => setShowAddExercise(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Exercise Name</label>
                <input type="text" className="form-input" placeholder="Search or type custom exercise" value={newExerciseName} onChange={(e) => { setNewExerciseName(e.target.value); setCatalogSearch(e.target.value) }} autoFocus />
              </div>
              <div className="catalog-section">
                <label className="form-label">Or select from catalog</label>
                <div className="muscle-group-filters">
                  <button className={`filter-btn ${selectedMuscleGroup === 'All' ? 'active' : ''}`} onClick={() => setSelectedMuscleGroup('All')}>All</button>
                  {MUSCLE_GROUPS.map(group => (
                    <button key={group} className={`filter-btn ${selectedMuscleGroup === group ? 'active' : ''}`} onClick={() => setSelectedMuscleGroup(group)}>{group}</button>
                  ))}
                </div>
                <div className="catalog-list">
                  {getFilteredCatalogExercises().map((exercise, idx) => (
                    <button key={`${exercise.muscleGroup}-${exercise.name}-${idx}`} className={`catalog-item ${newExerciseName === exercise.name ? 'selected' : ''}`} onClick={() => selectCatalogExercise(exercise.name)}>
                      <span className="catalog-item-name">{exercise.name}</span>
                      <span className="catalog-item-group">{exercise.muscleGroup}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddExercise(false); setNewExerciseName(''); setCatalogSearch(''); setSelectedMuscleGroup('All') }}>Cancel</button>
              <button className="btn btn-primary" onClick={addExercise} disabled={!newExerciseName.trim()}>Add Exercise</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
