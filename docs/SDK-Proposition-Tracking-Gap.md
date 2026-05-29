# AEP Mobile SDK — Proposition Tracking Gap Analysis

**Date:** 2026-05-26
**App:** AEP Native React (CMT Bootcamp Demo)
**Reported by:** David Loyd
**SDK versions affected:** `@adobe/react-native-aepmessaging@7.1.0`, `@adobe/react-native-aepoptimize@7.0.0`
**Confirmed via:** Assurance session `d3b92cf1-4e25-4486-9a3d-3df29806852e`

---

## Summary

When using AJO Code-Based Experiences (CBE) with the React Native Mobile SDK, there is no out-of-the-box way to send proposition interaction tracking events (`decisioning.propositionDisplay`, `decisioning.propositionInteract`) that include custom XDM tenant fields required by a custom schema. This affects both the Messaging and Optimize extensions. The result is that all proposition tracking events are rejected by AEP streaming schema validation with `DCVS-1106-400`.

---

## Background

The app uses AJO to serve personalized offers to a `mobileapp://com.cmtBootCamp.AEPSampleAppNewArchEnabled/edge-offers` surface. Offers are fetched via `Messaging.updatePropositionsForSurfaces()` and retrieved via `Messaging.getPropositionsForSurfaces()`. When a user views or taps an offer, the app attempts to send a proposition tracking event. The custom AEP schema (`davidMobileInteractions`) requires a top-level `_adobecmteas` tenant block on every event. Proposition tracking events consistently arrive at the Edge without this block and are rejected.

---

## Issue 1 — Messaging SDK: No proposition item tracking API for JSON/HTML CBE surfaces

### What was expected

The app code in `src/utils/decisioningItems.ts` checks for a `.track()` method on proposition items:

```ts
if (item.propositionItem && typeof item.propositionItem.track === 'function') {
  item.propositionItem.track(interaction, MessagingEdgeEventType.INTERACT);
  return;
}
// falls through to manual fallback
```

This pattern was written assuming proposition items returned by `getPropositionsForSurfaces()` would be class instances with a `.track()` method — consistent with how the native iOS/Android SDKs expose `PropositionItem`.

### What the SDK actually provides

`Messaging.getPropositionsForSurfaces()` is typed as:

```ts
static async getPropositionsForSurfaces(
  surfaces: string[]
): Promise<Record<string, MessagingProposition[]>> {
  return await RCTAEPMessaging.getPropositionsForSurfaces(surfaces);
}
```

It returns the raw bridge result with **no JS-side reconstruction**. `MessagingProposition` is a plain TypeScript interface:

```ts
export interface MessagingProposition {
  id: string;
  scope: string;
  scopeDetails: ScopeDetails;
  items: MessagingPropositionItem[];  // ← plain interface, no methods
}
```

`MessagingPropositionItem` is a union of four types:

```ts
export type MessagingPropositionItem =
  | ContentCard
  | HTMLProposition
  | InAppMessage
  | JSONPropositionItem;
```

All four are plain TypeScript interfaces — **none have a `track()` method**. The React Native bridge serializes native objects to JSON; without explicit JS-side class reconstruction (as the native SDK does), all methods are lost in transit.

### What tracking IS available in the Messaging SDK

The only proposition-level tracking methods in the Messaging SDK are:

```ts
static trackContentCardDisplay(proposition: MessagingProposition, contentCard: ContentCard): void
static trackContentCardInteraction(proposition: MessagingProposition, contentCard: ContentCard): void
```

These are specific to the `ContentCard` schema. For `JSON_CONTENT` and `HTML_CONTENT` schemas — which are what CBE surfaces return — **there is no OOTB tracking method in the Messaging SDK at v7.1.0**.

### Evidence

- `typeof item.propositionItem.track === 'function'` always evaluates `false` in production
- The `[6.4-test]` console log confirms `manual fallback path firing` on every interaction
- The Assurance griffon event for `propositionInteract` contains only `{ eventType, _experience }` — the exact shape of the manual fallback, not a SDK-generated event

