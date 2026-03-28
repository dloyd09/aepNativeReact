# App Optimization Plan

> Compiled from architectural review on 2026-03-25. Governance framework applied 2026-03-26.
> Context: WeRetail CMT Bootcamp — instructor-led session, students configure their own Adobe Launch mobile tag property and generate data through the app into their own AEP instance.

---

## Governance Tiers

Each item is tagged with its primary governance tier. Implement in tier order within each session.

| Tier | Meaning | Prioritize when |
|---|---|---|
| 🔴 Learning Loop | Directly breaks or enables the configure → run → observe cycle | Always first |
| 🟡 Real-World Fidelity | Absent or wrong patterns mislead learners about production behavior | After 🔴 items |
| 🟢 Clarity | Noise or confusion that distracts from learning without breaking anything | After 🟡 items |
| ⚪ Stability | Maintenance/cleanup with no direct curriculum impact | Last |

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

> 🔴 Learning Loop — all three items. Makes the curriculum dependency chain visible and resettable.
> Highest value for bootcamp curriculum. Makes the curriculum dependency chain visible to students and instructors without adding new screens.
>
> **Implementation order within this group:** 1.2 must be done before 1.1 — 1.1 adds status indicators to existing rows including the Push Token row, which 1.2 creates.

### 1.2 Push Token Row *(implement first)*

Push token is currently not displayed in the Setup view at all. Add it as a new row with status indicator.

- Fetch the current push token from `pushNotificationService.getExpoPushToken()` on refresh
- Display truncated token value (first 8 + last 8 chars) for readability
- Status: green if real token present, red if not registered or mock token, grey on load

**Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/pushNotifications.ts`

---

### 1.1 Status Indicators on Setup Rows *(implement after 1.2)*

Add a colored dot/circle to each row in `CoreView.tsx`, including the Push Token row added by 1.2.

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
| Push Token | Real token present | Not registered or mock token | Not yet checked |

**Files:** `app/(techScreens)/CoreView.tsx`

---

### 1.3 Instructor Reset Button

Add a "Reset for New User" button at the bottom of the Setup view. Instructor-facing — allows clearing all state between student sessions without navigating to a separate screen.

**What the reset must clear:**
1. Stored App ID (`AsyncStorage`)
2. Adobe identities — `MobileCore.resetIdentities()` (wipes ECID)
3. Push token — `MobileCore.setPushIdentifier('')` ← use empty string, not null
4. `pendingPushToken` in push service — call `pushNotificationService.clearPendingToken()` (added by item 4.6; ensure 4.6 is implemented first)
5. Stored user profile / login state (`userProfile` AsyncStorage key)
6. Consent — reset to default `n`
7. Cached Optimize/Target propositions
8. All Adobe-related AsyncStorage keys

**UX requirement:** Confirmation dialog before firing — easy to accidentally tap during a live session.

**After reset:** All status indicators return to grey, App ID shows "Not configured". Student then navigates to App ID Config to enter their Launch property App ID.

**Dependency:** Implement after 4.6 so that `pendingPushToken` clearing is available. The `AppIdConfigView` reset is not the canonical version — this button is.

**Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/adobeConfig.ts`, `src/utils/pushNotifications.ts`

---

## Group 2 — SDK Initialization

> 🔴 Learning Loop: 2.1. 🟡 Real-World Fidelity: 2.2. 🟢 Clarity: 2.3.
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

> 🔴 Learning Loop: 3.2, 3.4 — ECID silently missing breaks identity chain. 🟢 Clarity: 3.1, 3.3.
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

**Recommendation:** Block the login button with a "SDK initializing…" state until ECID is confirmed present. Do not silently omit it and do not allow login to proceed without ECID.

**Fallback:** If ECID has not appeared after 10 seconds, unblock the login button and show a warning: "Adobe SDK may not be fully initialized. Check your App ID configuration." This prevents a permanent dead-end if SDK init has failed silently.

**Dependency:** If item 2.1 (SDK Readiness Signal) is implemented first, use the `ready` state from the readiness context to gate the login button — this is cleaner than polling `Identity.getExperienceCloudId()` directly in the profile screen. If 2.1 is not yet done, poll directly with a 10-second timeout.

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

## Group 4 — Push Fixes and Logging

