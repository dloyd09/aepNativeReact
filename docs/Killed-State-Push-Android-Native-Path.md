# Killed-State Android Push — Decision: Solve in Native Code, Not RN JS

**Status:** DEFERRED — no fix attempted in RN JS. Revisit as a native-code task (see D1 in `docs/App-Optimization-Plan.md`).
**Date:** 2026-05-29
**Platforms affected:** Android only (iOS killed-state works — see "Why iOS is fine" below).
**Related:** `docs/Push-Tracking-Path-Separation.md`, `docs/Push-Notification-Gap-Analysis.md`, `docs/App-Optimization-Plan.md` (D1)

---

## Decision (TL;DR)

**Do not try to fix Android killed-state push by making the JavaScript handler more clever.**
When the app is swipe-killed on Android, a data-only AJO push currently shows **nothing** in the tray.
The correct fix is **native Android code** using Adobe's documented push path, not a smarter RN/JS
workaround. This is deferred to a dedicated native session.

---

## The symptom

| App state (Android) | Tray notification on AJO push? |
|---|---|
| Foreground | ✅ shows |
| Warm background (process alive) | ✅ shows |
| **Killed / swipe-removed (process dead)** | ❌ **nothing shows** |

Because nothing displays when killed, there is also nothing to tap, so cold-start open tracking
never fires either. Foreground and warm-background paths (display + correlationID tracking) are
implemented and validated — see `docs/Push-Tracking-Path-Separation.md`.

---

## Root cause (confirmed)

AJO sends **data-only** FCM messages on Android (no `notification` block) so the Adobe SDK can own
rich rendering + delivery/open tracking. A data-only message is **never auto-displayed by the OS** —
app/SDK code must post the tray notification.

This app posts that notification from JavaScript:
- `messaging().onMessage(...)` — foreground (JS alive) ✅
- `messaging().setBackgroundMessageHandler(...)` — background/killed

…but `setBackgroundMessageHandler` is registered **lazily inside a React-lifecycle method**
(`setupFCMMessageHandling()` in `src/utils/pushNotifications.ts`), which only runs **after the React
tree mounts**. When the app is killed, FCM wakes it as a **headless JS task** that evaluates only the
entry bundle (`main` = `expo-router/entry`) — the React tree never mounts, so the handler is never
registered, the message is dropped, and the tray stays empty.

There is **no custom native `FirebaseMessagingService`** and **no `AEPMessagingService` hook** in the
Android project today — all push display is JS + `expo-notifications`.

---

## Why the fix must be native, not RN JS

Adobe's own guidance points to native code:

- **Adobe React Native Messaging** docs state that **push notification handling must be implemented in
  native Android/iOS code** — the RN layer does not bridge Android push display/tracking.
- **Adobe Android push** docs describe the recommended path as a native `FirebaseMessagingService`
  calling **`AEPMessagingService.handleRemoteMessage(context, remoteMessage)`**, which **automatically
  displays the notification and records delivery/interaction tracking**. Manual display/tracking is
  documented only as the alternative for specific custom needs.
- **Firebase Android** docs are consistent: anything beyond simple auto-displayed background delivery
  goes through a service extending `FirebaseMessagingService`. That service is **native and the OS
  starts it even when the app is killed** — which is exactly the guarantee the JS headless task does
  not reliably provide for display.

In other words: data-only push is *normally fine* in Camp B (data-only + manual display) **because
Adobe ships a killed-safe native handler for it**. The breakage here is not Adobe's payload choice —
it is that this RN app reimplemented display in JS and never wired Adobe's native handler. Making the
JS handler "survive the kill" (e.g. moving `setBackgroundMessageHandler` to a top-level `index.js`)
might get the handler to *fire*, but display would still run through `expo-notifications` from inside
an RNFirebase headless task — a dual-stack seam that is not designed to work and is the reason this is
deferred rather than patched.

### Why Camp A (let the OS auto-display) is not an option

A `notification`-block message auto-displays when backgrounded/killed **without running any app/SDK
code**, so Adobe would lose: (1) delivery/display measurement, (2) rich template rendering (image,
buttons), and (3) its own tap/dismiss tracking `PendingIntent`. Adobe therefore sends data-only by
design. See `docs/Push-Tracking-Path-Separation.md` for the full Camp A vs Camp B discussion.

### Why iOS is fine (do not "fix" iOS)

iOS AJO push is a visible APNs `alert` payload with `mutable-content`. iOS **auto-displays it even when
killed**, and a Notification Service Extension adds images + tracking. Display and measurement coexist
on iOS, so iOS killed-state already works. This gap is Android-only.

---

## The native solution (when we revisit)

Adobe-aligned, automatic display + tracking:

1. Add a native `FirebaseMessagingService` to the Android project (e.g. in
   `android/app/src/main/java/com/cmtBootCamp/AEPSampleAppNewArchEnabled/`), registered in
   `AndroidManifest.xml`.
2. In `onMessageReceived`, delegate to Adobe:

   ```kotlin
   override fun onMessageReceived(remoteMessage: RemoteMessage) {
       // Adobe handles display + delivery/interaction tracking for AJO messages.
       if (!AEPMessagingService.handleRemoteMessage(this, remoteMessage)) {
           // Not an Adobe message — fall back to app's own handling if needed.
       }
   }
   ```
3. Keep `MobileCore.setPushIdentifier(token)` as-is (token registration is already fixed — see
   `docs/Push-Notification-Gap-Analysis.md` Gap 1).

This runs natively, so it works in **all** app states including killed, with no headless-JS fragility.

### Integration caveat — avoid double-counting tracking

If `AEPMessagingService.handleRemoteMessage` is adopted, it records push display + interaction
tracking **automatically**. The current **JS-side manual tracking** (`buildPushTrackingEvent` +
`Edge.sendEvent` in `app/_layout.tsx`, gated on `_xdm`) would then overlap for natively-displayed
pushes and could double-count opens. The native session must decide the single source of truth for
tracking — most likely: native handles display + tracking, and the JS manual path is removed or scoped
to local-test only. This is a coordinated change, not an additive one — another reason it is its own
session.

---

## Explicitly NOT the plan

- ❌ Moving `setBackgroundMessageHandler` to `index.js` and keeping `expo-notifications` display.
  (Closes the registration bug but leaves the dual-stack headless-display risk unproven, and is still
  off Adobe's recommended integration.)
- ❌ Making the JS background handler "smarter."
- ❌ Switching AJO to notification-block messages (loses Adobe tracking + rich rendering).

---

## Files involved when implemented

| File | Change |
|---|---|
| `android/app/src/main/java/.../*MessagingService.kt` (new) | Native `FirebaseMessagingService` → `AEPMessagingService.handleRemoteMessage` |
| `android/app/src/main/AndroidManifest.xml` | Register the service |
| `src/utils/pushNotifications.ts` | Remove/relocate the lazy `setBackgroundMessageHandler`; reconcile with native display |
| `app/_layout.tsx` | Reconcile manual JS tracking with native auto-tracking (avoid double-count) |

> Touches must-not-break files and native project files. Run `/governance-check` before implementing.
