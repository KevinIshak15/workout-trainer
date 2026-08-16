import { useState, useEffect } from 'react'
import './App.css'

// Initial data structure
const DAYS_OF_WEEK = [
  { id: 'monday', name: 'Monday', icon: '💪' },
  { id: 'tuesday', name: 'Tuesday', icon: '🔥' },
  { id: 'wednesday', name: 'Wednesday', icon: '⚡' },
  { id: 'thursday', name: 'Thursday', icon: '🏋️' },
  { id: 'friday', name: 'Friday', icon: '💥' },
  { id: 'saturday', name: 'Saturday', icon: '🎯' },
  { id: 'sunday', name: 'Sunday', icon: '🌟' },
]

// Views
const VIEWS = {
  DAYS: 'days',
  DAY_DETAIL: 'day_detail',
  HISTORY: 'history',
  STATS: 'stats'
}

function App() {
  // State
  const [view, setView] = useState(VIEWS.DAYS)
  const [selectedDay, setSelectedDay] = useState(null)
  const [workoutData, setWorkoutData] = useState(() => {
    const saved = localStorage.getItem('workoutData')
    return saved ? JSON.parse(saved) : {
      days: {},
      history: [],
      exercises: {}
    }
  })
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [selectedDayForAdd, setSelectedDayForAdd] = useState('')
  const [restTimer, setRestTimer] = useState(null)
  const [restTimeLeft, setRestTimeLeft] = useState(0)
  const [navTab, setNavTab] = useState('workout')

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('workoutData', JSON.stringify(workoutData))
  }, [workoutData])

  // Rest timer countdown
  useEffect(() => {
    let interval
    if (restTimer && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft(t => {
          if (t <= 1) {
            // Timer done - vibrate if available
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

  // Get exercises for a day
  const getDayExercises = (dayId) => {
    return workoutData.days[dayId] || []
  }

  // Add a workout day
  const addWorkoutDay = (dayId) => {
    if (!workoutData.days[dayId]) {
      setWorkoutData(prev => ({
        ...prev,
        days: {
          ...prev.days,
          [dayId]: []
        }
      }))
    }
    setShowAddDay(false)
  }

  // Add exercise to day
  const addExercise = () => {
    if (!newExerciseName.trim() || !selectedDay) return
    
    const newExercise = {
      id: Date.now().toString(),
      name: newExerciseName.trim(),
      sets: [{ id: '1', weight: '', reps: '', completed: false }]
    }
    
    setWorkoutData(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [selectedDay]: [...(prev.days[selectedDay] || []), newExercise]
      }
    }))
    
    setNewExerciseName('')
    setShowAddExercise(false)
  }

  // Delete exercise
  const deleteExercise = (exerciseId) => {
    setWorkoutData(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [selectedDay]: prev.days[selectedDay].filter(e => e.id !== exerciseId)
      }
    }))
  }

  // Add set to exercise
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
              reps: '', 
              completed: false 
            }]
          }
        }
        return exercise
      })
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: dayExercises
        }
      }
    })
  }

  // Delete set
  const deleteSet = (exerciseId, setIndex) => {
    setWorkoutData(prev => {
      const dayExercises = prev.days[selectedDay].map(exercise => {
        if (exercise.id === exerciseId && exercise.sets.length > 1) {
          return {
            ...exercise,
            sets: exercise.sets.filter((_, idx) => idx !== setIndex)
          }
        }
        return exercise
      })
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: dayExercises
        }
      }
    })
  }

  // Update set
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
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: dayExercises
        }
      }
    })
  }

  // Toggle set completion
  const toggleSetComplete = (exerciseId, setIndex) => {
    const exercise = workoutData.days[selectedDay].find(e => e.id === exerciseId)
    const set = exercise.sets[setIndex]
    const wasCompleted = set.completed
    
    updateSet(exerciseId, setIndex, 'completed', !wasCompleted)
    
    // Start rest timer when completing a set
    if (!wasCompleted && set.weight && set.reps) {
      setRestTimer({ exerciseId, setIndex })
      setRestTimeLeft(90) // 90 second rest
      
      // Save to history
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

  // Format rest time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate stats
  const getStats = () => {
    const history = workoutData.history
    const totalWorkouts = new Set(history.map(h => h.date.split('T')[0])).size
    const totalSets = history.length
    const totalWeight = history.reduce((sum, h) => sum + (parseFloat(h.weight) || 0) * (parseInt(h.reps) || 0), 0)
    const uniqueExercises = new Set(history.map(h => h.exercise)).size
    
    return { totalWorkouts, totalSets, totalWeight, uniqueExercises }
  }

  // Get history grouped by date
  const getGroupedHistory = () => {
    const grouped = {}
    workoutData.history.slice().reverse().forEach(item => {
      const date = new Date(item.date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      })
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(item)
    })
    return grouped
  }

  // Get active days (days that have exercises)
  const getActiveDays = () => {
    return DAYS_OF_WEEK.filter(day => workoutData.days[day.id]?.length > 0)
  }

  // Get available days to add
  const getAvailableDays = () => {
    return DAYS_OF_WEEK.filter(day => !workoutData.days[day.id] || workoutData.days[day.id].length === 0)
  }

  // Delete day
  const deleteDay = (dayId) => {
    setWorkoutData(prev => {
      const newDays = { ...prev.days }
      delete newDays[dayId]
      return { ...prev, days: newDays }
    })
    setView(VIEWS.DAYS)
    setSelectedDay(null)
  }

  // Render based on view
  const renderContent = () => {
    if (navTab === 'history') {
      return renderHistory()
    }
    if (navTab === 'stats') {
      return renderStats()
    }

    switch (view) {
      case VIEWS.DAY_DETAIL:
        return renderDayDetail()
      default:
        return renderDays()
    }
  }

  // Render days list
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
              <div className="empty-state-icon">🏋️</div>
              <h3 className="empty-state-title">No workout days yet</h3>
              <p className="empty-state-text">Create your first workout day to get started</p>
              <button className="btn btn-primary" onClick={() => setShowAddDay(true)}>
                Add Workout Day
              </button>
            </div>
          ) : (
            <>
              <p className="section-title">Your Workout Days</p>
              {activeDays.map(day => {
                const exercises = getDayExercises(day.id)
                return (
                  <div 
                    key={day.id} 
                    className="card card-clickable"
                    onClick={() => {
                      setSelectedDay(day.id)
                      setView(VIEWS.DAY_DETAIL)
                    }}
                  >
                    <div className="day-card">
                      <div className="day-icon">{day.icon}</div>
                      <div className="day-info">
                        <div className="day-name">{day.name}</div>
                        <div className="day-exercises">
                          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="day-arrow">›</div>
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

  // Render day detail
  const renderDayDetail = () => {
    const day = DAYS_OF_WEEK.find(d => d.id === selectedDay)
    const exercises = getDayExercises(selectedDay)
    const completedSets = exercises.reduce((sum, e) => sum + e.sets.filter(s => s.completed).length, 0)
    const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0)
    
    return (
      <>
        <div className="header">
          <button className="header-back" onClick={() => {
            setView(VIEWS.DAYS)
            setSelectedDay(null)
          }}>
            ← Back
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
              <div className="empty-state-icon">📝</div>
              <h3 className="empty-state-title">No exercises yet</h3>
              <p className="empty-state-text">Add exercises to your {day?.name} workout</p>
              <button className="btn btn-primary" onClick={() => setShowAddExercise(true)}>
                Add Exercise
              </button>
            </div>
          ) : (
            <>
              {exercises.map(exercise => (
                <div key={exercise.id} className="exercise-card">
                  <div className="exercise-header">
                    <div className="exercise-name">{exercise.name}</div>
                    <button 
                      className="exercise-delete"
                      onClick={() => deleteExercise(exercise.id)}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <div className="sets-container">
                    {exercise.sets.map((set, idx) => (
                      <div key={set.id} className="set-row">
                        <div className="set-number">{idx + 1}</div>
                        <div className="set-inputs">
                          <div className="input-group">
                            <span className="input-label">Weight (lbs)</span>
                            <input
                              type="number"
                              className="input-field"
                              value={set.weight}
                              onChange={(e) => updateSet(exercise.id, idx, 'weight', e.target.value)}
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </div>
                          <div className="input-group">
                            <span className="input-label">Reps</span>
                            <input
                              type="number"
                              className="input-field"
                              value={set.reps}
                              onChange={(e) => updateSet(exercise.id, idx, 'reps', e.target.value)}
                              placeholder="0"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                        <button
                          className={`set-complete ${set.completed ? 'completed' : ''}`}
                          onClick={() => toggleSetComplete(exercise.id, idx)}
                        >
                          ✓
                        </button>
                        {exercise.sets.length > 1 && (
                          <button
                            className="set-delete"
                            onClick={() => deleteSet(exercise.id, idx)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    className="btn add-set-btn"
                    onClick={() => addSet(exercise.id)}
                  >
                    + Add Set
                  </button>
                </div>
              ))}
              
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowAddExercise(true)}
                style={{ marginTop: '8px' }}
              >
                + Add Exercise
              </button>

              <button 
                className="btn btn-ghost" 
                onClick={() => deleteDay(selectedDay)}
                style={{ marginTop: '16px', color: 'var(--danger)' }}
              >
                Delete This Day
              </button>
            </>
          )}
        </div>
        
        {exercises.length > 0 && (
          <button className="fab" onClick={() => setShowAddExercise(true)}>+</button>
        )}
      </>
    )
  }

  // Render history
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
              <div className="empty-state-icon">📊</div>
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
                      <div className="history-details">
                        {item.weight} lbs × {item.reps} reps
                      </div>
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

  // Render stats
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
            <div className="stat-card">
              <div className="stat-value">{stats.totalWorkouts}</div>
              <div className="stat-label">Workout Days</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalSets}</div>
              <div className="stat-label">Sets Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Math.round(stats.totalWeight).toLocaleString()}</div>
              <div className="stat-label">Total Volume (lbs)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.uniqueExercises}</div>
              <div className="stat-label">Unique Exercises</div>
            </div>
          </div>
          
          {stats.totalSets === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
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
      
      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${navTab === 'workout' ? 'active' : ''}`}
          onClick={() => {
            setNavTab('workout')
            setView(VIEWS.DAYS)
            setSelectedDay(null)
          }}
        >
          <span className="nav-item-icon">🏋️</span>
          <span className="nav-item-label">Workout</span>
        </button>
        <button 
          className={`nav-item ${navTab === 'history' ? 'active' : ''}`}
          onClick={() => setNavTab('history')}
        >
          <span className="nav-item-icon">📋</span>
          <span className="nav-item-label">History</span>
        </button>
        <button 
          className={`nav-item ${navTab === 'stats' ? 'active' : ''}`}
          onClick={() => setNavTab('stats')}
        >
          <span className="nav-item-icon">📊</span>
          <span className="nav-item-label">Stats</span>
        </button>
      </nav>
      
      {/* Rest Timer */}
      {restTimer && (
        <div className="rest-timer">
          <div className="rest-timer-info">
            <span className="rest-timer-icon">⏱️</span>
            <div>
              <div className="rest-timer-text">Rest Timer</div>
              <div className="rest-timer-time">{formatTime(restTimeLeft)}</div>
            </div>
          </div>
          <button className="rest-timer-close" onClick={() => setRestTimer(null)}>×</button>
        </div>
      )}
      
      {/* Add Day Modal */}
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
                  <button
                    key={day.id}
                    className={`day-option ${selectedDayForAdd === day.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDayForAdd(day.id)}
                  >
                    {day.icon} {day.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddDay(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (selectedDayForAdd) {
                    addWorkoutDay(selectedDayForAdd)
                    setSelectedDay(selectedDayForAdd)
                    setView(VIEWS.DAY_DETAIL)
                    setSelectedDayForAdd('')
                  }
                }}
                disabled={!selectedDayForAdd}
              >
                Add Day
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Exercise Modal */}
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
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Bench Press"
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => {
                setShowAddExercise(false)
                setNewExerciseName('')
              }}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={addExercise}
                disabled={!newExerciseName.trim()}
              >
                Add Exercise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
