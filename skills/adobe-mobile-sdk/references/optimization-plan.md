# App Optimization Plan
> Canonical source: `docs/App-Optimization-Plan.md`
> Compiled 2026-03-25. Updated with full codebase audit 2026-03-26.
> Context: WeRetail CMT Bootcamp — students configure their own Adobe Launch mobile tag property and generate data through the app into their own AEP instance.

---

## Governance Tiers

| Tier | Meaning | Prioritize when |
|---|---|---|
| 🔴 Learning Loop | Directly breaks or enables the configure → run → observe cycle | Always first |
| 🟡 Real-World Fidelity | Absent or wrong patterns mislead learners about production behavior | After 🔴 items |
| 🟢 Clarity | Noise or confusion that distracts from learning without breaking anything | After 🟡 items |
| ⚪ Stability | Maintenance/cleanup with no direct curriculum impact | Last |

---

## Curriculum Flow (Dependency Chain)

```
1. App ID configured + tag property published with extensions
        ↓
2. Assurance connection verified
        ↓
3. Profile login → ECID confirmed
        ↓
4. Push token generated
        ↓
5. Self-send push test (confirm end-to-end delivery)
        ↓
6. AJO Journey sends to device
```

---

## Deferred

| # | Item | Reason |
|---|---|---|
| D1 | **Dual push notification stack** — `@react-native-firebase/messaging` + `expo-notifications` running simultaneously | Requires deeper restructure, dedicated session |

---

## Group 1 — Setup View Enhancements 🔴

### 1.2 Push Token Row *(implement first)*
- Fetch token from `pushNotificationService.getExpoPushToken()` on refresh
- Display truncated token (first 8 + last 8 chars)
- Status: green if real token, red if not registered or mock (see 9.3), grey on load
- **Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/pushNotifications.ts`

### 1.1 Status Indicators on Setup Rows *(after 1.2)*
Colored dot on each row: green = valid, red = missing/broken, grey = loading.

| Row | Green | Red | Grey |
|---|---|---|---|
| Adobe App ID | ID present | Not configured | Loading |
| MobileCore Version | Version returned | "Unavailable" | Loading |
| ECID | Non-empty | "Unavailable" or empty | Loading |
| Consent Collect | `y` | `n` | `unknown` or loading |
| Privacy Status | `optedIn` | `optedOut` | `unknown` |
| Push Token | Real token | Not registered or mock | Not yet checked |

- **Files:** `app/(techScreens)/CoreView.tsx`

### 1.3 Instructor Reset Button
Clears: App ID, `MobileCore.resetIdentities()`, `MobileCore.setPushIdentifier('')`, `clearPendingToken()` (requires 4.6), user profile, consent → `n`, Optimize propositions, all Adobe AsyncStorage keys. Requires confirmation dialog.
- **Dependency:** After 4.6
- **Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/adobeConfig.ts`, `src/utils/pushNotifications.ts`

---

## Group 2 — SDK Initialization

### 2.1 SDK Readiness Signal 🔴
Shared readiness state: `idle` → `initializing` → `ready` → `error`. Screens gate on `ready` before sending events.
- **Files:** `app/_layout.tsx`, `src/utils/adobeConfig.ts`, new context or hook

### 2.2 Prevent `configureAdobe()` Being Called Multiple Times 🟡
Guard against `initializeWithAppId()` called with same App ID more than once per session.
- **Files:** `app/_layout.tsx`, `app/(techScreens)/AppIdConfigView.tsx`, `src/utils/adobeConfig.ts`

### 2.3 Fix Log Level Override 🟢
Remove `setLogLevel(LogLevel.ERROR)` from inside `configureAdobe()` — silently overrides VERBOSE set by caller.
- **Files:** `src/utils/adobeConfig.ts`, `app/_layout.tsx`

---

## Group 3 — Profile / Login / Logout

### 3.2 ECID Silently Skipped If Not Available at Login Time 🔴
Block login button until ECID confirmed. 10-second timeout with warning. Use readiness context from 2.1 if available.
- **Files:** `app/(consumerTabs)/profile.tsx`

### 3.4 Profile Restore Does Not Re-Fetch Identity 🔴
Call `refreshIdentityState()` inside profile restore `useEffect`.
- **Files:** `app/(consumerTabs)/profile.tsx`, `hooks/useProfileStorage.js`

