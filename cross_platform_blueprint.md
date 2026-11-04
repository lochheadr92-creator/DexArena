# Cross-Platform Blueprint: Web to Mobile

## Detection
- **Source Platform:** Web (`/app/frontend`, React SPA)
- **Target Platform:** Mobile (`/app/mobile`, Expo / React Native)
- **Evidence:** `frontend/src` is fully populated with `pages/`, `components/`, and a custom JS game engine in `game/`. `mobile/app` contains only a placeholder `index.tsx`. The prompt instructs us to add the missing platform.

## Existing App Map
### Screens & Routing
- **RosterPage (`/`)**: Main team selection screen, displays creature roster, filters, and current team.
- **TerrainPage (`/arena`)**: Selects battle terrain, rival level, and presents daily challenges.
- **GauntletPage (`/gauntlet`)**: A multi-stage gauntlet mode with run history.
- **SavePage (`/save`)**: Save management, unlocking tracking, replay gallery, and presets.
- **BattlePage (`/battle`, `/replay`)**: Renders the core battle loop using a `<canvas>`. Includes `BattleHud`, `BattleCanvas`, `ResultScreen`.

### Components & State
- **GameContext (`context/GameContext.jsx`)**: Core state manager holding `save`, `creatures`, `progress`, and caching logic.
- **Game Engine (`game/`)**: Pure JS game logic (`combat.js`, `step.js`, `ai.js`, `damage.js`, `physics.js`).
- **UI Components (`components/`)**: Uses Radix UI, Tailwind CSS, Lucide icons (e.g. `CreatureCard`, `TeamTray`, `BattleCanvas`).
- **Data Persistence (`lib/idb.js`, `lib/save.js`)**: Uses `localStorage` for saves and IndexedDB (`idb.js`) for caching PokeAPI data (creatures, moves, sprites).

## Shared Backend API Surface
The game logic operates primarily client-side, but the backend contains status check endpoints that the app may use or will use:
- **`GET /api/status`**
  - **Description:** Returns a list of `StatusCheck` records.
  - **Response:** `Array<{ id: string, client_name: string, timestamp: string }>`
- **`POST /api/status`**
  - **Description:** Creates a new status check record.
  - **Request Body:** `{ "client_name": "string" }`
  - **Response:** `StatusCheck` object `{ id: string, client_name: string, timestamp: string }`
*(Note: A `GET /` endpoint returning `{"message": "Hello World"}` also exists but is for general server checks).*

## Data Models & Integrations
- **MongoDB Models**: `status_checks` collection storing status records.
- **Third-Party Integrations**: 
  - **PokeAPI (`lib/pokeapi.js`)**: Fetches Pokémon data directly from `https://pokeapi.co/api/v2`.
- **Platform-Specific Needs**: 
  - PokeAPI data is cached in IndexedDB via `idb.js`. This MUST be replaced on mobile (IndexedDB is not available in React Native). Use `@react-native-async-storage/async-storage` for JSON data, and `expo-file-system` for images.
  - Saves are stored in `localStorage`, which MUST be replaced with `AsyncStorage`.

## Port Requirements (Mobile)
- **Engine & Context**: 
  - Move/copy `frontend/src/game` and `frontend/src/lib` logic into the mobile project.
  - Provide a platform-agnostic wrapper for `idb.js` and `save.js` (replacing `localStorage`/`indexedDB` with `AsyncStorage`).
- **Navigation (`expo-router`)**: Implement stack/tabs matching Web's `react-router-dom` configuration.
  - `app/_layout.tsx`: Equivalent to `AppShell`, managing tabs or bottom navigation.
  - `app/index.tsx` (RosterPage): Build with `FlatList` for creature rendering and safe-area insets.
  - `app/arena.tsx` (TerrainPage): Build terrain selection and rival UI using React Native primitives.
  - `app/gauntlet.tsx` (GauntletPage): Render the run history using React Native.
  - `app/save.tsx` (SavePage): Settings and save management ported to mobile components.
  - `app/battle.tsx` & `app/replay.tsx` (BattlePage): **CRITICAL:** The web app uses an HTML5 `<canvas>` (`BattleCanvas.jsx`) for rendering at 60fps. The target platform has `react-native-webview` installed. You should likely host the battle renderer inside a `WebView` (injecting the canvas and engine) or rewrite the renderer to use Expo GL. The WebView approach guarantees identical visual logic and leverages existing code.
- **Styling & Components**: 
  - Replace Radix/Tailwind components with React Native primitives (`View`, `Text`, `StyleSheet` etc). 
  - The mobile package has `expo-symbols` installed, use this for icons (instead of `lucide-react`).

## Open Questions / Risks
- **Battle Canvas Porting Strategy**: Should the battle engine run entirely inside a WebView to preserve the `<canvas>` renderer, or should the engine run in the JS thread and render via Expo GL? A WebView wrapper around `BattleCanvas` is the lowest risk but needs a clear bridge for inputs and state.
- **Sprite Caching**: IndexedDB handles sprites caching on Web. Should we use `expo-file-system` to cache sprite images on device, or rely on `expo-image` built-in caching instead?
- **Responsiveness**: The web battle is tuned for a 9:16 canvas. React Native safe areas might require adjusting the HUD overlay on physical devices to avoid overlap with notches/home indicators.