> 🔴 Learning Loop: 4.2, 4.6 — confirmed production failure, steps 4→6 broken. 🟡 Real-World Fidelity: 4.7, 4.5. 🟢 Clarity: 4.1, 4.3, 4.4.
> Code fixes and observability improvements for bootcamp push curriculum (steps 4–6). Designed to work within the existing push stack without restructuring it (that is deferred to D1).
>
> **Root cause confirmed (2026-03-26):** In the bootcamp TestFlight group, 4 of 5 iOS users did not receive Adobe-sent pushes despite being on the same build. All use production APNs (TestFlight). The failure pattern matches token registration succeeding without ECID being present — Adobe stores the token but cannot associate it to a profile, so journeys bounce silently. Items 4.2 and 4.6 are the direct fix.

### 4.2 + 4.6 ECID Guard and Retry — Single Implementation Unit 🔴 *(code fix + logging)*

> **These two items must be implemented together in the same session.** 4.2 alone defers token registration but provides no resolution path — tokens stay permanently unregistered until the next app launch. 4.6 is the completion of 4.2.

**Problem (4.2):** `registerTokenWithAdobe()` calls `MobileCore.setPushIdentifier(token)` without checking whether an ECID exists at that moment. If the SDK hasn't generated an ECID yet — which happens when a user opens the app, grants notification permissions, and obtains a token before `configureAdobe()` has completed — the token lands in Adobe with no profile association. AJO cannot deliver to that device and the failure is silent.

**Fix (4.2):**
1. Before calling `setPushIdentifier`, fetch ECID via `Identity.getExperienceCloudId()`.
2. If ECID is null or empty:
   - Log a clear warning: `"Push token obtained but ECID not yet available — deferring Adobe registration"`.
   - Store the token in memory as `pendingPushToken`.
   - Do **not** call `setPushIdentifier` yet.
3. If ECID is present, proceed normally and log: `"ECID confirmed present — registering push token with Adobe"`.

**Fix (4.6):**
1. Add `retryPendingPushToken()` to the push service: checks `pendingPushToken`, fetches ECID, registers if ECID is now present, clears the pending value.
2. Add `clearPendingToken()` public method so the instructor reset (item 1.3) can clear it.
3. Call `retryPendingPushToken()` from:
   - End of `configureAdobe()` in `src/utils/adobeConfig.ts`
   - After successful login in `app/(consumerTabs)/profile.tsx`
4. `clearAdobePushTokens()` must also call `clearPendingToken()` — otherwise a reset followed by a new ECID re-registers the old pre-reset token.

**Files:** `src/utils/pushNotifications.ts`, `src/utils/adobeConfig.ts`, `app/(consumerTabs)/profile.tsx`

---

### 4.7 iOS APNs Token Refresh Listener 🟡 *(code fix)*

**Problem:** Android handles FCM token rotation via `firebaseMessaging().onTokenRefresh()`, which re-registers the updated token with Adobe automatically. iOS has no equivalent listener set up — if APNs rotates the device token while the app is running, Adobe is never notified and subsequent journey sends will bounce.

`expo-notifications` provides `Notifications.addPushTokenListener()` for this purpose, but it is not used anywhere in the push service.

**Fix:** In `initialize()`, after confirming permission is granted on iOS, register a `Notifications.addPushTokenListener()` callback that calls `registerTokenWithAdobe()` with the new token. Mirror the same guard pattern from 4.2 (ECID check before registering).

**Files:** `src/utils/pushNotifications.ts`

---

### 4.5 Push Tracking Event Confirmation 🟡

Log whether the open/impression tracking event was successfully sent back to Edge Network after a push interaction. Currently a push can appear to work (notification displayed, tapped) but the tracking event fails silently.

**Files:** `app/_layout.tsx`, `src/utils/pushNotifications.ts`

---

### 4.1 Push Token Acquisition Logging 🟢

Log when the push token is obtained:
- Token value (truncated for security)
- Which layer provided it (Firebase vs APNs direct)
- Timestamp relative to SDK init

**Files:** `src/utils/pushNotifications.ts`

---

### 4.3 Inbound Push Receipt Logging 🟢

Log when a push notification is received:
- Foreground vs background
- Payload shape and key fields (`adb_uri`, `adb_deeplink`, message ID)

**Files:** `src/utils/pushNotifications.ts`, `app/_layout.tsx`

---

### 4.4 Push Interaction Logging 🟢