### 3.1 `setLoggedIn(true)` Fires Before ECID Is Populated 🟢
Move `setLoggedIn(true)` to after async chain completes.
- **Files:** `app/(consumerTabs)/profile.tsx`

### 3.3 Logout Has No Visual Feedback 🟢
Add loading/disabled state to logout button on tap.
- **Files:** `app/(consumerTabs)/profile.tsx`

---

## Group 4 — Push Fixes and Logging

> **Root cause confirmed (2026-03-26):** 4 of 5 iOS TestFlight users did not receive pushes — token registered without ECID.

### 4.2 + 4.6 ECID Guard and Retry — Single Implementation Unit 🔴
> Must be implemented together.

**4.2:** Before `setPushIdentifier`, fetch ECID. If null: log warning, store as `pendingPushToken`, return. If present: register and log.

**4.6:** `retryPendingPushToken()` + `clearPendingToken()` on push service. Call retry from end of `configureAdobe()` and after successful login. `clearAdobePushTokens()` must also call `clearPendingToken()`.
- **Files:** `src/utils/pushNotifications.ts`, `src/utils/adobeConfig.ts`, `app/(consumerTabs)/profile.tsx`

### 4.7 iOS APNs Token Refresh Listener 🟡
Register `Notifications.addPushTokenListener()` on iOS after permission granted. Mirror 4.2 ECID guard. Store subscription ref (see 9.2).
- **Files:** `src/utils/pushNotifications.ts`

### 4.5 Push Tracking Event Confirmation 🟡
Log whether open/impression tracking event was sent to Edge Network.
- **Files:** `app/_layout.tsx`, `src/utils/pushNotifications.ts`

### 4.1 Push Token Acquisition Logging 🟢
Log token value (truncated), source layer, timestamp relative to SDK init.
- **Files:** `src/utils/pushNotifications.ts`

### 4.3 Inbound Push Receipt Logging 🟢
Log foreground/background receipt, payload key fields.
- **Files:** `src/utils/pushNotifications.ts`, `app/_layout.tsx`

### 4.4 Push Interaction Logging 🟢
Log tap, dismiss, action button.
- **Files:** `app/_layout.tsx`

---

## Group 5 — Cleanup

### 5.1 Remove CampaignClassic ⚪
Remove `@adobe/react-native-aepcampaignclassic` — unused.
- **Files:** `package.json`

### 5.2 Remove Unused `Messaging` Import in Push Service ⚪
Remove unused `import { Messaging }` at line 4 of `pushNotifications.ts`.
- **Files:** `src/utils/pushNotifications.ts`

### 5.3 Implement `runtimeDiagnostics.ts` ⚪
After 2.1: expose diagnostic snapshot (readiness state, ECID, push token, App ID). Do not implement before 2.1.
- **Files:** `src/utils/runtimeDiagnostics.ts`, `src/utils/adobeConfig.ts`

### 5.4 Add Inline Explanation to EdgeBridgeView 🟢
Explain what EdgeBridge does, why it's idle here, what to activate in a legacy Analytics migration.
- **Files:** `app/(techScreens)/EdgeBridgeView.tsx`

---

## Group 6 — Event Coverage

### 6.3 Consent Toggle in Consumer View 🔴
Add consent toggle in consumer profile tab. `Consent.update({ collect: { val: 'n' } })`. Students observe blocking in Assurance.
- **Files:** `app/(consumerTabs)/profile.tsx` or new `app/(consumerTabs)/preferences.tsx`

### 6.1 Add Browse/Category Page Product List View Events 🟡
Fire `buildPageViewEvent()` with `commerce.productListViews` on product listing screens.
- **Files:** Consumer product listing screens, `src/utils/xdmEventBuilders.ts`

### 6.2 Verify Product Detail `commerce.productViews` Event 🟡
Audit all product detail screens — confirm `buildProductViewEvent()` fires on focus with correct payload.
- **Files:** Consumer product detail screens

---

## Group 7 — Tech Screen Accuracy

### 7.2 Remove IdentityView from Drawer 🟡
Remove from drawer in `_layout.tsx` — uses deprecated MobileCore Identity APIs. Keep file, don't navigate to it.
- **Files:** `app/_layout.tsx`

