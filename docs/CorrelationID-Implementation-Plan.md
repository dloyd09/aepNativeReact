# AJO Correlation ID — Implementation Plan

**Status:** ✅ IMPLEMENTED & VALIDATED 2026-05-29 (foreground + warm-background paths). See `docs/Push-Tracking-Path-Separation.md`.
**Backlog reference:** App-Optimization-Plan.md item 4.8
**Schema:** `davidMobileInteractions` — `_experience.decisioning.propositions[].scopeDetails.correlationID` (String, field group: Experience Event - Proposition Interactions)
**Schema status:** Field already present in `davidMobileInteractions`. No schema changes needed.

> ## Implementation outcome (2026-05-29)
>
> **The payload-key guesses in this plan were wrong.** The correlationID is **not** a flat key
> (`adb_correlation_id` / `_adobe.correlationid` / `adobe_correlation_id`). On Android/FCM, AJO embeds it
> **nested inside the `_xdm` value**, which is itself a **JSON string** in the notification `data`:
>
> ```
> data._xdm  (JSON string)
>   └─ mixins._experience.decisioning.propositions[0].scopeDetails.correlationID
> ```
>
> The real AJO messageID lives in the same `_xdm` string at
> `mixins._experience.customerJourneyManagement.messageExecution.messageID` (carries the `-N` suffix, e.g.
> `48fe8cfa-…-0`). The flat keys remain as fallbacks only. The handler parses `_xdm` tolerantly (string **or**
> already-parsed object) via `safeParseJSON`.
>
> **Validated in Assurance:** `pushTracking.applicationOpened` events from foreground/warm-background AJO taps
> carry the correlationID at the expected path + the real `-N` messageID + the full `_adobecmteas` block.
> Tracking is now **gated on a real `_xdm`/messageID**, so local-test pushes no longer fabricate bare-UUID
> open events (the prior pollution source).
>
> **Out of scope / deferred:** killed-state push *delivery* (data-only message shows nothing in the tray when
> the app is swipe-killed) — a separate D1 dual-stack problem, not a correlationID gap. See the D1 row in
> `App-Optimization-Plan.md`.

---

## Context

When AJO sends a push notification, it embeds a `correlationID` in the notification data payload. This string identifies the specific campaign or journey execution that triggered the message. The app must echo it back in the push tracking event at `_experience.decisioning.propositions[0].scopeDetails.correlationID` so AJO can close the loop between "message sent" and "user opened."

On the WebSDK this is handled automatically. On mobile it must be done manually — which is the gap this plan addresses.

**Why it matters:** Without the correlationID in the push tracking event, AJO journey reporting cannot match open/interact events back to the originating campaign execution. Open rate metrics, journey re-entry suppression, and frequency capping are all silently incorrect.

---

## Current state

### Push tracking — fully missing

`buildPushTrackingEvent` in `src/utils/xdmEventBuilders.ts:1118` sends a valid XDM event but has no `_experience.decisioning` block. The correlationID from the push payload is never read and never sent.

`app/_layout.tsx:145` extracts these fields from the push notification data payload:
```
adobe_message_id  →  pushProviderMessageID
adb_n_id          →  pushProviderMessageID (fallback)
adb_uri           →  deep link navigation
```
No correlationID key is read.

### Proposition display/interact tracking — handled

`trackDecisioningItemDisplay` and `trackDecisioningItemInteraction` in `src/utils/decisioningItems.ts` spread `item.proposition.scopeDetails` into the XDM payload. Since AJO includes `correlationID` in the `scopeDetails` of the Edge response for code-based experiences, the field is carried through automatically on that path. No change needed there.

---

## Pre-implementation: confirm the payload key name

Before writing any code, confirm the exact key AJO uses to embed the correlationID in the push notification data payload. This is not clearly documented for React Native and must be verified empirically.

**Steps:**
1. Open an Assurance session
2. Trigger an AJO push from an active journey (not a test send — use the journey that goes to device)
3. Tap the notification to trigger the response listener
4. Check the `console.log('Full notification object:', ...)` output at `_layout.tsx:143`
5. Look for a key in `data` that contains a UUID-format string not matching `adobe_message_id`

**Likely candidates** (in order of probability):
| Key | Notes |
|---|---|
| `adb_correlation_id` | Flat key — most common in AJO FCM payloads |
| `_adobe.correlationid` | Nested — seen in some APNs configurations |
| `adobe_correlation_id` | Alternative flat key |

Confirm on **both Android and iOS** — the key can differ by platform.

---

## Implementation

All changes implement together in one commit. Do not implement step 3 before step 2, as `buildPushTrackingEvent` must accept `correlationID` before `_layout.tsx` can pass it.

