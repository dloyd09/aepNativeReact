# App Optimization Plan

> Compiled from architectural review on 2026-03-25.
> Context: WeRetail CMT Bootcamp — instructor-led session, students configure their own Adobe Launch mobile tag property and generate data through the app into their own AEP instance.

---

## Curriculum Flow (Dependency Chain)

Each step is a prerequisite for the next. The app must support this chain clearly.

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

## Deferred — Dedicated Session

| # | Item | Reason Deferred |
|---|---|---|
| D1 | **Dual push notification stack** — `@react-native-firebase/messaging` + `expo-notifications` running simultaneously | Requires deeper restructure, warrants its own session |

---

## Group 1 — Setup View Enhancements

> Highest value for bootcamp curriculum. Makes the curriculum dependency chain visible to students and instructors without adding new screens.

### 1.1 Status Indicators on Setup Rows

Add a colored dot/circle to each existing row in `CoreView.tsx`.

| State | Color | Meaning |
|---|---|---|
| Green | ✅ Confirmed working | Value present and valid |
| Red | ❌ Confirmed broken/missing | Value unavailable or invalid |
| Grey | ⚪ Unknown or loading | Not yet fetched |

**Rows and their logic:**

| Row | Green condition | Red condition | Grey condition |
|---|---|---|---|
| Adobe App ID | ID string present | Not configured | Loading |
| MobileCore Version | Version string returned | "Unavailable" | Loading |
| ECID | Non-empty value | "Unavailable" or empty | Loading |
| Consent Collect | `y` | `n` | `unknown` or loading |
| Privacy Status | `optedIn` | `optedOut` | `unknown` |
| Push Token | Token registered | Not registered | Not yet checked |

**Files:** `app/(techScreens)/CoreView.tsx`

---

### 1.2 Push Token Row

Push token is currently not displayed in the Setup view at all. Add it as a new row with status indicator.

- Fetch the current push token from the push notification service on refresh
- Display truncated token value (first/last 8 chars) for readability
- Status: green if token present, red if not registered, grey on load

**Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/pushNotifications.ts`

---

### 1.3 Instructor Reset Button

Add a "Reset for New User" button at the bottom of the Setup view. Instructor-facing — allows clearing all state between student sessions without navigating to a separate screen.

**What the reset must clear:**
1. Stored App ID (`AsyncStorage`)
2. Adobe identities — `MobileCore.resetIdentities()` (wipes ECID)
3. Push token — `MobileCore.setPushIdentifier(null)` ← currently missing from existing reset
4. Stored user profile / login state (`userProfile` AsyncStorage key)
5. Consent — reset to default `n`
6. Cached Optimize/Target propositions
7. All Adobe-related AsyncStorage keys

**UX requirement:** Confirmation dialog before firing — easy to accidentally tap during a live session.

**After reset:** All status indicators return to grey, App ID shows "Not configured". Student then navigates to App ID Config to enter their Launch property App ID.

**Note:** The `AppIdConfigView` already has a reset that covers most of this but does not clear the push token. The Setup view reset should be the canonical, complete version.

**Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/adobeConfig.ts`

---

## Group 2 — SDK Initialization

> Fixes the root cause of the Sarah/Tom class of issue — SDK not ready when students attempt step 3.

### 2.1 SDK Readiness Signal

Currently `isAdobeConfigured()` only checks if an App ID string exists in AsyncStorage. It says nothing about whether the SDK has actually finished initializing or whether ECID has been generated.

**Problem:** Screens race against initialization. A student can reach the profile login screen before `configureAdobe()` has completed.

**Recommendation:** Introduce a shared readiness state (context or lightweight store) that tracks:
- `idle` — no App ID configured
- `initializing` — `configureAdobe()` in progress
- `ready` — initialization complete, ECID available
- `error` — initialization failed

Screens that depend on the SDK (Profile, Decisioning, Offers) can read this state and show appropriate UI rather than silently failing.

**Files:** `app/_layout.tsx`, `src/utils/adobeConfig.ts`, new context or hook

---

### 2.2 Prevent `configureAdobe()` Being Called Multiple Times

`configureAdobe()` → `MobileCore.initializeWithAppId()` can be called from:
- `_layout.tsx` on startup
- `AppIdConfigView` on mount (loading saved App ID)
- `AppIdConfigView` when user taps Save

Calling `initializeWithAppId()` multiple times in one session has undefined behavior and can cause duplicate lifecycle events or extension registration conflicts.

**Recommendation:** Add a guard — if SDK is already initialized with the same App ID, skip re-initialization. Only re-run if App ID has changed.

**Files:** `app/_layout.tsx`, `app/(techScreens)/AppIdConfigView.tsx`, `src/utils/adobeConfig.ts`

---

### 2.3 Fix Log Level Override

`_layout.tsx` sets `LogLevel.VERBOSE` before calling `configureAdobe()`. `configureAdobe()` immediately resets it to `LogLevel.ERROR` on its first line.

Net result: verbose logging is always suppressed after init, which hurts debuggability exactly when it's needed most — during first-launch issues.

**Recommendation:** Remove the `setLogLevel(LogLevel.ERROR)` call from inside `configureAdobe()`. Let the caller control the log level. For bootcamp, VERBOSE is appropriate.

