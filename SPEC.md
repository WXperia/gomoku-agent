# Gomoku AI Battle - 五子棋AI对决

## Project Overview

**Project Name**: Gomoku AI Battle
**Type**: Online Strategy Game
**Core Functionality**: A Gomoku (Five-in-a-Row) game where users compete against AI models with ranking system
**Target Users**: Casual gamers interested in AI strategy games

---

## Aesthetic Direction

**Theme**: "Zen Garden meets Neural Network" - A serene, minimalist Japanese zen aesthetic merged with subtle neural network-inspired patterns. The game feels like playing on a tranquil garden stone, with AI representing the harmony of nature's patterns.

**Color Palette**:
- Primary Background: `#1a1a2e` (Deep Midnight Blue)
- Secondary Background: `#16213e` (Navy Depth)
- Stone Black: `#0f0f0f`
- Stone White: `#f0f0f0`
- Accent Gold: `#d4af37` (Traditional Gold)
- Board Green: `#2d5a3d` (Moss Green)
- Grid Lines: `#4a7c59` (Sage Green)
- Text Primary: `#e8e8e8`
- Text Secondary: `#a0a0a0`

**Typography**:
- Display Font: "Cinzel" (Elegant serif for titles)
- Body Font: "Noto Sans JP" (Clean Japanese-inspired sans-serif)

---

## Layout & Structure

### Pages

1. **Home/Entry Page** (`/`)
   - Centered modal card for user registration
   - Fields: Nickname (required), Email (optional)
   - Auto-detected country/region from IP
   - "Start Game" button

2. **Model Selection Page** (`/select`)
   - Grid of AI model cards to choose from
   - Each card shows: Model name, provider, difficulty indicator
   - Visual preview of AI "personality" through icons/colors

3. **Game Page** (`/play`)
   - Full-screen PixiJS canvas
   - 15x15 Gomoku board (traditional size)
   - Side panel with game info, AI model info
   - Move history, current player indicator
   - Surrender and restart options

4. **Ranking Page** (`/ranking`)
   - Two tabs: Human Players | AI Models
   - Human ranking: sorted by total moves played
   - AI ranking: sorted by victory count
   - Country flags displayed

5. **Game Over Modal**
   - Win/Loss result with animation
   - Stats: moves played, time taken
   - "Play Again" and "New AI" options

---

## Features & Interactions

### User Entry Flow
1. User enters nickname (3-16 characters, alphanumeric + underscore)
2. Email field optional (validated if entered)
3. IP-based geolocation fetched automatically (show flag + country name)
4. Submit validates and stores in localStorage/session

### AI Model Selection
Available models:
1. **AlphaZen** - Balanced, strategic
2. **BattleMind** - Aggressive, offensive
3. **Guardian** - Defensive, patient
4. **Oracle** - Unpredictable, creative
5. **Student** - Learning AI, improves

Each model displayed as a card with:
- Model icon (unique per AI)
- Name and provider
- Difficulty rating (1-5 stars)
- Win/Loss record

### Game Mechanics
- 15x15 board (225 intersections)
- Black plays first (human)
- Click to place stone
- Win condition: 5 in a row (horizontal, vertical, diagonal)
- Draw: board full with no winner

### PixiJS Board
- Canvas renders the board with proper aspect ratio
- Grid lines with subtle texture
- Stone placement with drop animation
- Hover effect showing valid placement
- Last move marker (subtle glow)
- Win line highlight animation

### AI Move Logic
- Simple AI with varying strategies per model type
- Move delay: 500-1500ms (feels natural)
- Basic strategy: detect threats, block opponent

### Ranking System
**Human Ranking**:
- Sorted by total moves played (descending)
- Columns: Rank, Country, Nickname, Total Moves, Win%, Games

**AI Ranking**:
- Sorted by victory count (descending)
- Columns: Rank, Model, Provider, Wins, Games, Win%

---

## Component Inventory

### EntryCard
- States: default, validating, error, success
- Input fields with floating labels
- Country display with flag emoji
- Submit button with loading state

### ModelCard
- States: default, hover, selected, disabled
- Hover: scale(1.02), shadow increase
- Selected: gold border, checkmark badge
- Disabled: opacity 0.5

### GameBoard (PixiJS)
- Interactive canvas
- Hover state: ghost stone preview
- Click: place stone with bounce animation
- Win: flash winning line

### RankingTable
- Sortable columns
- Highlight current user row
- Pagination (20 per page)

### GameInfoPanel
- Current player indicator (colored dot)
- Move counter
- Timer (optional)
- Surrender button (red, confirmation required)

---

## Technical Approach

### Framework
- Nuxt.js 3 (Vue 3 Composition API)
- PixiJS 8 for game rendering
- Pinia for state management
- Vercel KV or localStorage for persistence (demo mode)

### Project Structure
```
/gomoku-game
├── nuxt.config.ts
├── app.vue
├── pages/
│   ├── index.vue        # Entry page
│   ├── select.vue      # Model selection
│   ├── play.vue        # Game page
│   └── ranking.vue     # Rankings
├── components/
│   ├── EntryCard.vue
│   ├── ModelCard.vue
│   ├── GameBoard.vue   # PixiJS wrapper
│   ├── RankingTable.vue
│   └── GameInfoPanel.vue
├── composables/
│   ├── useGame.ts
│   ├── useAI.ts
│   └── useRanking.ts
├── stores/
│   └── gameStore.ts
├── assets/
│   └── css/
│       └── main.css
└── public/
    └── favicon.ico
```

### Data Model
```typescript
interface User {
  id: string
  nickname: string
  email?: string
  country: string
  countryCode: string
  flag: string
  totalMoves: number
  gamesPlayed: number
  wins: number
  createdAt: Date
}

interface AIModel {
  id: string
  name: string
  provider: string
  difficulty: number
  icon: string
  color: string
  wins: number
  games: number
}

interface GameState {
  board: (0 | 1 | 2)[][]  // 0: empty, 1: black, 2: white
  currentPlayer: 1 | 2
  moves: { x: number; y: number; player: 1 | 2 }[]
  status: 'playing' | 'won' | 'lost' | 'draw'
  winner?: 1 | 2
}
```

### Geolocation
- Use `ipapi.co` free API for IP geolocation
- Fallback: show "Unknown" with globe icon

### Persistence
- localStorage for demo/development
- Store: users, AI stats, game history

---

## Animations & Effects

1. **Page Transitions**: Fade + slide (300ms ease-out)
2. **Stone Placement**: Scale from 0 → 1 with overshoot (400ms)
3. **Win Animation**: Pulsing glow along winning line
4. **Hover Preview**: 30% opacity ghost stone
5. **Model Card Hover**: translateY(-4px) + shadow increase
6. **Button Interactions**: Subtle scale on press
7. **Ranking Update**: Number counter animation

---

## Quality Checklist

- [ ] All form inputs validate with error messages
- [ ] PixiJS board is responsive and maintains aspect ratio
- [ ] Game logic correctly detects wins (5 in a row all directions)
- [ ] AI moves are timed and feel natural
- [ ] Rankings persist and update after games
- [ ] Mobile responsive (min 375px width)
- [ ] No console errors
- [ ] All buttons have working handlers
- [ ] Win/draw/loss states all handled