### Step 1 — Add correlationID to `PushTrackingEventParams`

**File:** `src/utils/xdmEventBuilders.ts`

Add optional `correlationID` field to the `PushTrackingEventParams` interface:

```ts
interface PushTrackingEventParams extends BaseEventParams {
  pushProvider: 'apns' | 'fcm';
  pushProviderMessageID: string;
  interaction: 'opened' | 'customAction';
  actionID?: string;
  correlationID?: string;
}
```

### Step 2 — Include correlationID in the XDM payload

**File:** `src/utils/xdmEventBuilders.ts`

In `buildPushTrackingEvent`, after the `pushNotificationTracking` block, add the `_experience.decisioning` block conditionally:

```ts
const xdmData: any = {
  _id: eventId,
  eventType: params.interaction === 'opened'
    ? 'pushTracking.applicationOpened'
    : 'pushTracking.customAction',
  timestamp: new Date().toISOString(),
  identityMap: params.identityMap,
  _adobecmteas: tenantData,
  environment: buildEnvironment(),
  pushNotificationTracking: {
    pushProvider: params.pushProvider,
    pushProviderMessageID: params.pushProviderMessageID,
    ...(params.interaction === 'customAction' && params.actionID
      ? { customAction: { actionID: params.actionID } }
      : {})
  }
};

if (params.correlationID) {
  xdmData._experience = {
    decisioning: {
      propositions: [{
        scopeDetails: {
          correlationID: params.correlationID
        }
      }]
    }
  };
}
```

The conditional guard ensures that if AJO does not include a correlationID in the payload (test sends, non-AJO pushes), the block is omitted entirely rather than sending an empty or null value.

### Step 3 — Extract correlationID in the notification handler

**File:** `app/_layout.tsx`

In the notification response listener (around line 145), after extracting `data`, read the correlationID using the key confirmed in the pre-implementation step. Example using the most likely key:

```ts
const data = response.notification.request.content.data;

const correlationID =
  (data as any)?.adb_correlation_id ||
  (data as any)?._adobe?.correlationid ||
  undefined;
```

Pass it to `buildPushTrackingEvent`:

```ts
const trackingEvent = await buildPushTrackingEvent({
  identityMap,
  pushProvider: Platform.OS === 'ios' ? 'apns' : 'fcm',
  pushProviderMessageID:
    (data as any)?.adobe_message_id ||
    (data as any)?.adb_n_id ||
    response.notification.request.identifier,
  interaction: isOpen ? 'opened' : 'customAction',
  correlationID,
  ...(!isOpen && { actionID: actionIdentifier }),
});
```

Add a log line after extracting it so Assurance sessions can confirm it was read:

```ts
logStartup('[4.8] correlationID extracted from push payload', {
  present: Boolean(correlationID),
  value: correlationID ?? 'not found',
});
```

---

## Validation

### Assurance checklist

After implementation, trigger a fresh AJO push and tap it. In Assurance, verify the `pushTracking.applicationOpened` event:

| Check | Expected |
|---|---|
| Event type | `pushTracking.applicationOpened` |
| `pushNotificationTracking.pushProviderMessageID` | Matches AJO message ID |
| `_experience.decisioning.propositions[0].scopeDetails.correlationID` | Non-empty string (UUID format) |
| `_adobecmteas` tenant block | Present (loginStatus, visitorType, channel) |
| `identityMap` | Present with ECID |

If `correlationID` is absent in the Assurance event after the fix:
1. Check the log line added in step 3 — if it shows `present: false`, the key name is wrong
2. Re-run the key discovery step with the raw notification object log
3. Update the extraction line in `_layout.tsx` with the correct key

### AJO journey reporting check

After a successful validated send, open the AJO journey live view. The push open count should increment and reflect the correct message ID. If open rates were previously 0% for AJO-sourced pushes despite confirmed deliveries, this fix is the likely root cause.

---

## Files changed

| File | Change |
|---|---|
| `src/utils/xdmEventBuilders.ts` | Add `correlationID?: string` to `PushTrackingEventParams`; add conditional `_experience.decisioning` block in `buildPushTrackingEvent` |
| `app/_layout.tsx` | Extract correlationID from push payload data; pass to `buildPushTrackingEvent` |

No schema changes. No new dependencies.

---

## Out of scope

- Proposition display/interact tracking — correlationID is already carried via `...item.proposition.scopeDetails` spread in `decisioningItems.ts`. No change needed.
- In-app message tracking — handled by the AEP Messaging SDK natively.
- The missing `_adobecmteas` / `identityMap` / `environment` fields in the `decisioningItems.ts` manual fallback path — that is a separate schema shape gap, not related to correlationID.
