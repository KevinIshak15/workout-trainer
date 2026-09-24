export const SPLITS = [
  {
    id: 'chest-tris',
    name: 'Chest / Tris',
    short: 'CT',
    color: '#3b82f6',
    exercises: [
      'Incline Dumbbell Press',
      'Incline Smith Press',
      'Dips',
      'Flat Bench Press',
      'Pec Deck',
      'Overhead Tris',
      'Tricep Pushdowns',
    ],
  },
  {
    id: 'back-bis',
    name: 'Back / Bis',
    short: 'BB',
    color: '#8b5cf6',
    exercises: [
      'Weighted Pull Ups',
      'Cable Lat Pulldowns',
      'T-Bar Rows',
      'Barbell Rows',
      'Lower Back Extensions',
      'Smith Machine Shrugs',
      'Elbow Supported Dumbbell Curls',
      'Barbell Preacher Curls',
      'Hammer Curls',
    ],
  },
  {
    id: 'leg-a',
    name: 'Leg A',
    short: 'LA',
    color: '#10b981',
    exercises: [
      'Adductor / Abductor',
      'Seated Hamstring Curls',
      'Barbell Squats',
      'Quad Extensions',
      'Calves',
    ],
  },
  {
    id: 'leg-b',
    name: 'Leg B',
    short: 'LB',
    color: '#f59e0b',
    exercises: [
      'Adductor / Abductor',
      'RDLs',
      'Hip Thrusts',
      'Quad Extensions',
      'Calves',
      'Hip Flexor',
    ],
  },
  {
    id: 'sarms',
    name: 'SARMs',
    subtitle: 'Shoulders & Arms',
    short: 'SA',
    color: '#ec4899',
    exercises: [
      'Dumbbell Shoulder Press',
      'Cable Shoulder Flies',
      'Dumbbell Shoulder Flies',
      'Pec Deck Rear Delts',
      'Cable Rear Delts',
      'Elbow Supported Dumbbell Curls',
      'Barbell Preacher Curls',
      'Hammer Curls',
      'Overhead Tris',
      'Tricep Pushdowns',
    ],
  },
]

export const SPLIT_BY_ID = Object.fromEntries(SPLITS.map(s => [s.id, s]))

// Legacy sessions migrated from the old day-of-week model keep a neutral look.
export const LEGACY_SPLIT = { id: 'legacy', name: 'Workout', short: 'W', color: '#71717a', exercises: [] }

export function getSplit(id) {
  return SPLIT_BY_ID[id] || LEGACY_SPLIT
}

// Flat, de-duplicated catalog. Exercises shared across splits list every split they belong to.
export const CATALOG = (() => {
  const map = new Map()
  for (const split of SPLITS) {
    for (const name of split.exercises) {
      if (!map.has(name)) map.set(name, { name, splitIds: [] })
      map.get(name).splitIds.push(split.id)
    }
  }
  return Array.from(map.values())
})()