Log user interaction with push notifications:
- Tap (open)
- Dismiss
- Action button tapped

**Files:** `app/_layout.tsx`

---

## Group 5 — Cleanup

> 🟢 Clarity: 5.4. ⚪ Stability: 5.1, 5.2, 5.3.

### 5.1 Remove CampaignClassic

`@adobe/react-native-aepcampaignclassic` is installed in `package.json` but has no corresponding extension in the student tag property and does not appear to be used in the active consumer or tech screens.

**Action:** Remove from `package.json` and any unused imports.

**Files:** `package.json`

---

### 5.2 Remove Unused `Messaging` Import in Push Service

`import { Messaging } from '@adobe/react-native-aepmessaging'` at line 4 of `pushNotifications.ts` is never referenced in the file.

**Action:** Remove the import.

**Files:** `src/utils/pushNotifications.ts`

---

### 5.3 Implement `runtimeDiagnostics.ts` as SDK Readiness Surface

`src/utils/runtimeDiagnostics.ts` exists but is an empty stub. Leaving it empty implies functionality that isn't there — a governance violation ("every feature should reduce cognitive load, not add to it").

**Action:** After item 2.1 (SDK Readiness Signal) is implemented, use `runtimeDiagnostics.ts` to expose a simple diagnostic snapshot: current readiness state, ECID present/absent, push token present/absent, App ID configured/not. This turns the stub into a genuine utility used by the status indicators in 1.1 and potentially by Assurance debugging flows.

Do not implement this before 2.1 — it has nothing useful to surface without the readiness context.

**Files:** `src/utils/runtimeDiagnostics.ts`, `src/utils/adobeConfig.ts`

---

### 5.4 Add Inline Explanation to EdgeBridgeView

`@adobe/react-native-aepedgebridge` is registered as an extension but is unused — the tech screen shows only the version number with no explanation. This creates confusion: students see a screen and assume they should configure something there.

**Action:** Keep the extension and the screen — EdgeBridge is a real pattern students will encounter when migrating existing Analytics implementations to Edge. Add a clear explanation at the top of `EdgeBridgeView.tsx`:
- What EdgeBridge does (bridges legacy `Analytics.trackAction/trackState` calls to Edge Network without rewriting them)
- Why it is registered but idle in this app (this app uses native Edge XDM events directly — EdgeBridge is shown here as a reference for migration projects)
- What a student would do to activate it in a legacy Analytics context

This satisfies governance principle 3 ("Teach by doing, document by being") — the screen becomes a teaching reference rather than dead UI.

**Files:** `app/(techScreens)/EdgeBridgeView.tsx`

---

## Group 6 — Event Coverage

> 🔴 Learning Loop: 6.3 — consent has no demo path at all. 🟡 Real-World Fidelity: 6.1, 6.2 — incomplete funnel breaks AJO journey qualification.
> Closes gaps in the XDM event taxonomy. The commerce funnel is well covered from cart onward, but the top of the funnel (browsing) is invisible to AEP. These items make the app demonstrably complete as an ecommerce data source.

### 6.1 Add Browse/Category Page Product List View Events

`commerce.productListViews` is currently only sent on the cart page view. It should fire when a student navigates to a product category or product listing screen — this is the standard Adobe Commerce event for browsing behavior.

**What to add:**
- Fire `buildPageViewEvent()` with `commerce.productListViews` and the product list on any screen that displays a grid or list of products (category pages, search results if added).
- This event is already built in `xdmEventBuilders.ts` — it just needs to be called in the right screens.

**Impact:** Without this, AJO journeys that qualify on browse behavior (e.g., "browsed Men's but didn't buy") have no signal to work with. Students cannot demonstrate browse-triggered personalization.

**Files:** Consumer product listing/category screens, `src/utils/xdmEventBuilders.ts`

---

### 6.2 Verify Product Detail `commerce.productViews` Event

The `buildProductViewEvent()` builder exists in `xdmEventBuilders.ts`, but it is not confirmed whether product detail screens call it consistently. A missing product view event breaks browse → product → cart attribution chains in CJA and AJO.

**Action:** Audit every screen that renders a single product detail view and confirm `buildProductViewEvent()` is called with the correct `productListItems` payload on screen focus.

**Files:** Consumer product detail screens

---

### 6.3 Consent Toggle in Consumer View

