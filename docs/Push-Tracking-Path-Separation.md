# Push Tracking — Local Test Path vs. Real AJO Path Separation

**Status:** IMPLEMENTED 2026-05-29 (governance: Proceed with conditions — all met; `tsc --noEmit` clean, no new lint errors). Pending on-device validation (see "Validation" below).
**Date:** 2026-05-29
**Related:** `docs/CorrelationID-Implementation-Plan.md`, `docs/Push-Notification-Gap-Analysis.md`
**Files involved:** `app/_layout.tsx`, `src/utils/pushNotifications.ts`, `app/(techScreens)/PushNotificationView.tsx`

---

## The original question

"Is the AJO `correlationID` being sent back to Adobe when a push is opened?"

Triggered an AJO push (correlationID `dc854e41-c53c-4c9c-8d23-4890d4dedf5a-0`), confirmed it displays
on device, but `pushTracking.applicationOpened` events were never confirmed in Assurance with the
correlationID attached.

---

## What we found (root cause)

The correlationID extraction → `buildPushTrackingEvent` → `Edge.sendEvent` chain is **correctly written**.
The problem is that the tap handler that runs it **rarely or never fires**, and when it does it can send
**junk** events. Three layered issues:

### 1. The tap handler doesn't fire for the realistic case

Push-open tracking lives entirely in the single `addNotificationResponseReceivedListener` in
`app/_layout.tsx`. There is **no cold-start handling** (`getLastNotificationResponseAsync` /
`useLastNotificationResponse` are absent) and the Android background path is a no-op (below).

The AJO push is **data-only** (the FCM `remoteMessage` has `data` but no `notification` block). On Android:

| App state | Display path | Tap → tracking? |
|---|---|---|
| **Foreground** | `onMessage` (JS) → `scheduleLocalNotification` (expo local notification) — the only display path today | Tapping a foreground heads-up banner does **not** reliably emit a `NotificationResponse` (app is already open). **No tracking.** ← the observed symptom: no Metro log on tap |
| **Background (warm)** | `onMessage` does not fire; `setBackgroundMessageHandler` (`pushNotifications.ts:566`) is a **no-op that only logs**; default Firebase service won't auto-display data-only → **nothing shows** | nothing to tap |
| **Killed (cold)** | same no-op; no cold-start handler | tap silently dropped |

Net effect: the only notifications the user can tap are foreground ones, and foreground taps are the one
case Android won't reliably deliver to the listener.

### 2. The local test path and the real AJO path are conflated

`scheduleLocalNotification` is a dumb "display a banner now" primitive with **two callers**, and one tap
handler treats them identically:

```
                    scheduleLocalNotification  ← shared primitive (keep)
                       ▲                  ▲
   test button ────────┘                  └──────── real AJO foreground push
   (no _xdm,                                        (carries real _xdm +
    source:'technical-push-test')                    correlationID)
                       │                  │
                       └──────┬───────────┘
                              ▼
              _layout.tsx tap handler treats BOTH the same:
              extract correlationID → send pushTracking to Adobe
```

- Test button: `app/(techScreens)/PushNotificationView.tsx:126` `triggerLocalPushTest` →
  `scheduleLocalNotification(...)` with `TEST_PUSH_PAYLOAD` (no `_xdm`, has `source: 'technical-push-test'`).
- Real AJO foreground: `src/utils/pushNotifications.ts:541` routes the real push through the **same** clone.

### 3. The conflation pollutes Adobe with bogus open events

When the **test** push is tapped, the handler still calls `buildPushTrackingEvent` → `Edge.sendEvent`.
There's no `_xdm`, so:
- `correlationID` is empty, and
- `pushProviderMessageID` falls back to the **local notification UUID** (`response.notification.request.identifier`).

This is the source of the junk `pushTracking.applicationOpened` events seen in Assurance with bare-UUID
message IDs (`5619418f-…`, `20ab8a36-…`) and no correlationID. The test crutch has been writing fake opens
into Adobe.

### Why the local clone exists at all (context)

`scheduleLocalNotification` was added as a testing crutch (to validate app-side push handling while
debugging profile issues, independent of Adobe). It is legitimate and we are **keeping it** — but it must
be cleanly separated from the real Adobe path. See "the function is a workaround" discussion: FCM does not
auto-display in the foreground, so the app fabricates a *local* notification to mirror the push. That clone
gets an expo-generated identifier, severing the link to the real FCM/AJO `messageID`.

---

## The solution: two intents, one primitive

Keep `scheduleLocalNotification` as-is (just "render a banner"). Split **what a tap means** based on origin.

### Primary guard — gate Edge tracking on a real `_xdm`

> **Only send a `pushTracking` event to Adobe when the tapped notification carries a real `_xdm`
> (or a real AJO `messageID`). Otherwise it is local-only: display + deep-link, never touch Edge.**

