# Workout Trainer

A beautiful personal workout trainer app designed for iPhone 15 Pro Max. Track your workout days, exercises, weights, and reps with an intuitive mobile-first interface.

## Features

- **Workout Days**: Create and manage workout days (Monday through Sunday)
- **Exercise Tracking**: Add unlimited exercises to each workout day
- **Sets Management**: Track multiple sets per exercise with weight and reps
- **Progress Tracking**: Mark sets as complete and see your daily progress
- **Rest Timer**: Automatic 90-second rest timer after completing a set
- **History**: View your complete workout history organized by date
- **Statistics**: Track total workouts, sets completed, volume, and unique exercises
- **Offline Support**: Works without internet connection (PWA)
- **Data Persistence**: All data saved locally on your device

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

### Creating Workout Days

1. Open the app and tap **"Add Workout Day"** or the **+** button
2. Select the day of the week (e.g., Monday, Wednesday, Friday)
3. The new day will appear in your workout list

### Adding Exercises

1. Tap on a workout day to open it
2. Tap **"Add Exercise"** or the **+** button
3. Enter the exercise name (e.g., "Bench Press", "Squats")
4. The exercise will be added with one set ready to track

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

### Viewing History & Stats

- Tap **"History"** in the bottom navigation to see all completed sets
- Tap **"Stats"** to view your workout statistics

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
