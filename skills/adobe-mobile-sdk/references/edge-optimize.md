# Personalization: Proposition Delivery (Messaging surfaces vs Optimize scopes)
> Two extensions, two channels. Pick the right one or your propositions silently never arrive.
> Docs:
> - AJO Decisioning (current): https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/
> - Offer Decisioning / Target via Optimize (legacy): https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer-decisioning/

---

## Two delivery channels — which to use

| Source of truth (AJO UI) | Mobile SDK channel | Extension | Request keyed by |
|---|---|---|---|
| **Decisioning** → Catalogs, Strategy setup, Decision Items, Policies | **Messaging surfaces** | `@adobe/react-native-aepmessaging` | Mobile **surface** (e.g. `edge-offers`) |
| Code-Based Experiences (CBE) | **Messaging surfaces** | `@adobe/react-native-aepmessaging` | Mobile **surface** |
| Offer Decisioning (legacy: Activities → Placements → Offers) | **Optimize scopes** | `@adobe/react-native-aepoptimize` | Activity/Placement **decision scope** |
| Adobe Target (mbox via Edge) | **Optimize scopes** | `@adobe/react-native-aepoptimize` | mbox name |

**For new bootcamp work, use Messaging.** This app's `weRewards Mastercard` offer is authored in AJO's new Decisioning framework — it is reachable only through `Messaging.updatePropositionsForSurfaces` with a surface name. A request that uses `Optimize.updatePropositions([new DecisionScope(...)])` (even with a `mobileapp://` URI as the scope name) lands on the wrong channel: the Optimize event is tagged with `offer-management/content-component-*` schemas, the new Decisioning strategy does not listen on that channel, and no proposition is returned.

> Historical context: prior to 2026-05-27 this app's `(consumerTabs)/offers.tsx` and `src/utils/decisioningItems.ts` used `Optimize.updatePropositions` for the `edge-offers` surface. See `docs/Decisioning-Channel-Migration.md` for the diagnosis and migration notes.

---

## Messaging surface delivery (current path)

> `@adobe/react-native-aepmessaging`

### Installation

```bash
npm install @adobe/react-native-aepmessaging
cd ios && pod install
```

### Prerequisites
```
@adobe/react-native-aepcore
@adobe/react-native-aepedge
@adobe/react-native-aepedgeidentity
```

### Core APIs

```typescript
import { Messaging } from '@adobe/react-native-aepmessaging';

// Fetch propositions for one or more surfaces (fire-and-forget, fills cache).
Messaging.updatePropositionsForSurfaces(['edge-offers']);

// Read cached propositions — returns Record<surfaceUri, MessagingProposition[]>.
const result = await Messaging.getPropositionsForSurfaces(['edge-offers']);
```

Surface naming: pass the **partial** name (e.g. `'edge-offers'`); the SDK prefixes the app bundle internally to form `mobileapp://<bundleId>/edge-offers`. The returned `Record` is keyed by the full URI.

`updatePropositionsForSurfaces` returns void — there is no Promise to await. Wait briefly before reading the cache, or read the cache from a later screen-focus tick.

### App helpers (`src/utils/decisioningItems.ts`)

```typescript
import {
  fetchPropositionsForSurface,          // update → settle ~800ms → read
  getCachedPropositionsForSurface,      // read-only
  refreshDecisioningSurfaceFromStoredConfig,
  processDecisioningPropositions,
  trackDecisioningItemDisplay,
  trackDecisioningItemInteraction,
} from '@/src/utils/decisioningItems';

// 1. Fetch + read
const propositions = await fetchPropositionsForSurface('edge-offers');

// 2. Normalize raw propositions into renderable DecisioningItem[]
const items = processDecisioningPropositions(propositions);

// 3. Track display when rendered
await trackDecisioningItemDisplay(item, identityMap, profile);

// 4. Track interact on user action
await trackDecisioningItemInteraction(item, 'tap', identityMap, profile);
```

Surface name comes from `AsyncStorage` via `DecisioningItemsConfig` (key `@decisioning_items_config`) — never hardcode it.

### Proposition item schemas