The test payload never has `_xdm`; a real AJO push always does. This single guard in the
`_layout.tsx` tap handler:
- walls off the test path from Adobe, and
- eliminates the fabricated-messageID junk events (no real message ⇒ nothing to attribute, so don't invent one).

### Belt-and-suspenders — stamp origin explicitly

- Test button → keep/standardize a marker (e.g. `_origin: 'local-test'`; today it's `source: 'technical-push-test'`).
- Real foreground mirror → `onMessage` stamps `_origin: 'ajo-foreground'` when it schedules.
- Tap handler logs which branch it took, so a bootcamp learner can see
  "test tap → Adobe tracking suppressed" vs. "AJO tap → correlationID sent."

### Reliability fixes — apply ONLY to the AJO branch

1. **Background display:** make `setBackgroundMessageHandler` (`pushNotifications.ts:566`) schedule the
   mirror notification, so backgrounded data-only AJO pushes actually display *and* become tappable expo
   notifications (a tray tap from warm background **does** fire `addNotificationResponseReceivedListener`).
2. **Cold-start capture:** call `Notifications.getLastNotificationResponseAsync()` at startup in
   `_layout.tsx` and run the same correlationID extraction + `buildPushTrackingEvent` + `Edge.sendEvent`
   logic, so a tap that launches the app from killed also tracks.
3. The test button needs none of this — foreground-only is fine for a capability check.

> **Status note (2026-05-29):** Foreground and warm-background AJO taps are implemented and validated
> end-to-end (correlationID + real `-N` messageID confirmed in Assurance; `_xdm` arrives as a JSON string).
> The **killed-state** path (#1/#2 above) is **confirmed broken and NOT solved here** — when the app is
> swipe-killed, a data-only AJO push shows **nothing in the tray**, so there is no notification to tap and
> cold-start capture never fires. Root cause: `setBackgroundMessageHandler` is registered lazily inside
> `setupFCMMessageHandling()` (after Adobe init), but RNFirebase requires it at the **app entry top-level**
> so the headless JS task spawned for a killed-app delivery has it registered. The fix (register the handler
> in a new `index.js` ahead of `expo-router/entry`) touches the entry point and is **deferred to the D1
> dual-stack session** — see `docs/App-Optimization-Plan.md` D1.

### Resulting mental model

| Path | Displays via | On tap |
|---|---|---|
| **Local test** (button) | foreground only | deep-link parse + log; **never** calls Edge |
| **Real AJO push** | foreground mirror + (new) background mirror + cold-start catch | extract `_xdm` → correlationID → `Edge.sendEvent` |

---

## Defensive note carried over from earlier investigation

The `_xdm` value in the payload is a JSON **string** (`safeParseJSON` handles strings only). If expo ever
delivers it as an already-parsed **object** at tap time, `JSON.parse(object)` throws and silently yields
`null`. When implementing, make the read tolerate both:

```ts
const rawXdm = (data as any)?._xdm;
const parsedXdm =
  typeof rawXdm === 'string'
    ? safeParseJSON<any>(rawXdm, null, '[4.8] _xdm parse')
    : (rawXdm ?? null);
```

Add a `logStartup('[4.8] _xdm raw type', { type: typeof rawXdm })` so the next test is unambiguous.

---

## Already fixed in this investigation (do not redo)

`scripts/assurance-fetch.js` `getSessionEvents` had an inverted pagination assumption. The Assurance API
paginates **newest-first** (verified: page 0 = most recent), but the comment said "oldest-first" and the
sliding window kept the **oldest** `maxEvents`, silently discarding the most recent data once a session
exceeded 1000 events. Fixed to walk pages from the start, stop once `maxEvents` is collected, keep the newest,
and return chronological order. This is why earlier Assurance pulls appeared to "miss" today's events.

---

## Files to change (when implemented)

| File | Change |
|---|---|
| `app/_layout.tsx` | Gate `buildPushTrackingEvent`/`Edge.sendEvent` on real `_xdm` presence; branch on origin; add cold-start handling via `getLastNotificationResponseAsync`; tolerant `_xdm` parse + raw-type log |
| `src/utils/pushNotifications.ts` | Implement `setBackgroundMessageHandler` to schedule the mirror; stamp `_origin` on the real foreground mirror |
| `app/(techScreens)/PushNotificationView.tsx` | Stamp `_origin: 'local-test'` (or standardize the existing `source` marker) on the test payload |

## Validation (after implementation)

1. Tap a **test** push → no `pushTracking` event reaches Edge; Metro logs "test tap — Adobe tracking suppressed."
2. Background the app, trigger a real AJO push, tap from tray → `pushTracking.applicationOpened` event in
   Assurance carries `_experience.decisioning.propositions[0].scopeDetails.correlationID` = the AJO correlationID,
   and `pushProviderMessageID` = the real AJO `messageID` (with `-N` suffix), NOT a bare UUID.
3. Kill the app, trigger a real AJO push, tap from tray → same tracking event fires on next launch.

## Governance

Touches must-not-break files (`app/_layout.tsx`, `src/utils/pushNotifications.ts`). Run `/governance-check`
before implementing.
