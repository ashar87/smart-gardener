# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Keep this file up to date.** Any code change that affects architecture, data flow, service behaviour, or component APIs must be reflected here before committing.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build (outputs to dist/)
npm run lint       # TypeScript type-check only (tsc --noEmit), no ESLint configured
npm test           # Run all tests once (Vitest)
npm run test:watch # Run tests in watch mode

# Run a single test file
npx vitest run src/utils/calendarUtils.test.ts
```

## Environment Setup

Copy `.env.example` to `.env` and populate all `VITE_FIREBASE_*` vars plus `VITE_GEMINI_API_KEY`. Firebase will silently skip initialization if `VITE_FIREBASE_API_KEY` is missing, leaving `auth`, `db`, and `storage` as `null` — the app will show the Onboarding screen but all auth actions will throw.

## Project Overview

Smart Gardener is an AI-powered plant identification and care management app. Users photograph a plant, Gemini identifies it and generates a care schedule, and the app tracks watering/health history with push notifications. Built as a mobile-first PWA with Capacitor for native iOS/Android packaging.

**App ID:** `com.smartgardener.app` | **Tech stack:** React 19 + Vite 6 + Firebase 12 + Tailwind 4 + Gemini AI

---

## Architecture

### Auth Gate

`AuthProvider` (`src/contexts/AuthContext.tsx`) wraps the entire app. It exposes `currentUser`, `loading`, and four auth methods (`signInWithGoogle`, `loginWithEmail`, `registerWithEmail`, `logout`). The provider renders **nothing** while Firebase resolves auth state (`{!loading && children}`). If `auth` is `null` (Firebase unconfigured), `loading` is set to `false` immediately and the auth listener is skipped. Once resolved, `AppContent` shows either `<Onboarding />` (unauthenticated) or the main app.

### State & Data Flow

All plant state lives in `AppContent` (`src/App.tsx`). The app uses a single-page architecture with a `view` state machine rather than a router:

```
'dashboard' | 'add' | 'analyzing' | 'result' | 'detail'
```

Tab switching (`'garden' | 'calendar' | 'settings'`) only applies when `view === 'dashboard'`.

**Key state variables in AppContent:**

| Variable | Type | Purpose |
|---|---|---|
| `plants` | `Plant[]` | Live-synced from Firestore |
| `view` | string | Current screen |
| `activeTab` | `Tab` | garden / calendar / settings |
| `locationFilter` | string | all / indoor / outdoor filter for garden grid |
| `currentImage` | string | base64 of the uploaded photo |
| `analysisResult` | `IdentificationResult` | Gemini output for the current upload |
| `selectedPlant` | `Plant` | Plant shown in the detail view |
| `uploadError` | `UploadError \| null` | `{ kind: 'not_a_plant' }` or `{ kind: 'api_error'; message }` — shown in-place inside the 'analyzing' view instead of navigating away |
| `manualOverride` | `{ commonName, species } \| null` | User-corrected name after "Not X?" panel |
| `isReanalyzing` | boolean | Gemini reanalysis in progress |
| `reanalyzedName` | string | Triggers "Updated Analysis" label + toast |
| `showReanalyzedToast` | boolean | Controls the success toast pill |
| `notificationsEnabled` | boolean | Persisted in localStorage |
| `compareMode` | boolean | Single vs before/after growth photo |

**View transitions:**

```
dashboard ──(FAB click)──► add ──(upload)──► analyzing ──(isPlant=true)──► result ──(confirm)──► dashboard
                                                  │                           │
                                         (isPlant=false)              (discard)
                                         (api error)                       │
                                              │                         dashboard
                                    [error card in-place]
                                    (retry → add | back → dashboard)