### Proposed Jira ticket

**Component:** `adobe/aepsdk-messaging-react-native`
**Type:** Feature Request / Bug

> `Messaging.getPropositionsForSurfaces()` returns plain objects with no tracking API for JSON or HTML content items. `trackContentCardDisplay/Interaction` is limited to the ContentCard schema. There is no OOTB way to send `decisioning.propositionDisplay` or `decisioning.propositionInteract` events for code-based experience surfaces.
>
> **Expected:** Proposition items returned for JSON_CONTENT and HTML_CONTENT schemas should expose a `track(eventType: MessagingEdgeEventType, tokens?: string[])` method, consistent with how `PropositionItem` behaves in the native iOS/Android SDKs.
>
> **Workaround in use:** Manual `Edge.sendEvent()` with hand-built `_experience.decisioning` XDM block.

---

## Issue 2 — Optimize SDK: `Offer.displayed()` / `Offer.tapped()` do not support custom XDM fields

### What the Optimize SDK provides

The `@adobe/react-native-aepoptimize` SDK correctly reconstructs proposition items as class instances. `Proposition` is a class whose constructor maps `items` to `new Offer(offer)`:

```ts
class Proposition {
  constructor(eventData: PropositionEventData) {
    this.items = eventData['items'].map((offer) => new Offer(offer));
  }
}
```

`Offer` is a class with actual tracking methods:

```ts
displayed(proposition: Proposition): void {
  RCTAEPOptimize.offerDisplayed(this.id, cleanedProposition);
}

tapped(proposition: Proposition): void {
  RCTAEPOptimize.offerTapped(this.id, cleanedProposition);
}
```

### The gap

`displayed()` and `tapped()` call native methods directly. These native methods build and send XDM tracking events internally — **without any awareness of custom tenant namespaces**. The resulting events land at the Edge without `_adobecmteas` (or any other custom tenant block) and fail schema validation identically to the Messaging SDK path.

### The escape hatch (not documented as required)

The Optimize SDK provides XDM generation methods that return the `_experience.decisioning` block for manual merging:

```ts
generateDisplayInteractionXdm(proposition: Proposition): Promise<Map<string, any>>
generateTapInteractionXdm(proposition: Proposition): Promise<Map<string, any>>
```

The intent is that the caller merges the returned XDM with custom fields and sends via `Edge.sendEvent()`:

```ts
const xdm = await offer.generateTapInteractionXdm(proposition);
const mergedXdm = {
  ...xdm,
  _adobecmteas: { /* tenant fields */ }
};
await Edge.sendEvent(new ExperienceEvent({ xdmData: mergedXdm }));
```

This pattern works and is the correct long-term approach for custom-schema implementations. However:
1. It is not documented as the **required** pattern when a custom schema is in use
2. The existence of `displayed()` / `tapped()` implies OOTB tracking works, when it silently produces non-compliant events for any org with a custom required tenant namespace

### Proposed Jira ticket

**Component:** `adobe/aepsdk-optimize-react-native`
**Type:** Bug / Documentation

> `Offer.displayed()` and `Offer.tapped()` call native methods that build XDM tracking events without any custom fields. Implementations with required custom tenant namespaces (e.g. `_adobecmteas` required on all events by a custom ExperienceEvent schema) receive `DCVS-1106-400` schema validation failures for all proposition tracking events sent via these methods.
>
> `generateDisplayInteractionXdm()` and `generateTapInteractionXdm()` exist as a workaround but are not surfaced as the required path for custom-schema implementations. The `displayed()` / `tapped()` methods imply OOTB compliance when they are not.
>
> **Expected:**
> - Option A: `displayed()` and `tapped()` accept an optional `customXdm?: Record<string, any>` parameter that is merged into the outbound event before dispatch.
> - Option B: Documentation explicitly states that `displayed()` / `tapped()` do not support custom schemas and that `generateDisplayInteractionXdm()` + `Edge.sendEvent()` is the required pattern.
>
> **Workaround in use:** `generateDisplayInteractionXdm()` / `generateTapInteractionXdm()` with manual `Edge.sendEvent()` and `_adobecmteas` merged in.

