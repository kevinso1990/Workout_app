# EAS Development Build — iOS Simulator (native E2E)

Use this flow for manual E2E testing. **Expo Go cannot load `react-native-purchases`** — you need a dev client built with EAS.

## Prerequisites

1. **Expo account** logged in: `npx eas login`
2. **EAS CLI**: `npm install -g eas-cli` (or use `npx eas`)
3. **Xcode** + iOS Simulator (macOS only for `--local` iOS builds)
4. **Apple Developer** account linked in Expo (for cloud builds; local simulator builds skip signing)

## Config (already in repo)

| File | Setting |
|------|---------|
| `eas.json` | `development` profile: `developmentClient: true`, `ios.simulator: true` |
| `app.json` | `ios.bundleIdentifier`: `com.ks15.trackyourlift`, `expo-dev-client` plugin |
| `app.json` | `extra.eas.projectId` set for EAS project |

## Env vars before `eas build --local`

Create `.env` in the project root (or export in your shell). **Minimum for dev simulator E2E:**

| Variable | Required | Notes |
|----------|----------|-------|
| `EXPO_PUBLIC_API_URL` | **Yes** | Backend URL the dev client will call (LAN IP for local server, e.g. `http://192.168.x.x:5000`) |
| `JWT_SECRET` | Server only | Not baked into the app; needed if you run `npm run server:dev` locally |

**Optional (enable when testing those flows):**

| Variable | When |
|----------|------|
| `EXPO_PUBLIC_RAPIDAPI_KEY` | Exercise GIF animations |
| `EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true` | RevenueCat / IAP flows |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | With subscriptions enabled |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | Default `pro` |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Server — AI plan import & coach |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | Physical device on LAN; usually not needed for Simulator |

EAS local builds read `.env` via Expo's env loading. For cloud dev builds, use `eas secret:create` instead.

## Build + install sequence

### 1. Start the backend (separate terminal)

```bash
npm run server:dev
```

### 2. Build dev client for iOS Simulator (local)

```bash
# From project root — first run may take 15–25 min (CocoaPods + native compile)
eas build --profile development --platform ios --local
```

Output: `build-*.tar.gz` in the project directory.

### 3. Install on Simulator

```bash
# Extract and install (adjust path to your build artifact)
tar -xzf build-*.tar.gz
xcrun simctl install booted TrackYourLift.app
```

Or drag the `.app` from the extracted folder onto the open Simulator.

### 4. Start Metro for the dev client

```bash
npm start
# or: npx expo start --dev-client
```

Press `i` to open in the booted simulator, or scan/open the dev client app — it connects to Metro on `localhost:8081`.

### 5. Verify

- App launches without red screen
- API calls reach your backend (`EXPO_PUBLIC_API_URL`)
- Native modules (RevenueCat when enabled) load — not available in Expo Go

## Cloud alternative (no local Xcode compile)

```bash
eas build --profile development --platform ios
eas build:run --profile development --platform ios
```

Downloads the simulator build from EAS and installs it.

## Time estimates

| Step | First run | Subsequent |
|------|-----------|------------|
| `eas build --local` (iOS Simulator) | **15–25 min** | **8–15 min** |
| `eas build` (cloud) | **10–20 min** | **8–12 min** |
| Metro `npm start` | ~30 s | ~10 s |

## Troubleshooting

- **`react-native-purchases` config plugin warning**: The npm package may not export an Expo config plugin; native linking still works via autolinking after prebuild. Remove from `plugins` only if prebuild fails.
- **Simulator cannot reach API**: Use your Mac's LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost`, if testing from a physical device. Simulator can use `http://127.0.0.1:5000` if the server runs on the same Mac.
- **Rebuild after env change**: `EXPO_PUBLIC_*` vars are inlined at build time — rebuild the dev client after changing them.
