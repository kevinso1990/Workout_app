# Subscription System — Setup & Operations Guide

This document explains how the Pro subscription plumbing works, which environment
variables you need to set, and exact steps to enable sandbox testing and later
connect real products in App Store Connect and Google Play Console.

---

## Architecture overview

```
App (StoreKit / Play Billing)
    │  purchase receipt / token
    ▼
POST /api/subscriptions/validate/apple
POST /api/subscriptions/validate/google
    │  backend calls Apple / Google to verify
    ▼
users.subscription_tier = 'pro'
subscription_receipts row created
    │
    ├── GET /api/subscriptions/status  ← useSubscription() hook polls this
    │
Apple / Google servers
    │  server-to-server lifecycle events
    ▼
POST /api/subscriptions/webhooks/apple
POST /api/subscriptions/webhooks/google
    │  on renewal / expiry / refund
    ▼
users table updated accordingly
```

---

## Default behaviour (no env vars set)

- `SUBSCRIPTIONS_ENABLED` is **false** by default.
- Every user gets full access to all features — no gating, no paywall.
- The purchase endpoints return HTTP 503 if called.
- The webhook endpoints accept calls but do nothing.
- The `ProBadge` component shows an informational "coming soon" banner on
  selected features but never blocks content.

---

## Environment variables

### Server-side (set in your deployment / `.env` file)

| Variable | Description | Required for |
|---|---|---|
| `SUBSCRIPTIONS_ENABLED` | Set to `"true"` to enable purchase validation | Both platforms |
| `APPLE_SHARED_SECRET` | Shared secret from App Store Connect → Your App → App-Specific Shared Secret | iOS |
| `APPLE_PRODUCT_ID` | Your subscription product ID, e.g. `com.yourapp.pro_monthly` | iOS (optional filter) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Full JSON content of the Google Play service account key | Android |
| `GOOGLE_PRODUCT_ID` | Your subscription product ID, e.g. `pro_monthly` | Android |
| `GOOGLE_PACKAGE_NAME` | Android app package name, e.g. `com.yourapp.fitplan` | Android |
| `GOOGLE_PUBSUB_TOKEN` | Secret token appended to the Google Pub/Sub push URL for webhook auth | Android webhooks |

### Client-side (Expo / React Native)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED` | Set to `"true"` to show purchase UI |
| `EXPO_PUBLIC_APPLE_PRODUCT_ID` | Same as server `APPLE_PRODUCT_ID` |
| `EXPO_PUBLIC_GOOGLE_PRODUCT_ID` | Same as server `GOOGLE_PRODUCT_ID` |
| `EXPO_PUBLIC_GOOGLE_PACKAGE_NAME` | Same as server `GOOGLE_PACKAGE_NAME` |

### Client-side (Vite web build — only if you build a web version)

Replace the `EXPO_PUBLIC_` prefix with `VITE_`.

---

## Step-by-step: enable sandbox testing

### 1. Create the products in the stores

**Apple (App Store Connect)**
1. Go to App Store Connect → Your App → Subscriptions.
2. Create a new subscription group (e.g. "Pro Access").
3. Add a subscription product with ID `com.yourapp.pro_monthly`, duration 1 month,
   price tier corresponding to €5.
4. Copy the **App-Specific Shared Secret** (under "Shared Secrets" on the same page).

**Google (Play Console)**
1. Go to Google Play Console → Your App → Monetize → Subscriptions.
2. Create a subscription with product ID `pro_monthly`.
3. Add a base plan with a 1-month billing period, price €5.

### 2. Install an IAP library in the app

```bash
npx expo install react-native-iap
# or
npx expo install expo-iap   # when stable
```

Then open `client/lib/purchases.ts` and replace the `TODO` blocks with the
library's API calls. The comments in that file contain exact example code for
`react-native-iap`.

### 3. Set environment variables

Create a `.env.local` file in the project root (already git-ignored):

```dotenv
# Server
SUBSCRIPTIONS_ENABLED=true
APPLE_SHARED_SECRET=your_apple_shared_secret_here
APPLE_PRODUCT_ID=com.yourapp.pro_monthly
GOOGLE_PRODUCT_ID=pro_monthly
GOOGLE_PACKAGE_NAME=com.yourapp.fitplan
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n..."}
GOOGLE_PUBSUB_TOKEN=a_random_secret_you_choose

# Client (Expo)
EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true
EXPO_PUBLIC_APPLE_PRODUCT_ID=com.yourapp.pro_monthly
EXPO_PUBLIC_GOOGLE_PRODUCT_ID=pro_monthly
EXPO_PUBLIC_GOOGLE_PACKAGE_NAME=com.yourapp.fitplan
```

