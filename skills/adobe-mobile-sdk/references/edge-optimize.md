# Edge Extension: Offer Decisioning and Target
> `@adobe/react-native-aepoptimize`
> Docs: https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer-decisioning/

---

## What it is

The Optimize extension enables **real-time offer decisioning and personalization** via the Edge Network. It fetches and renders personalized offers from:

- **Adobe Journey Optimizer** — offer decisioning (JSON, HTML, image offers)
- **Adobe Target** — A/B tests and experience targeting via Edge delivery

Both are accessed through the same `Optimize` API using named **decision scopes** (AJO) or **mbox names** (Target via Edge).

This is the modern Edge-based path. For legacy Target delivery (non-Edge), see `solution-target.md`.

---

## Installation

```bash
npm install @adobe/react-native-aepoptimize
```

iOS:
```bash
cd ios && pod install
```

---

## Prerequisites

```
@adobe/react-native-aepcore
@adobe/react-native-aepedge
@adobe/react-native-aepedgeidentity
```

---

## Core APIs

### Update propositions (fetch offers)
```typescript
import { Optimize, DecisionScope } from '@adobe/react-native-aepoptimize';

// Fetch offers for one or more named scopes
const scope = new DecisionScope('your-scope-name');
await Optimize.updatePropositions([scope]);
```

### Get propositions (read cached offers)
```typescript
// Read offers from the local cache after updatePropositions resolves
const propositionsMap = await Optimize.getPropositions([scope]);

// propositionsMap is keyed by scope name
const proposition = propositionsMap['your-scope-name'];
const offers = proposition?.items ?? [];
```

### Track display and interaction
```typescript
// Track that an offer was displayed
await proposition.track(MessagingEdgeEventType.DISPLAY);

// Track that an offer was interacted with (tap, click)
await proposition.track(MessagingEdgeEventType.INTERACT);
```

---

## App usage pattern (decisioningItems.ts)

This app uses `Messaging.updatePropositionsForSurfaces()` + `Messaging.getPropositionsForSurfaces()` for **code-based experiences (CBE)** via AJO surfaces, and `processDecisioningPropositions()` to normalize the proposition response into renderable `DecisioningItem` objects.

```typescript
import { Messaging } from '@adobe/react-native-aepmessaging';
import {
  processDecisioningPropositions,
  trackDecisioningItemDisplay,
  trackDecisioningItemInteraction,
} from '@/src/utils/decisioningItems';

// 1. Fetch from AJO surface
await Messaging.updatePropositionsForSurfaces(['edge-offers']);

// 2. Read cached results
const result = await Messaging.getPropositionsForSurfaces(['edge-offers']);

// 3. Normalize into DecisioningItem[]
const items = processDecisioningPropositions(normalizePropositionsResult(result));

// 4. Track display when rendered
await trackDecisioningItemDisplay(item);

// 5. Track interaction on user action
await trackDecisioningItemInteraction(item, 'tap');
```

Surface name comes from `AsyncStorage` via `DecisioningItemsConfig` — never hardcode it.

---

## Proposition item schemas

| Schema | Format | Use |
|---|---|---|
| `personalization/json-content-item` | JSON | Structured offer data |
| `personalization/html-content-item` | HTML string | Rendered HTML offer |
| Embedded items | JSON array in `isJsonContent` | Multiple offers in one item |

---

## Key rules

- ✅ Always call `updatePropositions` before `getPropositions` — the SDK doesn't auto-fetch
- ✅ Track display (`DISPLAY`) when the offer is rendered, not when fetched
- ✅ Track interact (`INTERACT`) when the user acts on the offer (tap, CTA)
- ✅ Surface/scope name must match what's configured in AJO or Target exactly (case-sensitive)
- ❌ Do not call `updatePropositions` on every render — call on screen focus or explicit refresh
- ❌ Do not hardcode surface names — read from `AsyncStorage` config
- ❌ Do not skip tracking — untracked propositions break AJO reporting and journey triggers

---

## API Reference
https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer-decisioning/api-reference/
