# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

### Auth Gate
`AuthProvider` (`src/contexts/AuthContext.tsx`) wraps the entire app. It renders **nothing** (`{!loading && children}`) while Firebase resolves auth state. If `auth` is `null` (Firebase unconfigured), loading is set to false immediately. Once resolved, `AppContent` either shows `<Onboarding />` (unauthenticated) or the main app.

### State & Data Flow
All plant state lives in `AppContent` (`src/App.tsx`). The app uses a single-page architecture with a `view` state machine (`'dashboard' | 'add' | 'analyzing' | 'result' | 'detail'`) rather than a router. Tab switching (`'garden' | 'calendar' | 'settings'`) only applies when `view === 'dashboard'`.

Plants are stored in Firestore at `users/{uid}/plants/{plantId}` and kept in sync via `subscribeToPlants` (a Firestore `onSnapshot` listener set up in a `useEffect`). All mutations go through `syncPlantToCloud`, which has a 10-second timeout to surface Firestore misconfiguration.

**Image storage:** `uploadPlantImage` in `cloudSync.ts` is intentionally a no-op — it returns the compressed base64 string directly. Images are stored as base64 inside Firestore documents (Firebase Storage was bypassed due to free-tier regional constraints).

### AI Services (`src/services/geminiService.ts`)
Uses `@google/genai` with structured JSON output (schema-enforced via `responseSchema`). Two functions:
- `identifyPlant(base64)` — species ID, health assessment, care schedule, and indoor/outdoor prediction. Returns `isPlant: boolean` — if false, the app shows an in-app error card instead of the result view. Retries up to 3 times (with 1.5s/3s backoff) on transient 503/429 errors before surfacing a user-friendly message.
- `analyzeGrowth(newImage, pastImages[])` — compares up to 3 past images against current to detect growth

Both use `gemini-3-flash-preview`. The Gemini client is instantiated per-call via `getAiClient()` to pick up the env var at call time.

### Notification Service (`src/services/notificationService.ts`)
Platform-aware: uses `@capacitor/local-notifications` on native (iOS/Android) and `Notification` API with `setTimeout` as a web fallback. Notification scheduling is fire-and-forget with no persistence — on web, notifications only fire if the app tab remains open.

### Utilities
`src/utils/calendarUtils.ts` contains pure, framework-free functions for grouping plants by watering urgency (`overdue | today | tomorrow | upcoming`) and filtering by location. All calendar logic lives here and is unit-tested independently of React.

`src/services/storage.ts` is an IndexedDB wrapper (get/set). It exists but is not currently used by the main app — plants are stored exclusively in Firestore.

### Styling
Tailwind CSS v4 (via `@tailwindcss/vite`). Custom semantic color tokens used throughout: `moss` (primary green), `stone` (text), `sand` (background), `clay` (borders/muted), `terracotta` (accent/CTA).

### Testing
Vitest + jsdom + `@testing-library/react`. Tests are colocated with source files (`*.test.ts` / `*.test.tsx`). The calendar utils are tested as pure functions. Component tests mock Firebase and Gemini services.