> **Decision (2026-03-26): Do not implement.** Consent remains hardcoded to `"y"` in `adobeConfig.ts`.
> A student accidentally tapping "Deny" would silently kill all Edge events for their session —
> the failure mode is invisible and takes the rest of the bootcamp to diagnose.
> The consent curriculum concept is covered in the tech view (ConsentView); it does not need
> a consumer-facing toggle in the bootcamp context.

---

## Group 7 — Tech Screen Accuracy

> 🟡 Real-World Fidelity: 7.2 — teaches wrong identity pattern. 🟢 Clarity: 7.1 — broken UI misleads students.
> Removes misleading or broken UI elements from tech screens. In a bootcamp context, a non-functional screen is worse than no screen — students will spend time debugging something that simply does not work.

### 7.1 Remove Content Cards Placeholder from MessagingView

`MessagingView.tsx` contains a visible Content Cards section. The Content Cards API (`Messaging.setContentCardDelegate()`) is prepared in code but is not functional in the current Messaging extension version. Students who attempt to use this will see no output and assume their AJO configuration is wrong.

**Action:** Remove the Content Cards UI section entirely from `MessagingView.tsx`. Re-add it when the API is confirmed stable in a future extension release.

**Files:** `app/(techScreens)/MessagingView.tsx`

---

### 7.2 Remove IdentityView from Drawer

`IdentityView.tsx` uses the deprecated `MobileCore` Identity APIs (`syncIdentifier`, `syncIdentifiers`, `getIdentifiers`). These are not the APIs students should use — the correct modern pattern is Edge Identity (`@adobe/react-native-aepedgeidentity`), which already has its own screen (`EdgeIdentityView.tsx`).

**Action:** Remove `IdentityView` from the drawer in `_layout.tsx`. Keep the file in the codebase as a non-navigable reference, but do not surface it as an active screen.

**Rationale:** Governance principle 1 — "reduce cognitive load, not add to it." A visible screen using deprecated APIs trains students on the wrong pattern. `EdgeIdentityView.tsx` already covers the correct path. There is no pedagogical benefit to showing both. Removing from the drawer (not deleting the file) preserves the code as a reference without putting it in the learning path.

**Files:** `app/_layout.tsx`

---

---

## Group 8 — Cold Start & Storage Hardening

> 🔴 Learning Loop: 8.1 — screens render with blank identity on every cold start. 🟡 Real-World Fidelity: 8.2. 🟢 Clarity: 8.3.
> Found in full codebase audit (2026-03-26). These are cross-platform issues that affect every student on first open.

### 8.1 `useProfileStorage` Missing `isLoading` State 🔴

`hooks/useProfileStorage.js` loads the saved profile from AsyncStorage in a `useEffect` with an empty dependency array — correct — but it never exposes whether that load is still in progress. The hook returns `{ profile, setProfile }` only.

**Problem:** `home.tsx`, `cart.tsx`, and `Checkout.tsx` all read `profile` immediately on mount. On cold start, AsyncStorage hasn't resolved yet, so every screen that derives identity state from the profile (email, firstName) renders with empty values for 100–300ms. Students see blank XDM events in Assurance during that window if any screen sends an event on focus before the load completes.

**Fix:** Add `isProfileLoading` boolean to the hook. Set it `true` on mount, `false` in the `finally` block of `loadProfile`. Expose it in the return value. Screens should guard their `useFocusEffect` XDM sends with `if (isProfileLoading) return;` to prevent empty-identity events.

**Files:** `hooks/useProfileStorage.js`, `app/(consumerTabs)/home.tsx`, `app/(consumerTabs)/cart.tsx`, `app/(consumerTabs)/Checkout.tsx`

---

### 8.2 Scattered Direct AsyncStorage Reads for User Profile 🟡

`home.tsx` (line 83), `cart.tsx` (line 103), and `Checkout.tsx` (lines 79, 139) each call `AsyncStorage.getItem('userProfile')` directly inside `useFocusEffect` or event handlers — bypassing the `useProfileStorage` hook entirely. This means:
- The same key is read from disk 3–4 times per navigation cycle
- Any change to the storage key name or schema must be updated in 5+ places
- No shared loading state means screens can race each other on cold start