### 4. Configure sandbox test accounts

**Apple**
1. In App Store Connect → Users and Access → Sandbox → Testers, add a test
   Apple ID (must be a new account, not your real Apple ID).
2. On an iOS device, sign out of the App Store, then sign in with the sandbox
   tester account only when prompted during a purchase.

**Google**
1. In Google Play Console → Setup → License Testing, add your Google account
   as a licensed tester.
2. Use that account on an Android device to make test purchases (they complete
   immediately and are not charged).

### 5. Run through the sandbox purchase flow

1. Build and run the app on a real device (simulators cannot process real IAP,
   though Apple's StoreKit Configuration Files work in Simulator).
2. Navigate to any feature with a ProBadge.
3. Trigger the purchase via `purchasePro()` from `client/lib/purchases.ts`
   (hook up a button once you've wired the IAP library).
4. Complete the sandbox purchase on-device.
5. The app calls `api.validateAppleReceipt()` / `api.validateGooglePurchase()`.
6. The server validates with Apple/Google and sets `subscription_tier = 'pro'`.
7. `useSubscription()` returns `{ isPro: true }`.

---

## Webhook setup

### Apple App Store Server Notifications (V2)

1. In App Store Connect → Your App → App Information → App Store Server
   Notifications, enter:
   - Production URL: `https://yourdomain.com/api/subscriptions/webhooks/apple`
   - Sandbox URL: `https://yourdomain.com/api/subscriptions/webhooks/apple`
2. Apple sends a JWS-signed payload (`signedPayload`). The current implementation
   decodes it without signature verification (safe for sandbox).
3. **Before going to production**, add full JWS verification:
   - Download Apple's root certificate from
     https://www.apple.com/certificateauthority/
   - Verify the certificate chain in the JWS header against Apple's root CA.
   - Only then trust the decoded payload.
   - See `server/controllers/subscriptionController.ts → appleWebhook` for the
     TODO comment.

### Google Play Real-time Developer Notifications

1. In Google Play Console → Monetize → Monetization setup, enable
   Real-time developer notifications.
2. Create a Cloud Pub/Sub topic and subscription with push endpoint:
   `https://yourdomain.com/api/subscriptions/webhooks/google?token=YOUR_GOOGLE_PUBSUB_TOKEN`
3. Set `GOOGLE_PUBSUB_TOKEN` on the server to `YOUR_GOOGLE_PUBSUB_TOKEN`.
   The server rejects requests without this token.

---

## Connecting real products for production

Once sandbox testing is complete and you want to charge real users:

1. Submit your iOS app for App Review with the subscription product included.
   Apple requires a screenshot of the subscription management UI.
2. Activate the Google subscription product in Play Console.
3. Remove the sandbox / test account requirement and submit an update.
4. No code changes needed — the same env vars and endpoints work for production.
   The Apple receipt validation code automatically retries against the production
   endpoint (status 21007 detection is already implemented).

---

## Files created / modified

| File | Role |
|---|---|
| `server/db.ts` | Added `migrateSubscriptions()` — adds columns to `users` table and creates `subscription_receipts` table |
| `server/models/index.ts` | Added `SubscriptionTier`, `SubscriptionProvider`, `SubscriptionStatus`, updated `User` / `PublicUser` interfaces |
| `server/services/subscriptionService.ts` | DB read/write helpers for subscription status and receipts |
| `server/services/appleReceiptService.ts` | Calls Apple verifyReceipt API |
| `server/services/googlePlayService.ts` | Calls Google Play Developer API (uses Node `crypto` for JWT, no extra deps) |
| `server/controllers/subscriptionController.ts` | Route handlers for status, validate, and both webhooks |
| `server/routes/subscriptions.ts` | Express router — mounts the 5 subscription endpoints |
| `server/routes/index.ts` | Registers `/api/subscriptions` router |
| `server/services/authService.ts` | `toPublicUser` now includes subscription fields |
| `client/lib/subscriptionConfig.ts` | Master feature flag + product ID config (reads env vars) |
| `client/lib/purchases.ts` | StoreKit / Play Billing purchase flow scaffold with TODO stubs |
| `client/lib/api.ts` | Added `getSubscriptionStatus`, `validateAppleReceipt`, `validateGooglePurchase` |
| `client/hooks/useSubscription.ts` | React hook — returns `{ isPro, isEnabled, isLoading, ... }` |
| `client/components/ProBadge.tsx` | "Coming soon" banner shown on Pro-destined features |
| `client/pages/Progress.tsx` | ProBadge added to MuscleBalanceChart and ExerciseProgressDetail |
| `SUBSCRIPTIONS.md` | This file |
