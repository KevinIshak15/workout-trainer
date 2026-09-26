# Workout Trainer

A beautiful personal workout trainer app designed for iPhone 15 Pro Max. Run your training split, log weight and reps per set, and watch each exercise's progress over time.

## Features

- **Split-based sessions**: Start a workout from your program — Chest/Tris, Back/Bis, Leg A, Leg B, or SARMs (Shoulders & Arms). Start the same split as many times as you like; every session is logged separately.
- **Pre-filled exercises**: New sessions can be pre-loaded with the split's exercises, with your last working weight carried over. "Repeat this workout" clones a past session.
- **Exercise catalog**: Every exercise in the program is one tap away, filtered by split, with search and custom entries.
- **Sets, weight and reps**: Unlimited sets per exercise; completing a set logs it to history and starts a 90-second rest timer. Each exercise shows your last performance.
- **Progress line graphs**: Weekly volume overview plus an interactive per-exercise line chart. Switch between estimated 1RM (Epley), max weight, volume and reps; filter by 1M/3M/6M/1Y/All; drag along the line to inspect any session; a dashed trend line shows your rate of change per week and the best session is ringed.
- **1-Rep PRs**: A dedicated tab to record true one-rep maxes per exercise with date and note. See current bests, every attempt, a PR line chart, and how your recorded max compares to the 1RM estimated from your working sets.
- **History**: Every completed set grouped by date, colour-coded by split.
- **Backup**: Export all data as JSON from the Progress tab.
- **Offline PWA**: Installs to the iPhone home screen and works without a connection. Data is stored in the browser (localStorage); older day-of-week data is migrated automatically.

## Installation on iPhone 15 Pro Max

### Option 1: Install as PWA (Recommended)

1. Open Safari on your iPhone
2. Navigate to the app URL
3. Tap the **Share** button (square with arrow pointing up)
4. Scroll down and tap **"Add to Home Screen"**
5. Give it a name (or keep "WorkoutPro") and tap **"Add"**
6. The app will now appear on your home screen like a native app!

### Option 2: Access via Browser

Simply bookmark the URL in Safari or any browser for quick access.

## How to Use

### Starting a Workout

1. Tap **"Start Workout"** or the **+** button
2. Pick a split (Chest/Tris, Back/Bis, Leg A, Leg B, SARMs)
3. Leave **"Pre-fill exercises"** on to load the split's exercises, or turn it off to build the session by hand
4. Start the same split again any time — each session is logged on its own

### Adding Exercises

1. Open a session and tap **"Add Exercise"** or the **+** button
2. Tap any exercise in the catalog to add it (filtered to the current split by default; use the chips to browse other splits)
3. Or type a name and tap **Add** to create a custom exercise

### Tracking Your Workout

1. Enter the **weight** (in lbs) for your set
2. Enter the number of **reps** you completed
3. Tap the **checkmark** button to mark the set as complete
4. A rest timer will automatically start (90 seconds)
5. Tap **"+ Add Set"** to add more sets

### Managing Sets

- Each exercise starts with one set
- Tap **"+ Add Set"** to add additional sets
- The weight from your previous set is automatically copied
- Tap the **×** button next to a set to delete it (if you have more than one)

### History & Progress

- **History** lists every completed set grouped by date
- **Progress** shows a weekly volume line and one row per exercise with a sparkline and trend. Tap an exercise for the full line chart: pick a metric (Est. 1RM, Max weight, Volume, Reps), pick a time range, and drag across the line to read any session's numbers.
- **PRs** is where you record real one-rep maxes. Tap **+**, choose the exercise, enter the weight and date, and save. Each exercise shows its current best, a PR line chart, and the full list of attempts.
- **Export backup** (bottom of Progress) downloads all data as JSON

## Development

### Prerequisites

- Node.js 18+ 
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
workout-trainer/
├── public/
│   ├── icon.svg          # App icon source
│   ├── pwa-192x192.png   # PWA icon
│   ├── pwa-512x512.png   # PWA icon (large)
│   └── apple-touch-icon.png
├── src/
│   ├── App.jsx           # Main app component
│   ├── App.css           # App-specific styles
│   ├── index.css         # Global styles
│   └── main.jsx          # Entry point
├── scripts/
│   └── generate-icons.js # Icon generation script
├── index.html
├── vite.config.js        # Vite + PWA configuration
└── package.json
```

## Technical Details

- **Framework**: React 18 with Vite
- **Styling**: Custom CSS optimized for iPhone 15 Pro Max
- **PWA**: Vite PWA plugin with Workbox for offline support
- **Storage**: Browser localStorage for data persistence
- **Design**: Dark mode optimized for OLED displays

## iPhone 15 Pro Max Optimizations

- Safe area insets for Dynamic Island and home indicator
- Touch targets sized for comfortable one-handed use (44px minimum)
- Viewport-fit=cover for edge-to-edge design
- 16px minimum font size to prevent iOS zoom on input focus
- Haptic feedback support (vibration on timer completion)
- Dark mode optimized for OLED power efficiency

## License

MIT