```

Plants are stored in Firestore at `users/{uid}/plants/{plantId}` and kept in sync via `subscribeToPlants` (a Firestore `onSnapshot` listener set up in a `useEffect`). All mutations go through `syncPlantToCloud`, which has a 10-second timeout to surface Firestore misconfiguration.

**Image storage:** `uploadPlantImage` in `cloudSync.ts` is intentionally a no-op — it returns the compressed base64 string directly. Images are stored as base64 inside Firestore documents. Firebase Storage was bypassed due to free-tier regional constraints.

### AI Services (`src/services/geminiService.ts` + `api/`)

The Gemini API key lives **server-side only**. The client calls a backend proxy; the proxy calls Gemini. This keeps the key out of the browser bundle.

**Client (`src/services/geminiService.ts`)** — thin HTTP wrapper. Calls `/api/identify`, `/api/reanalyze`, `/api/growth` via `fetch`. `VITE_API_BASE_URL` prefixes the base (empty in dev — Vite proxy handles routing; set to the Vercel deployment URL in production).

**Server (`api/`)** — Vercel Serverless Functions:
- `api/identify.ts` — POSTs image to Gemini, returns `IdentificationResult`. Retries up to 3× on 503 or network errors with 1500ms × attempt backoff.
- `api/reanalyze.ts` — Re-runs analysis with a user-confirmed plant name; forces `commonName`/`species` onto the result.
- `api/growth.ts` — Compares up to 3 past images against the current photo to detect growth.
- `api/_gemini.ts` — Shared schemas (`RESPONSE_SCHEMA`, `GROWTH_SCHEMA`), model name, and `isTransient` helper. Not a route (prefixed with `_`).

**`GEMINI_API_KEY`** must be set as an environment variable in the Vercel dashboard (or `functions/.env` for local emulator use).

**Local dev proxy** — `vite.config.ts` proxies `/api/*` → `http://localhost:3001` (Vercel dev server). Run `npx vercel dev` on port 3001 alongside `npm run dev` for a fully local setup.

**Retry / error behaviour:**
- 503 responses → retry up to 3×; after exhaustion throws the API's error message
- Network errors (`TypeError`) → retry up to 3×
- All other errors → throw immediately, no retry
- `isPlant: false` in the response → `App.tsx` shows an error card, never transitions to `'result'`

### Notification Service (`src/services/notificationService.ts`)

Platform-aware via `Capacitor.isNativePlatform()`:
- **Native (iOS/Android):** Uses `@capacitor/local-notifications` with a computed integer ID (sum of first + last char codes of `plantId`).
- **Web fallback:** Uses the `Notification` API with `setTimeout`. Notifications only fire if the app tab remains open.

Scheduling is fire-and-forget with no persistence. Cancels any existing notification before rescheduling. Exported: `requestNotificationPermission`, `scheduleWateringNotification`, `cancelWateringNotification`.

### Cloud Sync (`src/services/cloudSync.ts`)

Firestore path: `users/{userId}/plants/{plantId}`

| Function | Behaviour |
|---|---|
| `uploadPlantImage(...)` | No-op — returns base64 directly; Firebase Storage not used |
| `syncPlantToCloud(userId, plant)` | `setDoc` with 10-second timeout via `Promise.race` |
| `deletePlantFromCloud(userId, plantId)` | `deleteDoc`; does **not** delete Storage assets (none exist) |
| `subscribeToPlants(userId, callback)` | `onSnapshot` listener; sorts by `addedAt` descending; returns unsubscribe fn |

### Calendar Utilities (`src/utils/calendarUtils.ts`)

Pure, framework-free functions — unit-tested independently of React:

- `getDaysUntilWatering(nextWateredTimestamp, now?)` → whole calendar days (negative = overdue)
- `getWateringGroup(daysUntil)` → `'overdue' | 'today' | 'tomorrow' | 'upcoming'`
- `groupPlantsByWateringSchedule(plants, now?)` → Record of the 4 groups, sorted within each
- `filterPlantsByLocation(plants, filter)` → filters by `plant.location`; plants with `undefined` location are excluded from `'indoor'` / `'outdoor'` filters

---

## Components

### `BottomNav` (`src/components/BottomNav.tsx`)

Props: `{ activeTab: Tab; onTabChange: (tab: Tab) => void }`

Fixed bottom navigation with 3 tabs (Garden / Calendar / Settings). Active tab gets moss colour and a top indicator bar. Includes `aria-selected` and `aria-label` for accessibility.

### `CalendarView` (`src/components/CalendarView.tsx`)

Props: `{ plants: Plant[]; onWaterPlant: (plantId: string) => void; onPlantClick: (plant: Plant) => void }`

Groups plants by watering urgency using `groupPlantsByWateringSchedule()`. Renders 4 sections (overdue / today / tomorrow / upcoming) — only non-empty sections shown. Water button uses `stopPropagation` to avoid triggering `onPlantClick`.

### `SettingsView` (`src/components/SettingsView.tsx`)

Props: `{ notificationsEnabled: boolean; onToggleNotifications: () => void }`

Shows user profile card, notification toggle, app info (v1.0, Gemini AI), cloud sync note, and a sign-out button that calls `logout()` from `AuthContext`.

### `Onboarding` (`src/components/Onboarding.tsx`)

Three local modes: `landing → signup | login`. Supports Google OAuth and email/password auth. Validates presence + password length (≥ 6 chars) before calling Firebase. Maps Firebase error codes to user-friendly messages. Checks `!auth` before auth attempts and shows a Firebase config error if unconfigured.

---

## Types (`src/types.ts`)

```typescript
interface Plant {
  id: string;
  species: string;
  commonName: string;
  image: string;               // base64
  addedAt: number;             // Unix ms
  location?: 'indoor' | 'outdoor';
  healthStatus: PlantHealth;
  careSchedule: CareSchedule;
  history: CareEvent[];
  growthLog: GrowthMilestone[];
  reminders?: { watering: boolean; pruningFertilizing: boolean; lastNotifiedAt?: number };
}

interface IdentificationResult {
  isPlant: boolean;            // false → show error card, never transition to result view
  species: string;
  commonName: string;
  confidence: number;          // 0–1
  location: 'indoor' | 'outdoor';
  health: PlantHealth;
  careSuggestions: Partial<CareSchedule>;
}

interface PlantHealth {
  status: 'healthy' | 'warning' | 'critical';
  assessment: string;
  issues: string[];
}

interface CareSchedule {
  watering: { frequency: string; lastWatered: number; nextWatered: number };
  sunlight: string;
  fertilizer?: string;
  pruning?: string;
}

interface CareEvent {
  id: string;
  type: 'watering' | 'fertilizing' | 'pruning' | 'health_check';
  timestamp: number;
  note?: string;
}

interface GrowthMilestone {
  id: string;
  image: string;               // base64
  timestamp: number;
  analysis: { status: string; description: string; growthDetected: boolean };
}
```

---

## Styling

Tailwind CSS v4 (via `@tailwindcss/vite`). Custom semantic color tokens defined in `src/index.css`:

| Token | Hex | Usage |
|---|---|---|
| `moss` | `#5A5A40` | Primary green — buttons, active states, headings |
| `terracotta` | `#C97C5D` | Accent / CTA — add button, errors, warnings |
| `sand` | `#F5F5F0` | Background |
| `stone` | `#333` | Body text |
| `clay` | `#E8E8DF` | Borders, muted surfaces |

Fonts: **Inter** (sans-serif body) + **Cormorant Garamond** (serif headings). Animations via `motion/react` (Framer Motion). Custom utilities: `no-scrollbar`, `pt-safe`, `pb-safe`.

---

## Testing

Vitest + jsdom + `@testing-library/react`. Tests are colocated with source files (`*.test.ts` / `*.test.tsx`).

| Test file | Coverage |
|---|---|
| `geminiService.test.ts` | Plant ID (success, empty response, 503 retry × 3, non-transient errors, base64 stripping, isPlant flag, growth analysis) |
| `cloudSync.test.ts` | uploadPlantImage no-op, syncPlantToCloud path + timeout, delete, subscribe + sort |
| `firebase.test.ts` | Google sign-in, email login/register, error code mapping |
| `calendarUtils.test.ts` | getDaysUntilWatering, getWateringGroup, groupPlantsByWateringSchedule sort, filterPlantsByLocation |
| `BottomNav.test.tsx` | Tab rendering, aria-selected, onTabChange callback |
| `CalendarView.test.tsx` | Empty state, group headers, plant cards, Water button interactions, stopPropagation |
| `SettingsView.test.tsx` | Rendering, notification toggle, sign-out |
| `Onboarding.test.tsx` | Screen modes, form validation, Firebase config error |

**Mocking pattern:** `vi.mock` factories are hoisted — shared mock functions are stored on `globalThis` so tests can access them after import.

---

## Unused Code

- `src/services/storage.ts` — IndexedDB wrapper (get/set). Not imported anywhere; plants are stored exclusively in Firestore.