**Fix:** Remove all direct `AsyncStorage.getItem('userProfile')` calls from consumer screens. These screens already have access to `profile` from the hook via props or a shared state mechanism. Pass `profile` down or use the hook's return value where the direct reads are happening.

**Files:** `app/(consumerTabs)/home.tsx`, `app/(consumerTabs)/cart.tsx`, `app/(consumerTabs)/Checkout.tsx`

---

### 8.3 Unguarded `JSON.parse()` on AsyncStorage Values 🟢

All direct `AsyncStorage.getItem()` calls across consumer screens call `JSON.parse()` on the stored string without a try-catch or structure validation. If AsyncStorage returns a non-JSON string (corrupted entry, schema migration remnant), the parse throws and the component catches it silently, defaulting to an empty object. The silent failure masks the real error.

**Fix:** Wrap `JSON.parse()` in a utility function `safeParseJSON(value, fallback)` that catches parse errors, logs them with context, and returns the fallback. Use it everywhere AsyncStorage values are parsed.

**Files:** `hooks/useProfileStorage.js`, `app/(consumerTabs)/home.tsx`, `app/(consumerTabs)/cart.tsx`, `app/(consumerTabs)/Checkout.tsx`

---

## Group 9 — Push Notification Lifecycle

> 🔴 Learning Loop: 9.1 — permanently blocks push retry after a setup failure. 🟡 Real-World Fidelity: 9.2. 🟢 Clarity: 9.3.
> Found in full codebase audit (2026-03-26). These compound the confirmed TestFlight push failures from items 4.2+4.6.

### 9.1 FCM Init Flags Set Before Setup Completes 🔴

In `pushNotifications.ts`, two singleton guard flags are set to `true` **before** the initialization code runs inside their respective methods:

- `fcmMessageHandlingInitialized = true` is set at the start of `setupFCMMessageHandling()` (line 405). If any subsequent setup call throws, the flag stays `true`. The next call to `setupFCMMessageHandling()` sees the flag and returns early — permanently skipping setup.
- `fcmTokenRefreshListenerInitialized = true` has the same pattern in `setupFCMTokenRefreshHandling()` (line 471).

**Impact:** A student who opens the app in an environment where Firebase initializes slowly (cold start on a slow Android device) may silently skip FCM message handling — push notifications arrive but are never processed.

**Fix:** Set the flag to `true` only **after** setup completes successfully. In the catch block, reset the flag to `false` so the next call can retry.

```typescript
// Correct pattern
try {
  // ... all setup code ...
  this.fcmMessageHandlingInitialized = true; // Set LAST, only on success
} catch (error) {
  this.fcmMessageHandlingInitialized = false; // Ensure retry is possible
  console.error('[Push] FCM message handling setup failed:', error);
}
```

**Files:** `src/utils/pushNotifications.ts`

---

### 9.2 Push Token Listener Has No Cleanup Path 🟡

Plan item 4.7 adds `Notifications.addPushTokenListener()` for iOS token rotation. That listener is a subscription that must be removed when the service is reset — otherwise re-initializing the push service (e.g., after the instructor reset from item 1.3) attaches a second listener, and token rotation fires the registration callback twice.

**Fix:** Store the subscription reference as a private field on the push service singleton. Add a `cleanup()` method that calls `subscription.remove()`. Call `cleanup()` at the start of `initialize()` before re-attaching, and from `clearAdobePushTokens()`.

**Files:** `src/utils/pushNotifications.ts`

---

### 9.3 Status Indicator Must Distinguish Mock Tokens 🟢

Plan item 1.2 adds a Push Token row to CoreView with a green/red/grey status. `getExpoPushToken()` returns whatever token is stored — including mock tokens (`MockToken_*`, `AndroidMockToken_*`) generated when Firebase is unavailable on a simulator.

**Fix:** The status indicator logic in 1.2 must call `isMockToken()` (or equivalent check) after retrieving the token. A mock token should display as **red** (not green), with a label: `"Simulator — not registered with Adobe"`. A real token is green. This prevents students on simulators from thinking push is configured when it isn't.

**Dependency:** Implement as part of item 1.2, not separately.

**Files:** `app/(techScreens)/CoreView.tsx`, `src/utils/pushNotifications.ts`

---

## Group 10 — Async Safety

> 🔴 Learning Loop: 10.1 — Checkout crash on cold start. 🟡 Real-World Fidelity: 10.2, 10.3. 🟢 Clarity: 10.4.
> Found in full codebase audit (2026-03-26). These are async error handling gaps that produce silent failures or crashes.

