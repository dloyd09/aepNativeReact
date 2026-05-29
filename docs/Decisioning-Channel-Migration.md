# Decisioning Channel Migration: Optimize → Messaging

**Date:** 2026-05-27
**Author:** dloyd
**Trigger:** Live Assurance session showed `Edge Optimize Personalization Request` with no proposition returned for the AJO Decisioning `weRewards Mastercard` offer.

---

## Finding

A live Assurance event captured this request payload:

```json
{
  "ACPExtensionEventName": "Edge Optimize Personalization Request",
  "ACPExtensionEventSource": "com.adobe.eventsource.requestcontent",
  "ACPExtensionEventType": "com.adobe.eventtype.edge",
  "payload": {
    "ACPExtensionEventData": {
      "xdm": { "eventType": "personalization.request" },
      "request": { "sendCompletion": true },
      "query": {
        "personalization": {
          "decisionScopes": [
            "mobileapp://com.cmtBootCamp.AEPSampleAppNewArchEnabled/edge-offers"
          ],
          "schemas": [
            "https://ns.adobe.com/personalization/html-content-item",
            "https://ns.adobe.com/personalization/json-content-item",
            "https://ns.adobe.com/personalization/default-content-item",
            "https://ns.adobe.com/experience/offer-management/content-component-html",
            "https://ns.adobe.com/experience/offer-management/content-component-json",
            "https://ns.adobe.com/experience/offer-management/content-component-imagelink",
            "https://ns.adobe.com/experience/offer-management/content-component-text"
          ]
        }
      }
    }
  },
  "validation": {
    "not matched": {
      "error": [
        { "message": "There are request scopes that did not have a corresponding response  . There are request scopes that do not have a name in the pattern of *.*.*", "namespace": "adobe-iam-request" }
      ]
    }
  }
}
```

The expected `weRewards Mastercard` offer is authored in **AJO Decisioning → Catalogs** (the new Decisioning framework with Decision Items, Strategies, and Policies), and is delivered via the **edge Decisioning** path. That path scores by **surface**, not by legacy activity/placement scopes.

The mobile client, however, was still requesting through the legacy **Offer Decisioning** channel:

- `ACPExtensionEventName: "Edge Optimize Personalization Request"` is emitted only by `Optimize.updatePropositions()` from `@adobe/react-native-aepoptimize`.
- The request schemas include `offer-management/content-component-*`, which the Optimize extension adds automatically.
- Even though the `decisionScope` string is a mobile surface URI, the request is delivered on the Offer Decisioning channel — the new Decisioning strategy does not listen there.

Result: no proposition is returned, and the validator's `*.*.*` activity/placement pattern check fires (a benign artefact, since mobile surface scopes legitimately do not match that pattern).

## Call sites that needed migration

| Trigger | File | Old call |
|---|---|---|
| Offers consumer tab on focus / Refresh | `app/(consumerTabs)/offers.tsx` | `Optimize.updatePropositions([new DecisionScope(scopeName)], xdm)` |
| `fetchPropositionsForSurface` | `src/utils/decisioningItems.ts` | `Optimize.updatePropositions([scope])` + `Optimize.getPropositions([scope])` |
| `getCachedPropositionsForSurface` | `src/utils/decisioningItems.ts` | `Optimize.getPropositions([scope])` |
| `refreshDecisioningSurfaceFromStoredConfig` | `src/utils/decisioningItems.ts` | `Optimize.updatePropositions([new DecisionScope(fullUri)])` |
| Optimize tech screen (legacy diagnostic) | `app/(techScreens)/OptimizeView.tsx` | `Optimize.updatePropositions([scope], xdm)` — left in place intentionally for contrast |

## Changes made

1. **`src/utils/decisioningItems.ts`** — `fetchPropositionsForSurface`, `getCachedPropositionsForSurface`, and `refreshDecisioningSurfaceFromStoredConfig` now call `Messaging.updatePropositionsForSurfaces` / `Messaging.getPropositionsForSurfaces`. `Optimize` and `DecisionScope` imports removed. The fetch helpers pass the partial surface name (`edge-offers`); Messaging prefixes the bundle identifier internally. `buildSurfaceUri` retained (used by tests and helpful for display/logging).

2. **`src/utils/offersOptimize.ts`** — `mapOptimizePropositionToOffers` / `getOffersForScope` / `createOptimizePropositionUpdateHandler` / `buildOptimizeRequestXdm` / `trackOfferDisplay` / `trackOfferTap` removed. Replaced with a single `mapPropositionsToOffers(propositions, surface)` that consumes an array of Messaging propositions (the shape `decisioningItems.ts` already normalizes). `ConsumerOffer` no longer types `proposition` against the Optimize class and now carries a `surface` field used by tracking.

3. **`app/(consumerTabs)/offers.tsx`** — dropped `Optimize.updatePropositions` / `getPropositions` / `onPropositionUpdate`. Fetches via `fetchPropositionsForSurface(surfaceName)` from `decisioningItems.ts`; routes display tracking (FlatList viewability) and tap tracking (Add to Cart) through `trackDecisioningItemDisplay` / `trackDecisioningItemInteraction`. Identity map and profile are mirrored into refs so the once-mounted viewability callback can see current values.

4. **`src/utils/__tests__/decisioningItemsFlow.test.ts`** — swapped the `@adobe/react-native-aepoptimize` jest mock for an `@adobe/react-native-aepmessaging` mock and updated the surface-refresh assertion to expect `Messaging.updatePropositionsForSurfaces(['edge-offers'])`.

`app/(techScreens)/OptimizeView.tsx` is **intentionally untouched**. It remains as a legacy-channel diagnostic so students can still trigger an `Edge Optimize Personalization Request` and observe the old shape in Assurance for contrast.

## What students should now see in Assurance

After this change the Offers tab and Decisioning Items tab will emit:

- `ACPExtensionEventName: "Update propositions request"` (Messaging extension)
- `query.personalization.surfaces: ["mobileapp://.../edge-offers"]`
- AJO surface schemas — no `offer-management/content-component-*` entries

…and a matching `personalization:decisions` response keyed by the surface, carrying the `weRewards Mastercard` proposition produced by the configured Decisioning strategy.

## Follow-ups (not in this change)

- Once student materials and any in-flight bootcamps no longer reference Offer Decisioning, the `Optimize` extension registration in `src/utils/adobeConfig.ts` and `OptimizeView.tsx` can be removed wholesale.
- `docs/Decisioning-And-Offers-Consumer-QA.md` references both flows; revisit after the SDK extension is removed.