### 7.1 Remove Content Cards Placeholder from MessagingView 🟢
Remove Content Cards UI section — API not functional in current extension version.
- **Files:** `app/(techScreens)/MessagingView.tsx`

---

## Group 8 — Cold Start & Storage Hardening

> Found in full codebase audit 2026-03-26. Cross-platform issues affecting every student on first open.

### 8.1 `useProfileStorage` Missing `isLoading` State 🔴
Hook never exposes whether AsyncStorage load is in progress. On cold start, home/cart/checkout render with empty profile (100–300ms), causing empty-identity XDM events in Assurance.

**Fix:** Add `isProfileLoading` boolean: `true` on mount, `false` in `finally`. Screens guard `useFocusEffect` XDM sends with `if (isProfileLoading) return;`
- **Files:** `hooks/useProfileStorage.js`, `app/(consumerTabs)/home.tsx`, `app/(consumerTabs)/cart.tsx`, `app/(consumerTabs)/Checkout.tsx`

### 8.2 Scattered Direct AsyncStorage Reads for User Profile 🟡
home.tsx, cart.tsx, Checkout.tsx each call `AsyncStorage.getItem('userProfile')` directly inside `useFocusEffect` — bypassing the hook, reading from disk 3–4x per navigation cycle. Schema changes require 5+ edits.

**Fix:** Remove all direct reads. Use `profile` from hook exclusively.
- **Files:** `app/(consumerTabs)/home.tsx`, `app/(consumerTabs)/cart.tsx`, `app/(consumerTabs)/Checkout.tsx`

### 8.3 Unguarded `JSON.parse()` on AsyncStorage Values 🟢
Corrupted storage entries throw silently and default to empty object.

**Fix:** `safeParseJSON(value, fallback)` utility with logging on parse failure.
- **Files:** `hooks/useProfileStorage.js`, consumer screens

---

## Group 9 — Push Notification Lifecycle

> Found in full codebase audit 2026-03-26. Compounds confirmed TestFlight push failures from 4.2+4.6.

### 9.1 FCM Init Flags Set Before Setup Completes 🔴
`fcmMessageHandlingInitialized` and `fcmTokenRefreshListenerInitialized` are set `true` at the **start** of their setup methods. If setup throws, flags stay `true` — permanently blocks retry.

**Fix:** Set flag to `true` only after all setup succeeds. Reset to `false` in catch.
- **Files:** `src/utils/pushNotifications.ts`

### 9.2 Push Token Listener Has No Cleanup Path 🟡
`Notifications.addPushTokenListener()` (from 4.7) is never removed. Re-initializing the service (instructor reset) attaches a second listener — token rotation fires registration twice.

**Fix:** Store subscription as private field. `cleanup()` calls `subscription.remove()`. Called at start of `initialize()` and from `clearAdobePushTokens()`.
- **Files:** `src/utils/pushNotifications.ts`

### 9.3 Status Indicator Must Distinguish Mock Tokens 🟢
`getExpoPushToken()` returns mock tokens. Item 1.2 must call `isMockToken()` — mock = red ("Simulator — not registered with Adobe"), real = green.

