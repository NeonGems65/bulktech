# Project Guidelines

## Architecture
- This repo has two runnable projects:
  - `my-expo-app/`: Expo React Native app (TypeScript + NativeWind/Tailwind).
  - `server/`: Express + PostgreSQL API (`CommonJS`).
- Keep mobile and backend changes scoped. If a UI change depends on data changes, update both sides in the same task.
- Primary API resources are `workoutlist` and `cardiolist` in `server/index.js`.

## Build and Test
- Install dependencies per project (there is no root workspace script):
  - `cd my-expo-app && npm install`
  - `cd server && npm install`
- Mobile app commands (`my-expo-app/package.json`):
  - Run dev server: `npm start`
  - Run on Android: `npm run android`
  - Run on iOS: `npm run ios`
  - Run web: `npm run web`
  - Lint: `npm run lint`
  - Format: `npm run format`
- Server commands (`server/package.json`):
  - Start API: `npm start`
  - `npm test` is a placeholder and intentionally exits with an error.

## Conventions
- Mobile components are mostly in `my-expo-app/components/` and are primarily `.tsx`.
- Utility/config modules may be `.js` files (for example `my-expo-app/utils/` and `my-expo-app/config/`). Keep existing module style unless there is a clear migration need.
- Use `getApiBaseUrl()` from `my-expo-app/config/apiBaseUrl.js` for API calls rather than hardcoding hosts.
- Preserve cache behavior in `my-expo-app/utils/workoutCache.js` and `my-expo-app/utils/cardioCache.js` (time-based AsyncStorage cache).
- Server database access goes through `server/db.js`; prefer env-driven config (`DATABASE_URL` or `PG*` variables), not inline credentials.
- Schema updates are managed as SQL files in `server/migrations/` and applied manually. Add a migration file for DB changes.

## Environment Gotchas
- The mobile app falls back to Expo host IP + port `5000` when `EXPO_PUBLIC_API_URL` is not set (`my-expo-app/config/apiBaseUrl.js`). Ensure the server runs on port `5000` in local dev or provide `EXPO_PUBLIC_API_URL`.
- Local DB defaults in `server/.env.example` use `PGPORT=5433`; verify your local PostgreSQL port before debugging connection errors.
- In production, `server/db.js` enables SSL when `NODE_ENV=production`.