**Files:** `src/utils/adobeConfig.ts`, `app/_layout.tsx`

---

## Group 3 — Profile / Login / Logout

> Real code bugs that affect all new users. Not timing-dependent — reproducible regardless of SDK init speed.

### 3.1 `setLoggedIn(true)` Fires Before ECID Is Populated

In `handleLogin`, `setLoggedIn(true)` is called on line 131 — immediately switching the UI to the logged-in welcome view. ECID and identityMap are populated much later after several awaits complete (lines 184–186).

**Symptom:** Student sees "Welcome, [Name]!" with blank ECID and empty identity map. Appears broken even when it will resolve correctly.

**Recommendation:** Move `setLoggedIn(true)` to after the async chain completes, or show a loading state during login processing.

**Files:** `app/(consumerTabs)/profile.tsx`

---

### 3.2 ECID Silently Skipped If Not Available at Login Time

```typescript
const currentEcid = ecid || await Identity.getExperienceCloudId();
if (currentEcid) {
  newIdentityMap.addItem(ecidIdentity, 'ECID');  // silently skipped if null
}
```

If the SDK hasn't generated an ECID yet, `currentEcid` is null and the ECID is never added to the identity map. Login events and all subsequent events go out with email only — no ECID. This does not self-correct until the app is restarted.

**Recommendation:** If ECID is unavailable at login time, surface a clear error or delay login until ECID is confirmed present. Do not silently omit it.

**Files:** `app/(consumerTabs)/profile.tsx`

---

### 3.3 Logout Has No Visual Feedback

`handleLogout` awaits `Edge.sendEvent()` (a network call) before setting `setLoggedIn(false)`. The button appears frozen for 1–3 seconds. Students tap multiple times thinking it didn't register.

**Recommendation:** Add a loading/disabled state to the logout button that activates immediately on tap, before the async chain starts.

**Files:** `app/(consumerTabs)/profile.tsx`

---

### 3.4 Profile Restore Does Not Re-Fetch Identity

When the app reopens and restores a saved session from AsyncStorage, the restore `useEffect` sets `loggedIn`, `firstName`, and `email` — but does not call `refreshIdentityState()`. ECID and identityMap are only populated if the separate identity `useEffect` resolves before the profile restore renders.

**Recommendation:** Call `refreshIdentityState()` inside the profile restore `useEffect` to ensure ECID and identityMap are always in sync when a session is restored.

**Files:** `app/(consumerTabs)/profile.tsx`, `hooks/useProfileStorage.js`

---

## Group 4 — Push Logging

> Observability improvements for bootcamp push curriculum (steps 4–6). Designed to work within the existing push stack without restructuring it (that is deferred to D1).

### 4.1 Push Token Acquisition Logging

Log when the push token is obtained:
- Token value (truncated for security)
- Which layer provided it (Firebase vs APNs direct)
- Timestamp relative to SDK init

**Files:** `src/utils/pushNotifications.ts`

---

### 4.2 Token → ECID Association Logging

The most critical push logging gap. Log at the moment `MobileCore.setPushIdentifier()` is called:
- Was ECID present at that moment?
- If not, the token is registered without an identity — AJO cannot deliver to this device

This directly surfaces the timing problem where push token registers before ECID is ready.

**Files:** `src/utils/pushNotifications.ts`

---

### 4.3 Inbound Push Receipt Logging

Log when a push notification is received:
- Foreground vs background
- Payload shape and key fields (`adb_uri`, `adb_deeplink`, message ID)

**Files:** `src/utils/pushNotifications.ts`, `app/_layout.tsx`

---

### 4.4 Push Interaction Logging

Log user interaction with push notifications:
- Tap (open)
- Dismiss
- Action button tapped

**Files:** `app/_layout.tsx`

---

### 4.5 Push Tracking Event Confirmation

Log whether the open/impression tracking event was successfully sent back to Edge Network after a push interaction. Currently a push can appear to work (notification displayed, tapped) but the tracking event fails silently.

**Files:** `app/_layout.tsx`, `src/utils/pushNotifications.ts`

---

## Group 5 — Cleanup

### 5.1 Remove CampaignClassic

`@adobe/react-native-aepcampaignclassic` is installed in `package.json` but has no corresponding extension in the student tag property and does not appear to be used in the active consumer or tech screens.

**Action:** Remove from `package.json` and any unused imports.

**Files:** `package.json`

---

## Summary

| Group | Items | Priority | Scope |
|---|---|---|---|
| 1 — Setup View | 1.1, 1.2, 1.3 | High — curriculum facing | CoreView.tsx |
| 2 — SDK Init | 2.1, 2.2, 2.3 | High — root cause of login issues | adobeConfig.ts, _layout.tsx |
| 3 — Profile | 3.1, 3.2, 3.3, 3.4 | High — affects all new users | profile.tsx |
| 4 — Push Logging | 4.1, 4.2, 4.3, 4.4, 4.5 | Medium — push curriculum support | pushNotifications.ts |
| 5 — Cleanup | 5.1 | Low | package.json |
| D1 — Push Stack | Deferred | Dedicated session | — |

**Total: 17 items active, 1 deferred.**