### 10.1 `Identity.getIdentities()` in Checkout Has No Error Handler 🔴

`Checkout.tsx` calls `Identity.getIdentities()` in a `useEffect` with an empty dependency array (runs on mount). There is no `.catch()` and no try-catch. On cold start, if the SDK hasn't finished initializing — which is exactly the race condition that items 2.1 and 3.2 address — this call throws an unhandled promise rejection that crashes the Checkout component.

**Fix:** Wrap in try-catch. If it throws, log a warning and leave `identityMap` as the empty default — the `useFocusEffect` that sends the page view already guards on `identityMap` presence, so this is safe.

```typescript
useEffect(() => {
  Identity.getIdentities()
    .then(result => { /* existing logic */ })
    .catch(err => console.warn('[Checkout] Identity.getIdentities() failed on mount:', err));
}, []);
```

**Files:** `app/(consumerTabs)/Checkout.tsx`

---

### 10.2 `UserProfile.updateUserAttributes()` Is Not Awaited 🟡

`profile.tsx` calls `UserProfile.updateUserAttributes(attributes)` without `await` (fire-and-forget). If this call fails — network issue, SDK not ready — the failure is silent. More importantly, `UserProfile` attribute state in AEP falls out of sync with what the app believes it has sent. Students watching Assurance will see the `Identity.updateIdentities()` event fire but the User Profile event may never appear, and there's no log explaining why.

**Fix:** `await` the call. Add a try-catch with a log on failure. This makes the failure visible in Assurance and teaches students that SDK calls can fail.

**Files:** `app/(consumerTabs)/profile.tsx`

---

### 10.3 1000ms Magic Timeout Is the Only SDK Readiness Gate 🟡

`adobeConfig.ts` uses `new Promise(resolve => setTimeout(resolve, 1000))` as the sole mechanism to wait for Adobe SDK initialization. This is a time-based assumption, not a true readiness check. On slow devices or cold starts with network latency, 1 second is not enough — the extension version calls and consent setup that follow will run against an SDK that hasn't finished registering extensions.

This is the root cause of the "SDK race condition" that item 2.1 addresses. Document it here as a separate item because it needs to be fixed even if 2.1 is not implemented yet.

**Interim fix (implement before 2.1):** Replace the hardcoded timeout with a polling loop that calls `MobileCore.extensionVersion()` and retries up to 5 times with 300ms backoff before proceeding. This doesn't require a new readiness context and works within the existing init flow.

**Full fix (requires 2.1):** Remove the timeout entirely and use the `ready` state from the readiness context.

**Files:** `src/utils/adobeConfig.ts`

---

### 10.4 Hardcoded 100ms Delays in Deep Link Handlers 🟢

`_layout.tsx` has two `setTimeout(..., 100)` calls inside deep link processing:
1. Inside the notification response handler (navigating after a push tap)
2. Inside the in-app message URL handler

100ms is an arbitrary delay added to let the router finish rendering before navigating. On slow devices or when the JS bundle is still hydrating after a cold start, 100ms is not enough. On fast devices it is unnecessary overhead.

**Fix:** Replace with `InteractionManager.runAfterInteractions(() => { /* navigate */ })`. This defers the navigation until all animations and interactions have completed — no magic number, works correctly on all devices.

**Files:** `app/_layout.tsx`

---

## Group 11 — Navigation & Timer Safety

> 🟡 Real-World Fidelity: 11.1 — teaches wrong checkout event pattern. 🟢 Clarity: 11.2.
> Found in full codebase audit (2026-03-26).

### 11.1 Cart Navigates to Checkout Even When Edge Event Fails 🟡

In `cart.tsx`, `router.navigate('Checkout')` (or equivalent) appears in both the success path and the catch block of the checkout button handler. This means a student can reach the Checkout screen even if `buildCheckoutEvent()` or `Edge.sendEvent()` threw an error. They will see no `commerce.checkouts` event in Assurance, but the app proceeds as if it worked.

**Fix:** Navigation to Checkout must only happen in the success path. The catch block should show an error state (e.g., a toast or inline message) and keep the student on the cart screen so they can retry. This is also the correct production e-commerce pattern — don't proceed to checkout if the event pipeline is broken.

