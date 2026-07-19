# EAS Build — profiles & required secrets

Use these profiles from `eas.json`:

| Profile | Purpose | `NODE_ENV` |
|---------|---------|------------|
| `development` | Dev client, internal distribution | `development` |
| `preview` | Internal QA / TestFlight-style builds | `production` |
| `production` | App Store / Play Store submission | `production` |

## Before your first real build

Set EAS secrets (`eas secret:create`) or project env vars in the Expo dashboard.

### Client (baked in at build time — `EXPO_PUBLIC_*`)

| Variable | Required for | Notes |
|----------|--------------|-------|
| `EXPO_PUBLIC_API_URL` | All builds hitting your backend | HTTPS URL in preview/production (e.g. `https://api.trackyourlift.com`) |
| `EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED` | IAP | `"true"` when RevenueCat is configured |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | iOS IAP | RevenueCat public iOS key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Android IAP | RevenueCat public Android key |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | IAP | Default `pro` — match RevenueCat dashboard |
| `EXPO_PUBLIC_RAPIDAPI_KEY` | Exercise GIFs | Optional but recommended for animated demos |
| `EXPO_PUBLIC_MEDIA_PROVIDER` | Exercise media | Default `static`; set `ymove` when licensed |

### Server (deployed backend — not in the mobile binary)

| Variable | Required for | Notes |
|----------|--------------|-------|
| `JWT_SECRET` | Auth / sync | Long random string; rotate invalidates existing tokens |
| `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` | AI plan import & coach | At least one for AI features |
| `SUBSCRIPTIONS_ENABLED` | Pro tier | `"true"` when webhooks are live |
| `REVENUECAT_WEBHOOK_SECRET` | Pro sync | Bearer token for `POST /api/subscriptions/webhooks/revenuecat` |
| `RAPIDAPI_KEY` | Server-side GIF prefetch | Optional |
| `DB_PATH` | SQLite | Default `./data/app.db` on Render/Railway volume |

### Store credentials (EAS manages remotely)

- **iOS:** Apple Developer account linked in Expo (`credentialsSource: remote`). Distribution cert + provisioning profile created on first `eas build --platform ios`.
- **Android:** Google Play service account JSON uploaded to Expo for Play Store submits (`credentialsSource: remote`).

### Commands

```bash
# Development client (simulator or device)
eas build --profile development --platform ios

# Internal QA
eas build --profile preview --platform all

# Store submission
eas build --profile production --platform all
eas submit --profile production --platform ios
```

See also `.env.example` and `SUBSCRIPTIONS.md` for subscription setup.