**Dependency:** Implement as part of 1.2.
- **Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/pushNotifications.ts`

---

## Group 10 — Async Safety

> Found in full codebase audit 2026-03-26.

### 10.1 `Identity.getIdentities()` in Checkout Has No Error Handler 🔴
Called in `useEffect` on mount. No `.catch()`. On cold start SDK not ready → unhandled rejection → Checkout crashes.

**Fix:** `.catch(err => console.warn('[Checkout] Identity.getIdentities() failed on mount:', err))` — leave identityMap as empty default.
- **Files:** `app/(consumerTabs)/Checkout.tsx`

### 10.2 `UserProfile.updateUserAttributes()` Is Not Awaited 🟡
Fire-and-forget in profile.tsx. Silent failures. User Profile event may never appear in Assurance while Identity event does.

**Fix:** `await` with try-catch and failure log.
- **Files:** `app/(consumerTabs)/profile.tsx`

### 10.3 1000ms Magic Timeout Is the Only SDK Readiness Gate 🟡
`setTimeout(resolve, 1000)` in `adobeConfig.ts` is the sole readiness check. On slow devices or cold start with network latency, 1 second is not enough — extension calls after it run against an uninitialized SDK.

**Interim fix:** Poll `MobileCore.extensionVersion()` up to 5x with 300ms backoff.
**Full fix (requires 2.1):** Remove timeout, use readiness context.
- **Files:** `src/utils/adobeConfig.ts`

### 10.4 Hardcoded 100ms Delays in Deep Link Handlers 🟢
Two `setTimeout(..., 100)` in `_layout.tsx` for navigation after push tap and in-app message URL. Too short on slow devices.

**Fix:** Replace with `InteractionManager.runAfterInteractions(() => { /* navigate */ })`.
- **Files:** `app/_layout.tsx`

---

## Group 11 — Navigation & Timer Safety

> Found in full codebase audit 2026-03-26.

### 11.1 Cart Navigates to Checkout Even When Edge Event Fails 🟡
`router.navigate('Checkout')` in both success path and catch block. Students can reach Checkout with no `commerce.checkouts` event in Assurance.

**Fix:** Navigation only in success path. Catch block shows error state, keeps student on cart.
- **Files:** `app/(consumerTabs)/cart.tsx`

### 11.2 Checkout `setTimeout` Has No Cleanup Reference 🟢
`setTimeout(..., 3000)` for navigation after purchase. No `clearTimeout` on unmount — fires stale state setter and unexpected navigation if student leaves early.

**Fix:** `useRef` for timer ID, clear in `useEffect` cleanup.
- **Files:** `app/(consumerTabs)/Checkout.tsx`

---

## Summary Table

| Group | 🔴 Loop | 🟡 Fidelity | 🟢 Clarity | ⚪ Stability |
|---|---|---|---|---|
| 1 — Setup View | 1.1, 1.2, 1.3 | — | — | — |
| 2 — SDK Init | 2.1 | 2.2 | 2.3 | — |
| 3 — Profile | 3.2, 3.4 | — | 3.1, 3.3 | — |
| 4 — Push | 4.2+4.6 | 4.7, 4.5 | 4.1, 4.3, 4.4 | — |
| 5 — Cleanup | — | — | 5.4 | 5.1, 5.2, 5.3 |
| 6 — Event Coverage | 6.3 | 6.1, 6.2 | — | — |
| 7 — Tech Screens | — | 7.2 | 7.1 | — |
| 8 — Cold Start & Storage | 8.1 | 8.2 | 8.3 | — |
| 9 — Push Lifecycle | 9.1 | 9.2 | 9.3 | — |
| 10 — Async Safety | 10.1 | 10.2, 10.3 | 10.4 | — |
| 11 — Navigation & Timers | — | 11.1 | 11.2 | — |
| D1 — Push Stack | Deferred | | | |

**Total: 42 items active, 1 deferred.**

## Governance-Prioritized Implementation Order

| Order | Items | Tier | Rationale |
|---|---|---|---|
| 1 | 4.2+4.6 | 🔴 | Confirmed production failure — 4/5 iOS push failures in TestFlight |
| 2 | 9.1 | 🔴 | FCM flag race permanently blocks push retry after any setup failure |
| 3 | 8.1 | 🔴 | Cold start: blank identity causes empty XDM events on every new session |
| 4 | 10.1 | 🔴 | Checkout crashes on cold start — unhandled Identity rejection |
| 5 | 1.1, 1.2, 1.3 | 🔴 | Dependency chain visibility |
| 6 | 2.1 | 🔴 | SDK race condition breaks step 3 |
| 7 | 3.2, 3.4 | 🔴 | Silent ECID omission corrupts identity chain |
| 8 | 6.3 | 🔴 | Consent curriculum has zero demo path |
| 9 | 4.7, 4.5, 6.1, 6.2, 7.2, 2.2, 8.2, 10.2, 10.3, 11.1 | 🟡 | Real-world fidelity gaps |
| 10 | 2.3, 3.1, 3.3, 4.1, 4.3, 4.4, 5.4, 7.1, 8.3, 9.2, 9.3, 10.4, 11.2 | 🟢 | Clarity improvements |
| 11 | 5.1, 5.2, 5.3 | ⚪ | Cleanup |