**Files:** `app/(consumerTabs)/cart.tsx`

---

### 11.2 Checkout `setTimeout` Has No Cleanup Reference 🟢

`Checkout.tsx` uses `setTimeout(() => { setPurchaseInProgress(false); router.replace('/home'); }, 3000)` inside the payment success handler. If the student navigates away from Checkout before the 3 seconds elapse, the timeout callback fires against an unmounted component — calling `setPurchaseInProgress` (stale state setter) and `router.replace('/home')` (unexpected navigation from the wrong screen).

**Fix:** Store the timeout ID in a `useRef` and clear it in a `useEffect` cleanup function.

```typescript
const purchaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (purchaseTimerRef.current) clearTimeout(purchaseTimerRef.current);
  };
}, []);

// In success handler:
purchaseTimerRef.current = setTimeout(() => {
  setPurchaseInProgress(false);
  router.replace('/home');
}, 3000);
```

**Files:** `app/(consumerTabs)/Checkout.tsx`

---

## Summary

Items are listed in implementation order within each session. Implement 🔴 before 🟡 before 🟢 before ⚪.

| Group | 🔴 Loop | 🟡 Fidelity | 🟢 Clarity | ⚪ Stability | Scope |
|---|---|---|---|---|---|
| 1 — Setup View | 1.1, 1.2, 1.3 | — | — | — | CoreView.tsx |
| 2 — SDK Init | 2.1 | 2.2 | 2.3 | — | adobeConfig.ts, _layout.tsx |
| 3 — Profile | 3.2, 3.4 | — | 3.1, 3.3 | — | profile.tsx |
| 4 — Push Fixes + Logging | 4.2+4.6 (unit) | 4.7, 4.5 | 4.1, 4.3, 4.4 | — | pushNotifications.ts, adobeConfig.ts |
| 5 — Cleanup | — | — | 5.4 | 5.1, 5.2, 5.3 | package.json, EdgeBridgeView.tsx |
| 6 — Event Coverage | 6.3 | 6.1, 6.2 | — | — | consumer screens, xdmEventBuilders.ts |
| 7 — Tech Screen Accuracy | — | 7.2 | 7.1 | — | MessagingView.tsx, IdentityView.tsx |
| 8 — Cold Start & Storage | 8.1 | 8.2 | 8.3 | — | useProfileStorage.js, consumer screens |
| 9 — Push Lifecycle | 9.1 | 9.2 | 9.3 | — | pushNotifications.ts, CoreView.tsx |
| 10 — Async Safety | 10.1 | 10.2, 10.3 | 10.4 | — | Checkout.tsx, adobeConfig.ts, _layout.tsx |
| 11 — Navigation & Timers | — | 11.1 | 11.2 | — | cart.tsx, Checkout.tsx |
| D1 — Push Stack | Deferred | | | | Dedicated session |

**Total: 42 items active, 1 deferred.**

### Implementation order across groups (governance-prioritized)

| Order | Items | Tier | Rationale |
|---|---|---|---|
| 1 | 4.2+4.6 (single unit) | 🔴 | Confirmed production failure — push steps 4→6 broken; must ship together |
| 2 | 9.1 | 🔴 | FCM init flag race permanently blocks push retry after any setup failure |
| 3 | 8.1 | 🔴 | Cold start: blank identity state causes empty XDM events on every new session |
| 4 | 10.1 | 🔴 | Checkout crashes on cold start — unhandled Identity rejection |
| 5 | 1.1, 1.2, 1.3 | 🔴 | Dependency chain visibility — students can't self-diagnose |
| 6 | 2.1 | 🔴 | SDK race condition breaks step 3 for new users |
| 7 | 3.2, 3.4 | 🔴 | Silent ECID omission corrupts identity chain |
| 8 | 6.3 | 🔴 | Consent curriculum has zero demo path |
| 9 | 4.7, 4.5, 6.1, 6.2, 7.2, 2.2, 8.2, 10.2, 10.3, 11.1 | 🟡 | Real-world fidelity gaps |
| 10 | 2.3, 3.1, 3.3, 4.1, 4.3, 4.4, 5.4, 7.1, 8.3, 9.2, 9.3, 10.4, 11.2 | 🟢 | Clarity improvements |
| 11 | 5.1, 5.2, 5.3 | ⚪ | Cleanup |
