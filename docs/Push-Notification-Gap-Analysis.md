# Push Notification Gap Analysis

**Date:** 2026-05-27
**App:** AEP Native React (CMT Bootcamp Demo)
**Confirmed via:** AEP dataset activity, CJA journey sending statistics, datastream configuration review

> **Status update (2026-05-27):** Gap 1 is **resolved**. `registerTokenWithAdobe` now polls ECID inline (bounded, 20 × 500ms = ~10s) instead of deferring with external retry, and pairs every `setPushIdentifier` call with a companion `buildPushRegistrationEvent` carrying `_adobecmteas.identities.ecid` (the davidMobileInteractions schema's primary identity descriptor — OOTB push profile payloads omit it). The `pendingPushToken` / `retryPendingPushToken` / `clearPendingToken` machinery has been removed. Gap 2 (correlationID) is still open — see `docs/CorrelationID-Implementation-Plan.md`.
>
> **Status update (2026-05-29):** Gap 2 is **resolved** for foreground + warm-background AJO taps. The push tracking event now carries `_experience.decisioning.propositions[0].scopeDetails.correlationID` plus the real `-N` messageID, both read from the nested `_xdm` JSON string (the flat-key assumption was wrong). Tracking is gated on a real `_xdm`/messageID so local-test pushes no longer fabricate bare-UUID opens. Confirmed in Assurance. **Remaining:** killed-state data-only push *delivery* (nothing displays when swipe-killed) is a separate D1 dual-stack gap, not a correlationID gap. See `docs/CorrelationID-Implementation-Plan.md` and `docs/Push-Tracking-Path-Separation.md`.

---

## Summary

Two independent gaps prevent AJO push notifications from working end-to-end. The first means most profiles are unreachable by AJO journeys. The second means open/engage events never reach AJO, so journey reporting is blind after delivery.

| Gap | AEP Evidence | Impact | Status |
|---|---|---|---|
| 1. Push token not reaching AJO profile store | AJO Push Profile Dataset: 0 rows | 80% send exclusion rate — profiles targeted but can't be reached | **Fixed 2026-05-27** (bounded ECID poll + companion tenant XDM event) |
| 2. Push open tracking event missing correlationID | AJO Push Tracking Experience Event Dataset: 0 rows across all sandboxes | AJO journey reporting shows zero opens; frequency capping and re-entry suppression silently broken | **Fixed 2026-05-29** (correlationID + real messageID from nested `_xdm`; foreground + warm-background). Killed-state delivery deferred to D1 |

---

## Gap 1 — Push Token Not Reaching the AJO Profile Store

### Evidence

- **AJO Push Profile Dataset** (`ajo_push_profile_dataset`, ID: `67bcdfcc5ff2ee2aee83d8c5`): zero batches, zero records
- **CJA Journey Sending Statistics**: 30 profiles targeted, 24 excluded (80% exclusion rate), only 6 sends — consistent with most profiles having no valid push token registered in AJO

### Expected behavior

When `MobileCore.setPushIdentifier(token)` is called with a valid device token, the SDK sends a push profile event to the Edge Network. The datastream's AJO service routes this to the AJO Push Profile Dataset, creating or updating the push token → ECID mapping AJO needs to target that device.

The datastream has `AJO Push Profile Dataset` set as the Profile Dataset and `Adobe Journey Optimizer` service enabled — the routing configuration is correct.

### Root cause

The ECID guard in `src/utils/pushNotifications.ts:375` correctly defers token registration when ECID is not yet available:

```ts
const ecid = await Identity.getExperienceCloudId();
if (!ecid) {
  this.pendingPushToken = token;
  return;
}
```

The retry is handled by `retryPendingPushToken()`, which is called from `configureAdobe()` and after successful login. If ECID is not resolved by those points — or if the app is opened cold without going through login — the deferred token is never registered.

The result: the token exists on the device and in the app's local state, but AJO's profile store has no record of it for most profiles.

### Related files

| File | Location | Role |
|---|---|---|
| `src/utils/pushNotifications.ts` | Line 375 | ECID guard — defers token if ECID absent |
| `src/utils/pushNotifications.ts` | Line 614 | `retryPendingPushToken()` — retry path |
| `src/utils/adobeConfig.ts` | `configureAdobe()` | Calls retry after SDK init |

### Fix direction

Run `/push-audit` for a full health check. The likely fix involves ensuring `retryPendingPushToken()` is called at a reliable point after ECID resolves — not just after login, but also on app resume and after the Edge Identity extension confirms an ECID is available.

---

## Gap 2 — Push Open Tracking Events Never Reach the AJO System Dataset

### Evidence

- **AJO Push Tracking Experience Event Dataset** (`ajo_push_tracking_experience_event_dataset`, ID: `67bcdfcbb2ced72aef0ae298`): zero batches, zero records — confirmed across all org sandboxes in the usage report
- **AJO Message Feedback Event Dataset**: 402 + 45 rows — AJO's server-side send/deliver records ARE present, confirming deliveries happened but no open feedback came back

### What happens today

When the user taps a push notification, `_layout.tsx:159` calls `buildPushTrackingEvent()` and sends via `Edge.sendEvent()`. The event has the correct `eventType` (`pushTracking.applicationOpened`) and a valid `_adobecmteas` tenant block, but it is missing the `_experience.decisioning.propositions[0].scopeDetails.correlationID` field.

The datastream has `Adobe Journey Optimizer` service enabled. AJO's routing intercept recognizes `pushTracking.*` eventTypes but requires the `correlationID` to attribute the open back to a journey execution. Without it, the event is not routed to the AJO Push Tracking dataset and AJO has no signal that the message was opened.

The event currently lands in `davidMobileInteractions` only, with no journey attribution.

### Why `Messaging.handleNotificationResponse()` is not the answer

The `@adobe/react-native-aepmessaging` SDK (v7.1.0) does **not** expose a `handleNotificationResponse()` method. The `Messaging` class covers in-app messages and content cards only — push notification tracking was never ported to the React Native layer. Manual `Edge.sendEvent()` is the only available path.

### What the correlationID is and where it comes from

AJO embeds tracking metadata in every push it sends as a `_xdm` key in the notification data payload. When decoded, this JSON contains:

```json
{
  "mixins": {
    "_experience": {
      "customerJourneyManagement": {
        "messageExecution": {
          "correlationID": "04770c73-4ee5-41c5-b19e-02cd810a835c-0",
          "messageExecutionID": "...",
          "messageID": "...",
          "journeyVersionID": "..."
        }
      }
    }
  }
}
```

The app currently reads `adobe_message_id` and `adb_n_id` from the notification data but never reads or parses `_xdm`. The correlationID is never extracted and never sent.

### Datastream routing clarification

The AJO Push Tracking Experience Event Dataset is **not** listed as an Event Dataset in the datastream — it is a system dataset that AJO populates internally when it receives a properly attributed push tracking event. Adding it to the datastream Event Dataset list would be incorrect. The routing is:

```
App → Edge.sendEvent (pushTracking.applicationOpened + correlationID)
  → Datastream → AJO service
    → AJO system: routes to ajo_push_tracking_experience_event_dataset
    → Standard: routes to davidMobileInteractions
```

Without the correlationID, the AJO service step has nothing to process and the event only reaches `davidMobileInteractions`.

### Related files

| File | Location | Role |
|---|---|---|
| `app/_layout.tsx` | Line 159 | Push response listener — builds and sends tracking event |
| `src/utils/xdmEventBuilders.ts` | Line 1131 | `buildPushTrackingEvent()` — missing correlationID param |
| `docs/CorrelationID-Implementation-Plan.md` | — | Full implementation plan for this fix |

### Fix direction

See `docs/CorrelationID-Implementation-Plan.md` for the step-by-step implementation. In brief:

1. Extract and parse `_xdm` from the notification data payload in `_layout.tsx`
2. Add `correlationID?: string` to `PushTrackingEventParams`
3. Add `_experience.decisioning.propositions[0].scopeDetails.correlationID` to the XDM payload in `buildPushTrackingEvent` when present

No schema changes required — `_experience.decisioning.propositions[].scopeDetails.correlationID` is already covered by the `proposition-interaction` field group included in `davidMobileInteractions`.

---

## Relationship Between the Two Gaps

These are independent failures but compound each other:

- **Gap 1** means AJO can't reach most profiles → journey sends are suppressed before they start
- **Gap 2** means AJO can't measure what happens after delivery → open rate is always 0%, re-entry suppression based on opens never fires, frequency capping can't count opens

Fixing Gap 2 alone won't help the 80% of profiles that Gap 1 is blocking. Both need to be resolved for the full AJO push loop to work: **target → deliver → open → report → re-enter or suppress**.

---

## Priority

| Gap | Effort | Impact |
|---|---|---|
| Gap 1 — Token registration | Medium — retry timing logic | Unblocks 24 currently excluded profiles per journey run |
| Gap 2 — Open tracking / correlationID | Low — 3-file change, plan already written | Closes the reporting loop; unblocks open-based journey re-entry |

Gap 2 is lower effort and has a complete plan. Gap 1 requires a push-audit first to confirm the exact retry failure mode before changing code.