| Schema | Format | Use |
|---|---|---|
| `personalization/json-content-item` | JSON | Structured offer data |
| `personalization/html-content-item` | HTML string | Rendered HTML offer |
| Embedded items | JSON array in `isJsonContent` | Multiple offers inside one item |

### Tracking

The Messaging bridge returns plain objects with no `track()` method (see `docs/SDK-Proposition-Tracking-Gap.md`). The app sends `decisioning.propositionDisplay` / `decisioning.propositionInteract` events manually through `Edge.sendEvent` with the custom-tenant XDM envelope. Use `trackDecisioningItemDisplay` / `trackDecisioningItemInteraction` — do not roll your own.

---

## Optimize scope delivery (legacy path)

> `@adobe/react-native-aepoptimize`
> Kept registered for the `OptimizeView` tech screen so students can observe the legacy Offer Decisioning request shape in Assurance for contrast. Do not use in new consumer-tab code.

### Installation
```bash
npm install @adobe/react-native-aepoptimize
cd ios && pod install
```

### Core APIs

```typescript
import { Optimize, DecisionScope } from '@adobe/react-native-aepoptimize';

const scope = new DecisionScope('your-scope-name');
await Optimize.updatePropositions([scope]);

// propositionsMap is a Map<scopeName, Proposition>
const propositionsMap = await Optimize.getPropositions([scope]);
const proposition = propositionsMap.get('your-scope-name');
const offers = proposition?.items ?? [];

await proposition.track(MessagingEdgeEventType.DISPLAY);
await proposition.track(MessagingEdgeEventType.INTERACT);
```

`Optimize.updatePropositions` is fire-and-forget. `Optimize.onPropositionUpdate({ call })` registers a listener that fires when fresh propositions arrive — store the subscription and call `.remove()` on cleanup to avoid duplicate handlers after re-mount.

`DecisionScope` instances are opaque to the SDK — it does **not** add the bundle id, so for surface-style names you would need to pass the fully expanded URI. This is one of the easy ways to confuse the two channels; if you are talking about mobile surfaces, prefer Messaging.

---

## Diagnosing "no proposition came back"

Pull the Assurance event for the failing request and check `ACPExtensionEventName`:

| Event name | Channel | Expected query field |
|---|---|---|
| `Update propositions request` | Messaging | `query.personalization.surfaces` |
| `Edge Optimize Personalization Request` | Optimize | `query.personalization.decisionScopes` + `offer-management/content-component-*` schemas |

If the AJO offer is authored in *Decisioning* (the newer Catalogs / Strategy setup nav) and the request is the Optimize one, the strategy will not match — that is the symptom from the 2026-05-27 migration. Switch the caller to `Messaging.updatePropositionsForSurfaces`.

The validator's `*.*.*` warning ("request scopes that do not have a name in the pattern of *.*.*") is the legacy activity/placement pattern check. It fires whenever Optimize is used with a non-activity-style scope (including mobile surface URIs) and is informational — it does not by itself indicate the channel-mismatch problem above; the missing proposition does.

---

## Key rules

- ✅ Match the channel to the AJO authoring surface: Messaging for new Decisioning + CBE, Optimize for legacy Offer Decisioning + Target-via-Edge.
- ✅ Always pass partial surface names to Messaging (`edge-offers`, not the full URI).
- ✅ Always fetch (update) before reading; the SDK doesn't auto-fetch on demand.
- ✅ Track display when the item is rendered, not when it is fetched. Track interact on user action.
- ✅ Read surface/scope names from `AsyncStorage` — never hardcode.
- ❌ Do not call `Optimize.updatePropositions` with a `mobileapp://...` scope expecting the new Decisioning framework to answer — it will not.
- ❌ Do not call `updatePropositionsForSurfaces` on every render — call on screen focus or explicit refresh.
- ❌ Do not skip tracking — untracked propositions break AJO reporting and journey triggers.

---

## API References
- Messaging (current): https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/api-reference/
- Optimize (legacy): https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer-decisioning/api-reference/
- Migration notes: `docs/Decisioning-Channel-Migration.md`
- Tracking gap workaround: `docs/SDK-Proposition-Tracking-Gap.md`