---

## Issue 3 — Wrong SDK being used for CBE surface (app-side, not an SDK bug)

The app currently uses `@adobe/react-native-aepmessaging` to fetch and render offers from a CBE surface. The Messaging extension is designed primarily for in-app messages. The `@adobe/react-native-aepoptimize` extension is the semantically correct SDK for offer decisioning and code-based experiences — it returns proper class instances (`Proposition` → `Offer`) and has `generateDisplayInteractionXdm()` / `generateTapInteractionXdm()` for custom XDM merging.

**This is an app-level issue, not an SDK bug.** However, it is worth noting that the boundary between the two SDKs is not clearly documented for CBE surfaces specifically. Both extensions can fetch from the same surface; the difference is what you get back and how tracking works.

**Impact on Jira tickets:** Even after migrating to the Optimize SDK, Issue 2 still applies — `Offer.tapped()` OOTB still won't include `_adobecmteas`. The correct end state is Optimize SDK + `generateTapInteractionXdm()` + manual `Edge.sendEvent()` with `_adobecmteas` merged.

---

## Current workaround (in-app)

Manual `Edge.sendEvent()` via `trackDecisioningItemDisplay()` and `trackDecisioningItemInteraction()` in `src/utils/decisioningItems.ts`. These build the `_experience.decisioning` block from the proposition's `scopeDetails` (which correctly includes `correlationID` via spread). The gap is that `_adobecmteas` is not yet added — this is tracked as item **6.4** in `docs/App-Optimization-Plan.md`.

Once 6.4 is implemented, the workaround is complete. The SDK native tracking path (`propositionItem.track()`) can be removed as dead code — it is architecturally unreachable given the Messaging SDK's plain-object return type.

---

## Confirmed behavior from Assurance session `d3b92cf1-4e25-4486-9a3d-3df29806852e`

| Event | Path taken | `_adobecmteas` | Streaming validation |
|---|---|---|---|
| `decisioning.propositionInteract` | Manual fallback | ❌ Missing | ❌ `DCVS-1106-400` |
| `decisioning.propositionInteract` | Manual fallback | ❌ Missing | ❌ `DCVS-1106-400` |
| `decisioning.propositionDisplay` | Manual fallback | ❌ Missing | ❌ `DCVS-1106-400` |
| `mobileApp.navigation.pageViews` | `buildPageViewEvent()` | ✅ Present | ✅ Pass |

SDK native path (`propositionItem.track()`) fired **zero times** across all events in the session. Confirmed by:
1. Griffon event XDM shape matches manual fallback exactly (`{ eventType, _experience }` only)
2. Console log `[Decisioning][6.4-test] interact: manual fallback path firing` observed in device logs

`correlationID` (`04770c73-4ee5-41c5-b19e-02cd810a835c-0`) was present in all failing events via `...item.proposition.scopeDetails` spread — the schema field and spread mechanism are both working correctly. The sole validation failure is the missing `_adobecmteas` block.

---

## Recommended long-term architecture

```
Fetch:    Optimize.updatePropositions() → Optimize.getPropositions()
                                          ↓
                              Proposition → Offer[] (class instances)

Display:  offer.generateDisplayInteractionXdm(proposition)
                ↓
          merge { _adobecmteas, identityMap, environment, _id, timestamp }
                ↓
          Edge.sendEvent(new ExperienceEvent({ xdmData: merged }))

Interact: offer.generateTapInteractionXdm(proposition)
                ↓
          merge { _adobecmteas, identityMap, environment, _id, timestamp }
                ↓
          Edge.sendEvent(new ExperienceEvent({ xdmData: merged }))
```

This gives correct `_experience.decisioning` structure (including `correlationID` from `scopeDetails`), full custom tenant coverage, and proper schema compliance — without relying on any OOTB tracking path that bypasses custom XDM fields.
