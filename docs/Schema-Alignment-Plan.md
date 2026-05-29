# Schema Alignment Plan — Mobile Interactions v1.7 Migration

**Source of truth (wiki):** [Backlog Items](https://wiki.corp.adobe.com/spaces/~dloyd/pages/3843185182/Backlog+Items) — page id 3843185182, version 7 (pulled 2026-05-21)
**Target schema:** `docs/mobileInteracionsSchema.json` ("Mobile Interactions" v1.7, sandbox `45126ff9-bc11-468d-926f-f9bc11d68db8`)
**Reference payload:** `docs/schema-sample-Mobile Interactions.json`
**Status:** Planned migration — **NOT YET IMPLEMENTED**

> **Migration semantics.** This is a cut-over to the new schema. There are no fallbacks, no "legacy" branches, no dual-emit. Every old value is replaced by its new canonical counterpart in the same commit that introduces the new value. Any caller still emitting the old value at merge time is a bug, not a compatibility scenario.

---

## 1. Wiki backlog ↔ app code ↔ plan task map

The wiki page lists 8 items. Mapping below shows whether each is addressed by this plan, deferred, or out of scope.

| # | Backlog item | App impact | Plan task |
|---|---|---|---|
| 1 | POS schema for Click-2-Bricks + Mockaroo automation | None — bootcamp data tooling | **Out of scope** |
| 2 | Canonical `transactionType` values (Lower/Upper Funnel, Authentication) | `xdmEventBuilders.ts` (7 builders) | **Task 1** |
| 3 | `Guest` → `Prospect` (visitorType) | `xdmEventBuilders.ts` (10+ sites) | **Task 2** |
| 4 | `productCategories` (primary/secondary) on `productListItems` | `xdmEventBuilders.ts`, `CartContext.tsx`, 3 caller screens, `bootcamp_products.json` source | **Task 3** |
| 5 | Display `com.AEPSampleAppNewArchEnabled://` base URL on Assurance screen | `app/(techScreens)/AssuranceView.tsx` | **Task 6** |
| 6 | Ingestion errors: `_adobecmteas` missing on streaming events | `app/_layout.tsx` push tracking event | **Task 4** |
| 7 | CJA Launches / Users / Installs = 0 (SDK not auto-populating AppID / lifecycle) | `app/_layout.tsx` | **Task 5** |
| 8 | Push message bounce rate | Requires Assurance push-debug session data | **Out of scope** (separate investigation) |

---

## 2. Pre-migration: canonical reference

### 2.1 Schema authority

The new `Mobile Interactions` v1.7 schema composes these mixins:

- `experienceevent` (base class, `_id` and `xdm:timestamp` required)
- Tenant `_adobecmteas`: **Identities**, **Visitor Authentication**, **Visitor Details**, **Channel Info**
- Tenant `commerce._adobecmteas`: **Commerce Details** (`lowerFunnel.reviewOrderPage`, `productListItems[]._adobecmteas.lowerFunnel.cartID`, `productListItems[]._adobecmteas.products.unitPrice`)
- Tenant `web._adobecmteas`: **Web Details** (campaign data, page details, engagement.transactionType, NPS, video, search)
- Adobe mixins: `experienceevent-commerce`, `experienceevent-web`, `experienceevent-application`, `aep-mobile-lifecycle-details`, `proposition-interaction`, `identitymap`

**Required fields (cut-over invariant):** every event we send must include `_id`, `timestamp`, `identityMap`, and `_adobecmteas` (tenant block at top level). Wiki item 6 confirms streaming validation fails when `_adobecmteas` is absent.

### 2.2 Canonical value tables (post-migration)

**transactionType** — `web.webInteraction._adobecmteas.engagement.transactionType`

| Builder / context | New value |
|---|---|
| `buildCheckoutEvent` | `Lower Funnel` |
| `buildPurchaseEvent` | `Lower Funnel` |
| `buildProductListAddEvent` | `Upper Funnel` |
| `buildProductViewEvent` **(NEW emission)** | `Upper Funnel` |
| `buildPageViewEvent` w/ `pageType: 'cart'` **(NEW emission)** | `Upper Funnel` |
| `buildLoginEvent` (success and failure) | `Authentication` |
| `buildLogoutEvent` | `Authentication` |

> Wiki explicitly names: Checkout / Purchase → Lower Funnel; Add to Cart / Cart View / Product View → Upper Funnel; Login Success → Authentication. Logout is grouped with Authentication by analogy. Login failure stays under Authentication so journey conditions on the funnel category continue to match.

**visitorType** — `_adobecmteas.visitorDetails.visitorType`

| Auth state | New value |
|---|---|
| Authenticated user | `Customer` |
| Unauthenticated visitor | `Prospect` (was `Guest`) |
| Returning authenticated user with prior purchase | `Customer` (no new value introduced — schema description allows `New Customer` but app has no signal yet) |

**loginStatus** — `_adobecmteas.authentication.loginStatus`

| State | New value |
|---|---|
| Authenticated | `logged-in` |
| Unauthenticated (was `guest`) | `not-logged-in` |
| Login attempt failed | `login-failed` (unchanged) |
| Logged out | `logged-out` (unchanged; visitorType flips to `Prospect`) |

**channelInfo.participantName** (fallback for unauthenticated)

| Old | New |
|---|---|
| `'guest user'` | `'prospect'` |

---

## 3. Adobe Experience Platform prerequisites

This migration assumes the target schema, dataset, and datastream are in place on the AEP side. The schema in `docs/mobileInteracionsSchema.json` is the contract; the AEP resources must match it before the app's new emissions land. **Coordinate with whoever administers the bootcamp sandbox** (sandbox `45126ff9-bc11-468d-926f-f9bc11d68db8`) — some of these steps require Schema Architect / Data Engineer permissions.

> **Schema change?** Probably not. The current schema (v1.7) already exposes every field the migrated app code uses: `transactionType` and `visitorType` are freeform strings (so the canonical value changes in Tasks 1–2 fit existing fields), `productCategories[]` is inherited from `experienceevent-commerce` (Task 3), and the lifecycle / push mixins are already composed (Tasks 4–5). **The work is to verify the schema is the active target on the dataset the datastream routes to — not to redefine the schema itself.** If the bootcamp sandbox is on an older schema version, follow §3.5 path B.

### 3.1 Schema verification

| Resource | Expected value | How to verify |
|---|---|---|
| Schema title | `Mobile Interactions` | AEP UI → Data Management → Schemas → search "Mobile Interactions" |
| Schema version | `1.7` or higher | Open schema → version label in header |
| Class | XDM ExperienceEvent | Schema header |
| Required field groups | Identities (AEPBC), Visitor Authentication (AEPBC), Visitor Details (AEPBC), Channel info under Visitor Details (AEPBC), Commerce Details (AEPBC), Web Details (AEPBC), AEP Mobile Lifecycle Details, Experience Event Application Details, Experience Event Commerce Details, Experience Event Web Details, Decisioning Proposition Interaction Details | Schema → "Composition" panel |
| Identity descriptors | `_<tenant>.identities.ecid` → ECID namespace (primary); `_<tenant>.identities.emailAddress` → Email namespace (secondary) | Schema → "Identity Descriptors" tab |
| Required at top level | `@id`, `xdm:timestamp` | Schema → "Required" markers on each field |

If the schema is missing or the version is older than 1.7, rebuild from `docs/mobileInteracionsSchema.json`. Either use the AEP Schema Registry API (POST each mixin then the schema body) or recreate manually in the UI per the field-group list above. Replace `<XDM_TENANTID_PLACEHOLDER>` with the sandbox's actual tenant prefix before importing.

### 3.2 Dataset verification

| Resource | Expected value | How to verify |
|---|---|---|
| Dataset name | (Bootcamp-specific — likely "Mobile Interactions Events" or similar) | AEP UI → Data Management → Datasets |
| Backing schema | the `Mobile Interactions` schema from §3.1 | Dataset details → "Schema" panel |
| Streaming enabled | Yes | Dataset details → "Streaming" toggle |
| Profile enabled | Yes (so identities + identity stitching work) | Dataset details → "Profile" toggle |
| Sandbox | Matches the schema's sandbox | Dataset header |

If the dataset is built on an older schema, **do not** retrofit its schema reference in place — downstream Real-Time CDP segments, AJO journeys, and CJA data views may break. Create a new dataset on v1.7 and plan the cut-over via §3.5.

Capture the dataset ID — the datastream needs it.

### 3.3 Datastream verification

The datastream is the routing layer between Edge Network and AEP. **Updating the dataset target here is what actually moves the app's traffic onto the new schema.**

| Resource | Expected value | How to verify |
|---|---|---|
| Datastream name | (Bootcamp-specific) | AEP UI → Data Collection → Datastreams |
| AEP service Event Dataset | The dataset from §3.2 | Datastream → "Adobe Experience Platform" service → "Event Dataset" |
| AJO service | Enabled (the app uses AJO for push + decisioning) | Same panel → "Adobe Journey Optimizer" service |
| Sandbox | Matches `45126ff9-bc11-468d-926f-f9bc11d68db8` | Datastream details header |

Capture the datastream ID (UUID). This is what the Tags / Launch Edge extension references.

### 3.4 Tags / Launch property verification

The app's "App ID" (entered in Technical View → App ID Configuration, stored in AsyncStorage under `@adobe_app_id`, consumed by `configureAdobe()` in `src/utils/adobeConfig.ts`) maps to a Tags property + environment.

| Resource | Expected value | How to verify |
|---|---|---|
| Tags property | (Bootcamp-specific) | data-collection.adobe.com → Tags → property list |
| Edge extension config | Datastream ID matches §3.3 | Property → Extensions → Edge Network → Configure |
| Environment published | Whatever environment the App ID resolves to (dev / stage / prod) | Property → Publishing flow → active library on that environment |
| Mobile install instructions | App ID matches what's stored in the app's AsyncStorage | Property → Environments → "Mobile Install" → App ID string |

If only the datastream needs to change (e.g. swapping in a new dataset), update the Edge extension config and republish the active library — the app picks it up on next launch with no code change.

If a new Tags property is required, get the new App ID and enter it in Technical View → App ID Configuration on every test device.

### 3.5 Cut-over options

| Path | When to use | Trade-offs |
|---|---|---|
| **A.** Existing dataset already uses the v1.7 schema | The bootcamp dataset is already on the target schema | No platform work needed beyond verifying §3.1–§3.4; just ship the app changes |
| **B.** New dataset on v1.7, swap the existing datastream's Event Dataset to point at it | Existing dataset uses an older schema and downstream dependencies should keep referencing the old historical data | Single App ID to manage; clean cut-over; old dataset becomes a frozen historical record |
| **C.** New datastream + new Tags property + new App ID | You want to dual-run old and new in parallel for comparison | Each test device must be reconfigured; reporting is split during overlap; more setup overhead |

**Default recommendation: B.** A net-new dataset on v1.7, swapped in on the existing datastream, preserves the old dataset for retrospective queries and avoids re-instrumenting devices.

Whichever path is chosen, capture **before** and **after** Assurance sessions per §6.8 so the cut-over moment is documented.

### 3.6 AEP-side checklist (sign-off before app code merges)

- [ ] §3.1 schema confirmed in sandbox (version, mixins, identity descriptors)
- [ ] §3.2 dataset built on v1.7 schema, streaming + Profile enabled
- [ ] §3.3 datastream Event Dataset points at the v1.7 dataset
- [ ] §3.4 Tags property's Edge extension references the correct datastream ID, library published
- [ ] §3.5 cut-over path chosen and communicated to anyone running test devices
- [ ] A pre-fix Assurance baseline captured per §6.8

---

## 4. Tasks

### Task 1 — Canonical `transactionType` values + missing emissions

**Files:** `src/utils/xdmEventBuilders.ts`

The schema field is free-form string, but CJA reporting / AJO journey conditions key on the canonical values in §2.2. Two classes of change:

**1a. Rewrite values in builders that already emit `transactionType`:**

| Builder | Current raw value | New value |
|---|---|---|
| `buildCheckoutEvent` | `'checkout'` | `'Lower Funnel'` |
| `buildPurchaseEvent` | `'purchase'` | `'Lower Funnel'` |
| `buildProductListAddEvent` | `'add_to_cart'` | `'Upper Funnel'` |
| `buildLoginEvent` (success) | `'login_success'` | `'Authentication'` |
| `buildLoginEvent` (failure) | `'login_failure'` | `'Authentication'` |
| `buildLogoutEvent` | `'logout'` | `'Authentication'` |

**1b. Add `web.webInteraction._adobecmteas.engagement.transactionType` to builders that currently omit it:**

| Builder | Why it's missing today | New emission |
|---|---|---|
| `buildProductViewEvent` | No `web.webInteraction` block at all | Add `web.webInteraction._adobecmteas.engagement.transactionType: 'Upper Funnel'` |
| `buildPageViewEvent` when `pageType === 'cart'` | Cart view has page details only, not interaction | Add `web.webInteraction._adobecmteas.engagement.transactionType: 'Upper Funnel'` (cart view = upper funnel browse signal) |

**1c. Delete `buildProductInteractionEvent`** — see Task 8. The wiki canonical list does not include quantity-change or remove-from-cart events, and no UI screen calls this builder.

---

### Task 2 — `Guest` → `Prospect` migration (visitorType, loginStatus, participantName)

**Files:** `src/utils/xdmEventBuilders.ts`

This is a flat search-and-replace across all 8 production builders, plus the test files. Migration semantics: no `Guest` value remains in any XDM payload after this task.

| Field | Old value | New value | Builders affected |
|---|---|---|---|
| `_adobecmteas.visitorDetails.visitorType` (unauth) | `'Guest'` | `'Prospect'` | All 8 builders |
| `_adobecmteas.authentication.loginStatus` (unauth) | `'guest'` | `'not-logged-in'` | All 8 builders |
| `_adobecmteas.channelInfo.participantName` (unauth fallback) | `'guest user'` | `'prospect'` | All 8 builders |
| `_adobecmteas.visitorDetails.visitorType` after logout | `'Guest'` | `'Prospect'` | `buildLogoutEvent` |
| `_adobecmteas.channelInfo.participantName` after logout | `'guest user'` | `'prospect'` | `buildLogoutEvent` |

**Console-log strings (developer noise, but worth cleaning up):**

- `app/(consumerTabs)/cart.tsx` line 181/276 — log includes `participantName: profile?.firstName || 'Guest User'` → change to `'Prospect'`
- `app/(consumerTabs)/Checkout.tsx` line 116/169 — same pattern → change to `'Prospect'`

These log strings don't reach Edge; updating them is purely so on-device debug logs match the schema's vocabulary.

---

### Task 3 — `productCategories` on every `productListItems` entry

**Files:** `src/utils/xdmEventBuilders.ts`, `components/CartContext.tsx`, `app/(consumerTabs)/_home/[category]/[product].tsx`, `app/(consumerTabs)/offers.tsx`, `app/(consumerTabs)/decisioningItems.tsx`

The schema's `productListItems[].productCategories[]` is inherited from `experienceevent-commerce` and supports objects with `categoryID`, `categoryName`, and (optionally) `categoryPath`. The wiki backlog mandates two entries per item: a `primaryCategory` and a `secondaryCategory`, sourced from `bootcamp_products.json` (`product.categories.primary` and `product.categories.secondary`).

**Target shape (per the wiki sample):**

```json
"productListItems": [
  {
    "SKU": "eqsusuchd",
    "name": "Chasing Tail Surfboard",
    "quantity": 1,
    "priceTotal": 785,
    "productCategories": [
      { "categoryID": "primaryCategory",   "categoryName": "Equipment" },
      { "categoryID": "secondaryCategory", "categoryName": "Surfing"   }
    ],
    "_adobecmteas": {
      "lowerFunnel": { "cartID": "cart-abc-123" },
      "products":    { "unitPrice": 785 }
    }
  }
]
```

#### 3.1 Carry secondary category through the cart

**`components/CartContext.tsx`** — extend `CartItem`:

```ts
export type CartItem = {
  category: string;            // primaryCategory (existing)
  secondaryCategory?: string;  // NEW — sourced from product.categories.secondary
  // ... rest unchanged
};
```

`addToCart` and the immutable update paths already spread `item`, so no logic change is needed once the type accepts the field.

#### 3.2 Populate at every `addToCart` callsite

| Caller | Source for primary | Source for secondary |
|---|---|---|
| `app/(consumerTabs)/_home/[category]/[product].tsx` | `productData.product.categories.primary` | `productData.product.categories.secondary` |
| `app/(consumerTabs)/offers.tsx` | `offer.category \|\| 'offers'` | `undefined` — AJO offers don't carry a secondary category. Plan: omit the secondary entry. |
| `app/(consumerTabs)/decisioningItems.tsx` | `content.badge \|\| 'decisioning-items'` | `undefined` — same reasoning as offers. |

#### 3.3 Builder changes (`xdmEventBuilders.ts`)

- Extend `ProductViewEventParams.product` and `ProductListAddEventParams.product` with `secondaryCategory?: string`.
- Update `formatProductListItems()` to build `productCategories` from `item.category` (primary) and `item.secondaryCategory` (secondary, if present). When secondary is missing, emit only the primary entry. Never emit an empty array.
- Update `buildProductViewEvent()` and `buildProductListAddEvent()` to inline the same `productCategories` shape on their single-product `productListItems` entry.
- Every other builder that emits `productListItems` already goes through `formatProductListItems()`, so they pick up the change for free: `buildPageViewEvent` (cart), `buildCheckoutEvent`, `buildPurchaseEvent`, `buildProductRemovalEvent`.

#### 3.4 Caller updates for direct-emit builders

- `app/(consumerTabs)/_home/[category]/[product].tsx` — pass `secondaryCategory` into both `buildProductViewEvent` and `buildProductListAddEvent` calls.
- `offers.tsx` and `decisioningItems.tsx` — `buildProductListAddEvent` calls do not need updating beyond the type change; their products have no secondary category and the builder will emit a single `primaryCategory` entry.

---

### Task 4 — Fix `_adobecmteas` missing on push tracking event (wiki item 6)

**File:** `app/_layout.tsx` (lines 151–168 in current main)

The push-open / custom-action tracking event currently hand-rolls XDM:

```ts
const trackingEvent = {
  xdm: {
    eventType: isOpen ? 'pushTracking.applicationOpened' : 'pushTracking.customAction',
    pushNotificationTracking: { /* … */ },
    application: { launches: { value: 1 } },  // ← also bogus; see Task 5
  },
};
await Edge.sendEvent(trackingEvent);
```

This payload omits `_adobecmteas`, `_id`, `timestamp`, and `identityMap`. The wiki ingestion error — *"required key [_adobecmteas] not found"* — matches this event precisely. The "Track event missing Edge Network Hit event" error is the downstream consequence: validation rejects it before it reaches Edge.

**Migration steps:**

1. Add a new builder `buildPushTrackingEvent(params)` in `src/utils/xdmEventBuilders.ts` that follows the same shape as the other builders (tenant block, identityMap, `_id`, timestamp, environment).
2. Inputs: `identityMap`, `profile`, `pushProvider` (`'apns' | 'fcm'`), `pushProviderMessageID`, `interaction` (`'opened' | 'customAction'`), optional `actionID`.
3. Body sets `eventType` to the appropriate `pushTracking.*` value and includes `pushNotificationTracking` exactly as today, **plus** the canonical `_adobecmteas` tenant block (visitorDetails / authentication / channelInfo / identities, populated from the profile and identityMap exactly like every other builder).
4. **Remove** the bogus `application: { launches: { value: 1 } }` — `application.launches` is owned by the Lifecycle extension (Task 5); incrementing it on every push tap inflates the metric.
5. In `app/_layout.tsx`, replace the inline `trackingEvent` with `await buildPushTrackingEvent(...)` and send via `Edge.sendEvent(...)` as an `ExperienceEvent` instance.

**Caller readiness:** the push response handler fires from the OS notification path, which may run before the Identity SDK is fully initialized. Mirror the guard pattern in `cart.tsx` / `Checkout.tsx`: if `identityMap` is empty, skip the tracking event and log — do **not** send a malformed event.

---

### Task 5 — Lifecycle metrics (wiki item 7)

**File:** `app/_layout.tsx`

The schema includes both `experienceevent-application` and `aep-mobile-lifecycle-details`, which populate CJA's Launches / Installs / Upgrades / Users / session-length tiles. The Lifecycle extension is registered (see `MobileCore.registerExtensions` in `src/utils/adobeConfig.ts`) but `lifecycleStart()` is never invoked, so the SDK never produces a Lifecycle event.

**Migration steps:**

1. After `await configureAdobe(appId)` succeeds (line 78), call `MobileCore.lifecycleStart({})`. The empty additional-data map is fine for v1; can be enriched later if the bootcamp wants custom context keys.
2. Add an `AppState` listener inside the same `useEffect`:
   - On `change → 'background'` or `'inactive'` → `MobileCore.lifecyclePause()`
   - On `change → 'active'` from a non-active prior state → `MobileCore.lifecycleStart({})`
3. Clean up the listener in the existing `return () => { ... }` teardown.
4. Confirm the bogus manual `application.launches` increment is gone (covered by Task 4).

**Validation:** open Assurance, kill and relaunch the app, confirm a `lifecycle.foregroundDetails` event appears and `application.launches.value` becomes non-zero in the CJA dataset.

---

### Task 6 — Assurance base URL display (wiki item 5)

**File:** `app/(techScreens)/AssuranceView.tsx`

The session URL input shows placeholder `"myapp://"`. The app's actual deep-link scheme is `com.AEPSampleAppNewArchEnabled://` (confirmed against `_layout.tsx` push deep-link handler, line 193). Users have no easy way to discover or copy it.

**Migration steps:**

1. Add a read-only labeled row above the existing `TextInput` showing the literal string `com.AEPSampleAppNewArchEnabled://`.
2. Add an inline copy button that calls `Clipboard.setStringAsync` (already a transitive dep via `expo`) and shows a transient confirmation (existing `Alert` is fine; a snackbar/toast pattern isn't worth introducing for one screen).
3. Update the placeholder on the existing `TextInput` to a concrete example session URL fragment (`...?adb_validation_sessionid=...`) so students aren't tempted to paste the base URL alone.

This task touches one file and does not interact with any other migration step.

---

### Task 7 — Test and fixture updates

**Files:** `src/utils/__tests__/xdmEventBuilders.test.ts`, `src/utils/__tests__/xdmCjaPathsNonBlank.test.ts`

> **Full test spec lives in §6 (Per-bug test matrix).** This task is the narrow set of edits to the **existing** test files. The **new** test files (`xdmPushTracking.test.ts`, `AssuranceView.test.tsx`, `lifecycle.test.tsx`) are scoped under their respective Tasks (4, 6, 5) and detailed in §6.5 / §6.4 / §6.6.

The test suite encodes the **old** values and will fail the moment Task 1 / Task 2 / Task 3 land. Update in lock-step (do not commit any builder change without the matching test change, because CI gates on green).

**`xdmEventBuilders.test.ts`**

- Line 139 — `expect(... transactionType).toBe('purchase')` → `'Lower Funnel'`.
- Add a new assertion that `xdmData._adobecmteas.visitorDetails.visitorType === 'Customer'` for the authenticated cart-view test and `'Prospect'` when `profile` is omitted.
- Add a `productCategories` shape assertion on the cart-view test fixture (after Task 3 lands).

**`xdmCjaPathsNonBlank.test.ts`**

- Remove the two `buildProductInteractionEvent` test cases (lines 177–204) when the builder itself is deleted in Task 8.
- Update `expectPathNonBlank(xdmData, 'web.webInteraction._adobecmteas.engagement.transactionType')` on the purchase test to additionally assert the value is `'Lower Funnel'` (currently it only checks non-blank, which would mask a regression).
- Add new path-coverage tests for the cart-view and product-view `transactionType` emissions added by Task 1b.
- Add a path-coverage test for `productListItems.0.productCategories.0.categoryName` on the add-to-cart and purchase builders (Task 3).

**New test file (recommended):** `src/utils/__tests__/xdmPushTracking.test.ts`

- Cover the new `buildPushTrackingEvent` builder added in Task 4: assert `_adobecmteas` is present, `eventType` matches the input, `pushNotificationTracking.pushProvider` is set, and the bogus `application.launches` field is **not** emitted.

---

### Task 8 — Remove dead `buildProductInteractionEvent`

**Files:** `src/utils/xdmEventBuilders.ts`, `src/utils/__tests__/xdmCjaPathsNonBlank.test.ts`

`buildProductInteractionEvent` (lines 669–741 in current `xdmEventBuilders.ts`) is **not called from any UI screen**. Grep across `app/` returns zero hits. Cart quantity changes go through `CartContext.incrementQuantity` / `decrementQuantity` (synchronous state mutation, no XDM event). Cart remove goes through `buildProductRemovalEvent` from `cart.tsx`.

The wiki canonical `transactionType` list does **not** include "cart quantity change" or "remove from cart" as named events, so wiring this builder up to fire those events would be inventing reporting categories without backlog authority.

**Migration steps:**

1. Delete `buildProductInteractionEvent` and its `ProductInteractionParams` interface from `xdmEventBuilders.ts`.
2. Delete the two `buildProductInteractionEvent` cases from `xdmCjaPathsNonBlank.test.ts` and remove the import.
3. Confirm no remaining import references with a final grep — should be zero hits across the repo.

If the bootcamp team later decides cart-update tracking is needed, re-add a purpose-built builder with the canonical transactionType decided then. Resurrecting dead code as a placeholder is not the right shape.

---

### Task 9 — Documentation refresh

**Files:** `docs/Commerce-Fields-Coverage.md`, `docs/Automated-Checks-For-QA-Use-Cases.md`, `AGENTS.md` (if it mentions transactionType / Guest)

After Tasks 1–8 land, update the docs that snapshot the schema state:

- `Commerce-Fields-Coverage.md` — the table currently says `commerce.productListUpdates.value` is sent via `buildProductInteractionEvent`. After Task 8 that row is wrong; remove it. Add a row noting `productListItems[].productCategories` is now emitted.
- `Automated-Checks-For-QA-Use-Cases.md` — row 2 (Purchase) says automated checks verify `transactionType: 'purchase'`. Update to `'Lower Funnel'`.
- `AGENTS.md` — quick grep for `Guest`, `transactionType`, `add_to_cart` and rewrite any prescriptive text to the new canon.

---

## 5. Execution order

The constraint is that **`xdmEventBuilders.ts` is touched by Tasks 1, 2, 3, 4, and 8**. To avoid multiple passes over the same file (and unreadable diffs), bundle the builder edits into one PR per logical concern, but plan around a single working session on that file.

| Step | Tasks | Files | Verification |
|---|---|---|---|
| 1 | Task 8 (delete dead code) | `xdmEventBuilders.ts`, `xdmCjaPathsNonBlank.test.ts` | `npm run test:ci` green; grep for `buildProductInteractionEvent` returns zero. |
| 2 | Tasks 1 + 2 (values) + Task 7 partial (test updates for these) | `xdmEventBuilders.ts`, both test files, `cart.tsx` / `Checkout.tsx` log strings | `npm run test:ci` green; manual Assurance check that one product-view event shows `transactionType: 'Upper Funnel'` and one logged-out page view shows `visitorType: 'Prospect'`. |
| 3 | Task 3 (productCategories) + Task 7 remainder | `xdmEventBuilders.ts`, `CartContext.tsx`, 3 screen files, test files | Assurance: open a product page, add to cart, checkout — confirm `productListItems[0].productCategories` contains both primary and secondary entries for catalog products and primary-only for AJO offers / decisioning items. |
| 4 | Task 4 (push `_adobecmteas`) | `xdmEventBuilders.ts` (new builder), `_layout.tsx`, new test file | Assurance: tap a push notification, confirm the resulting `pushTracking.applicationOpened` event has `_adobecmteas` and no longer triggers the "required key [_adobecmteas] not found" streaming error. |
| 5 | Task 5 (lifecycle) | `_layout.tsx` | Assurance: kill app and relaunch, confirm `lifecycle.foregroundDetails` event appears; CJA Launches tile starts incrementing. |
| 6 | Task 6 (Assurance base URL UI) | `AssuranceView.tsx` | Manual on device: base URL renders and copy button writes to clipboard. |
| 7 | Task 9 (docs) | `Commerce-Fields-Coverage.md`, `Automated-Checks-For-QA-Use-Cases.md`, `AGENTS.md` | Diff review only — no runtime impact. |

Steps 1–3 are tightly coupled and should ship as a single PR or a stacked set of three small PRs landed back-to-back. Steps 4, 5, 6 are independent and may ship in parallel. Step 7 closes out the change.

---

## 6. Per-bug test matrix

Each wiki backlog item that this plan addresses gets:

- **A. Automated test** — a Jest test in `src/utils/__tests__/` that fails today against the current code and passes after the fix. Owned alongside the production change (same PR).
- **B. Manual reproduction** — exact device steps to capture an Assurance event and the specific field assertions to make against it. This is what you run to **confirm the fix worked in a live session** before closing the ticket.
- **C. Pass criteria** — the observable outcome that proves the bug is closed.

Run automated tests with `npm run test:ci` from the repo root (PowerShell). Run manual checks against an Assurance session — start one from the app's Technical View → Assurance screen using a fresh session URL from your Assurance project.

> No file under `src/utils/__tests__/` currently covers any of the canonical values, productCategories, push tracking, or lifecycle — so every "A. Automated" entry below is a **new** test, not an update to an existing assertion.

### 6.1 Bug 2 — Canonical `transactionType` values (Task 1)

**A. Automated**

Add to `src/utils/__tests__/xdmEventBuilders.test.ts`:

```ts
const txCases = [
  ['buildCheckoutEvent',       'Lower Funnel'],
  ['buildPurchaseEvent',       'Lower Funnel'],
  ['buildProductListAddEvent', 'Upper Funnel'],
  ['buildProductViewEvent',    'Upper Funnel'],
  ['buildLoginEvent.success',  'Authentication'],
  ['buildLoginEvent.failure',  'Authentication'],
  ['buildLogoutEvent',         'Authentication'],
] as const;
test.each(txCases)('%s emits transactionType=%s', async (builder, expected) => {
  const { xdmData } = await invoke(builder);   // small helper picks the right builder + args
  expect(xdmData.web?.webInteraction?._adobecmteas?.engagement?.transactionType).toBe(expected);
});

it('cart page view emits transactionType=Upper Funnel', async () => {
  const { xdmData } = await buildPageViewEvent({
    identityMap, profile, pageTitle: 'Cart', pagePath: '/cart',
    pageType: 'cart', cartSessionId: 'c1', productListItems: [],
  });
  expect(xdmData.web?.webInteraction?._adobecmteas?.engagement?.transactionType).toBe('Upper Funnel');
});
```

**Today's state:** all 8 assertions fail. Current emissions: `'checkout'`, `'purchase'`, `'add_to_cart'`, `(missing)`, `'login_success'`, `'login_failure'`, `'logout'`, `(missing on cart view)`.

**B. Manual reproduction (Assurance)**

1. Start Assurance session from the app. In the events pane, filter by `eventType` starts-with `commerce.` or `mobileApp.navigation.`.
2. Walk this device sequence:
   1. Logged out home → tap a category → tap a product (event: `commerce.productViews`)
   2. Tap "Add to Cart" (event: `commerce.productListAdds`)
   3. Tap the Cart tab (event: `mobileApp.navigation.pageViews` with `pageType: 'cart'`)
   4. Tap "Checkout" (event: `commerce.checkouts`)
   5. Tap "Pay Now" (event: `commerce.purchases`)
   6. Profile → Log In with a real-looking email (event: `mobileApp.navigation.clicks` with login success branch)
   7. Profile → Log Out (event: `mobileApp.navigation.clicks` with logout branch)
3. For each captured event, expand the XDM payload in Assurance and copy `web.webInteraction._adobecmteas.engagement.transactionType`.

**C. Pass criteria**

Every value above is in {`Lower Funnel`, `Upper Funnel`, `Authentication`}. **Zero** events with old raw values (`checkout`, `purchase`, `add_to_cart`, `login_success`, `login_failure`, `logout`).

---

### 6.2 Bug 3 — Guest → Prospect (Task 2)

**A. Automated**

Add to `xdmEventBuilders.test.ts` — parametric over every builder:

```ts
it.each(allBuilders)('%s emits Prospect/not-logged-in/prospect when unauthenticated', async (builder) => {
  const { xdmData } = await invoke(builder, { profile: undefined });
  expect(xdmData._adobecmteas.visitorDetails.visitorType).toBe('Prospect');
  expect(xdmData._adobecmteas.authentication.loginStatus).toBe('not-logged-in');
  expect(xdmData._adobecmteas.channelInfo.participantName).toBe('prospect');
});

it.each(allBuilders)('%s emits Customer/logged-in when profile.firstName present', async (builder) => {
  const { xdmData } = await invoke(builder, { profile: { firstName: 'Alex', email: 'a@b.com' } });
  expect(xdmData._adobecmteas.visitorDetails.visitorType).toBe('Customer');
  expect(xdmData._adobecmteas.authentication.loginStatus).toBe('logged-in');
});
```

Plus a guard test that no XDM payload anywhere contains the literal string `'Guest'`:

```ts
it('no builder emits the legacy value "Guest"', async () => {
  for (const builder of allBuilders) {
    const { xdmData } = await invoke(builder, { profile: undefined });
    expect(JSON.stringify(xdmData)).not.toContain('Guest');
    expect(JSON.stringify(xdmData)).not.toContain('"guest"');
  }
});
```

**B. Manual reproduction**

1. Fresh install (or clear app data — Android: Settings → App → Storage → Clear Data; iOS: delete & reinstall) so no stored profile exists.
2. Start an Assurance session, walk the main flows without logging in.
3. For each event, inspect `_adobecmteas.visitorDetails.visitorType`, `_adobecmteas.authentication.loginStatus`, `_adobecmteas.channelInfo.participantName`.
4. Profile → Log In, browse a few more screens.
5. Profile → Log Out, browse a few more screens.

**C. Pass criteria**

| State | `visitorType` | `loginStatus` | `participantName` |
|---|---|---|---|
| Pre-login | `Prospect` | `not-logged-in` | `prospect` |
| Post-login | `Customer` | `logged-in` | first name (lowercased) |
| Post-logout | `Prospect` | `not-logged-in` (or `logged-out` on the logout event itself) | `prospect` |

**Zero** events anywhere in the captured session contain `Guest`, `guest`, or `guest user` in any of those fields.

---

### 6.3 Bug 4 — `productCategories` on `productListItems` (Task 3)

**A. Automated**

Add to `src/utils/__tests__/xdmCjaPathsNonBlank.test.ts` (or a new `productCategories.test.ts`):

```ts
it('catalog products emit both primary and secondary categories', async () => {
  const { xdmData } = await buildProductListAddEvent({
    identityMap, profile,
    product: { sku: 'eqsusuchd', name: 'Chasing Tail Surfboard', price: 785,
               category: 'Equipment', secondaryCategory: 'Surfing', quantity: 1 },
    cartSessionId: 'c1',
  });
  expect(xdmData.productListItems[0].productCategories).toEqual([
    { categoryID: 'primaryCategory',   categoryName: 'Equipment' },
    { categoryID: 'secondaryCategory', categoryName: 'Surfing'   },
  ]);
});

it('AJO offers emit only primaryCategory (no secondary)', async () => {
  const { xdmData } = await buildProductListAddEvent({
    identityMap, profile,
    product: { sku: 'offer-1', name: 'Promo', price: 19.99, category: 'offers', quantity: 1 },
    cartSessionId: 'c1',
  });
  expect(xdmData.productListItems[0].productCategories).toEqual([
    { categoryID: 'primaryCategory', categoryName: 'offers' },
  ]);
});

it('every builder that emits productListItems emits a non-empty productCategories array', async () => {
  for (const builder of buildersThatEmitProductListItems) {
    const { xdmData } = await invoke(builder);
    for (const item of xdmData.productListItems) {
      expect(item.productCategories?.length).toBeGreaterThan(0);
    }
  }
});
```

**B. Manual reproduction**

1. Start Assurance session.
2. Open a catalog product with known categories — **Chasing Tail Surfboard** (SKU `eqsusuchd`, primary `Equipment`, secondary `Surfing`).
3. Inspect `commerce.productViews` event → `productListItems[0].productCategories`.
4. Tap Add to Cart → inspect `commerce.productListAdds`.
5. Tap Cart tab → inspect `mobileApp.navigation.pageViews` (with `pageType: 'cart'`) → `productListItems[].productCategories` on each entry.
6. Tap Checkout → inspect `commerce.checkouts`.
7. Tap Pay Now → inspect `commerce.purchases`.
8. Separately, open the Offers tab and add an AJO offer → inspect `commerce.productListAdds` for that offer.

**C. Pass criteria**

- Every catalog-product event emits `productCategories` with both `primaryCategory` (e.g. `Equipment`) and `secondaryCategory` (e.g. `Surfing`).
- AJO offer / decisioning add-to-cart events emit `productCategories` with **only** the `primaryCategory` entry.
- Zero events emit `productListItems` without a `productCategories` array.

---

### 6.4 Bug 5 — Assurance base URL display (Task 6)

**A. Automated**

New test file `app/(techScreens)/__tests__/AssuranceView.test.tsx`:

```ts
import { render, fireEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import AssuranceView from '../AssuranceView';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

it('renders the app base URL above the session input', () => {
  const { getByText } = render(<AssuranceView />);
  expect(getByText('com.AEPSampleAppNewArchEnabled://')).toBeTruthy();
});

it('copies the base URL to the clipboard when the copy button is tapped', () => {
  const { getByLabelText } = render(<AssuranceView />);
  fireEvent.press(getByLabelText('Copy app base URL'));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('com.AEPSampleAppNewArchEnabled://');
});
```

**B. Manual reproduction**

1. Open the app on device. Drawer → Technical View → Assurance.
2. Confirm `com.AEPSampleAppNewArchEnabled://` is displayed as a labeled read-only value above the session URL input.
3. Tap the copy button. Confirm visual feedback ("Copied" alert or toast).
4. Paste into the session URL input (long-press → Paste) → confirm the pasted text is exactly `com.AEPSampleAppNewArchEnabled://`.

**C. Pass criteria**

- Base URL visible on first render of the screen.
- Copy button writes exactly `com.AEPSampleAppNewArchEnabled://` to the system clipboard.

---

### 6.5 Bug 6 — `_adobecmteas` missing on push tracking (Task 4)

**A. Automated**

New file `src/utils/__tests__/xdmPushTracking.test.ts`:

```ts
describe('buildPushTrackingEvent', () => {
  it('includes _adobecmteas tenant block and full XDM envelope', async () => {
    const { xdmData } = await buildPushTrackingEvent({
      identityMap: { ECID: [{ id: 'ecid-1' }] },
      profile: { firstName: 'Test', email: 'test@example.com' },
      pushProvider: 'fcm',
      pushProviderMessageID: 'msg-123',
      interaction: 'opened',
    });
    expect(xdmData._adobecmteas).toBeDefined();
    expect(xdmData._adobecmteas.visitorDetails?.visitorType).toBe('Customer');
    expect(xdmData._adobecmteas.authentication?.loginStatus).toBe('logged-in');
    expect(xdmData._adobecmteas.channelInfo?.channel).toBe('Mobile App');
    expect(xdmData._id).toEqual(expect.any(String));
    expect(xdmData.timestamp).toEqual(expect.any(String));
    expect(xdmData.identityMap).toBeDefined();
    expect(xdmData.eventType).toBe('pushTracking.applicationOpened');
  });

  it('does NOT emit synthetic application.launches', async () => {
    const { xdmData } = await buildPushTrackingEvent({ /* ... */ });
    expect(xdmData.application?.launches).toBeUndefined();
  });

  it('emits customAction.actionID when interaction is customAction', async () => {
    const { xdmData } = await buildPushTrackingEvent({
      /* ... */, interaction: 'customAction', actionID: 'reply',
    });
    expect(xdmData.eventType).toBe('pushTracking.customAction');
    expect(xdmData.pushNotificationTracking.customAction.actionID).toBe('reply');
  });
});
```

Also delete or rewrite any existing test that asserts the bare `application.launches` shape on push (none in current main, but worth a grep for `pushTracking` in tests).

**B. Manual reproduction**

1. From AJO, copy an Assurance push debug session URL (or use an existing AJO push test campaign).
2. On device: Technical View → Assurance → paste session URL → Start Session.
3. Send a test push from AJO targeting that device (or use the AJO send-test flow).
4. When the push lands on device, tap to open it.
5. In Assurance, find the resulting `pushTracking.applicationOpened` event.
6. Open the XDM payload and confirm:
   - `_adobecmteas` exists at top level with `visitorDetails`, `authentication`, `channelInfo`, and `identities` sub-objects.
   - `_id` is a non-empty string.
   - `timestamp` is an ISO 8601 datetime.
   - `identityMap` has at least an ECID entry.
   - `application.launches` is **not** present (that field is owned by the Lifecycle extension after Task 5).
7. In Assurance's **Validation** tab for that event, confirm zero schema errors.
8. Look for the downstream **Edge Network Hit** event paired to this client event — it should appear in the session within a few seconds.

**C. Pass criteria**

- Push tracking event has the full XDM envelope (`_id`, `timestamp`, `identityMap`, `_adobecmteas`).
- Assurance validation shows zero `required key [_adobecmteas] not found` errors.
- The downstream Edge Network Hit confirmation event appears (the absence of which was wiki item 6's secondary complaint).
- The pre-fix wiki error count for this session drops to zero post-fix.

---

### 6.6 Bug 7 — Lifecycle metrics (Task 5)

**A. Automated**

This bug is a wiring change in `app/_layout.tsx`, which makes pure unit testing awkward because of the React Native + expo-router boot. The closest practical check:

```ts
// app/__tests__/lifecycle.test.tsx (new)
import { render, waitFor } from '@testing-library/react-native';
import { MobileCore } from '@adobe/react-native-aepcore';
import RootLayout from '../_layout';

jest.mock('@adobe/react-native-aepcore', () => ({
  MobileCore: { lifecycleStart: jest.fn(), lifecyclePause: jest.fn(), setLogLevel: jest.fn() },
  LogLevel: { VERBOSE: 'VERBOSE' },
}));
// ...mock configureAdobe, getStoredAppId, expo-router/drawer, push service, etc.

it('calls MobileCore.lifecycleStart after configureAdobe resolves', async () => {
  render(<RootLayout />);
  await waitFor(() => expect(MobileCore.lifecycleStart).toHaveBeenCalledWith({}));
});

it('calls MobileCore.lifecyclePause when AppState transitions to background', async () => {
  /* exercise the AppState change listener registered by RootLayout */
});
```

If mocking the full RootLayout boot is too costly, extract the lifecycle wiring into a small `setupLifecycleTracking(appState)` helper in `src/utils/lifecycleTracking.ts` and unit-test that instead. Either way, document that **the device-level Lifecycle SDK behavior itself is not unit-testable** — Step B is what proves the fix.

**B. Manual reproduction**

1. Clear app data (Android: Settings → App → Storage → Clear Data; iOS: delete & reinstall).
2. Start an Assurance session — easiest path is to keep the saved Assurance URL from a prior session in AsyncStorage (Technical View → Assurance still shows it after data clear if AsyncStorage survives; otherwise re-paste after first launch and restart).
3. Launch the app fresh. Within ~10 seconds, expect a `lifecycle.foregroundDetails` event in Assurance with:
   - `application.isLaunch: true`
   - `application.isInstall: true` (first install only)
   - `application.firstLaunches.value: 1`
4. Background the app (home button). Expect a Lifecycle pause event (or simply no further foreground events).
5. Wait 30+ seconds (Lifecycle session timeout default), then return to foreground. Expect another `lifecycle.foregroundDetails` with `application.launches.value: 1` and `application.isLaunch: true` (but `isInstall: false`).
6. In CJA, give the dataset 15–30 minutes to ingest, then open the OOTB CJA template tile for Launches / Users / Installs.

**C. Pass criteria**

- Lifecycle events appear in Assurance on launch and after background→foreground transitions.
- CJA tiles for Launches, Users, Installs become non-zero within a reporting window (vs. the all-zero screenshot in the wiki backlog item 7).

---

### 6.7 Reference golden payloads

For developers who want a known-good shape to diff against, `docs/schema-sample-Mobile Interactions.json` contains the canonical sample emitted by Adobe's schema sample generator. Treat it as illustrative (it includes optional fields the app does not necessarily emit) but the field paths and nesting are authoritative.

### 6.8 Pre-fix baseline capture procedure

Before any of Tasks 1–5 land, capture a baseline so you can prove the fix landed.

1. Start a new Assurance session named `pre-fix-YYYY-MM-DD` (date the day you start the migration).
2. Walk the full device sequence from §6.1 step 2 (login → product view → add → cart → checkout → purchase → logout).
3. Also tap a push notification per §6.5 step 4 and trigger a cold launch per §6.6 step 3 so the baseline covers every bug.
4. Export the Assurance session as JSON (Assurance UI → ⋮ → Download).
5. Stash the file in `docs/baselines/pre-fix-YYYY-MM-DD.json`. The `docs/baselines/` directory should be added to `.gitignore` if exported sessions contain real identifiers; keep them locally for diffing.
6. After Tasks 1–5 land, repeat with a session named `post-fix-YYYY-MM-DD` and diff the two.

The diff should demonstrate, side by side:

- Zero old `transactionType` raw values remain.
- Zero `Guest` / `guest user` strings remain in any XDM payload.
- Every `productListItems[]` entry has a non-empty `productCategories` array.
- The push tracking event has `_adobecmteas` + `_id` + `timestamp` + `identityMap`.
- New `lifecycle.foregroundDetails` events appear on launch.
- Assurance schema-validation error count drops to zero.

---

## 7. Cross-cutting validation

§4 lists per-task verification. §6 lists per-bug repros. **This section is the aggregate sign-off** — checks that span all bugs at once. Run after every per-bug repro has passed.

1. **Full Jest suite green.** From the repo root: `npm run test:ci`. All new tests added under §6 must pass; no existing test was disabled to make the migration ship.
2. **iOS + Android device sweep.** Walk the full consumer flow once per platform (login → browse → add → cart → checkout → purchase → logout, plus a push tap and a cold launch). For every captured event:
   - `_id`, `timestamp`, `identityMap`, `_adobecmteas` are all present.
   - `_adobecmteas.visitorDetails.visitorType` is `Customer` or `Prospect` — never `Guest`.
   - Any `web.webInteraction._adobecmteas.engagement.transactionType` is in {`Lower Funnel`, `Upper Funnel`, `Authentication`} — never `checkout`, `purchase`, `add_to_cart`, `login_success`, `login_failure`, `logout`.
   - Every `productListItems[]` entry has a non-empty `productCategories[]` array.
3. **Schema validation error count = 0.** Assurance → Validation tab for the captured session. Compare against the pre-fix baseline (§6.8). Specifically the `required key [_adobecmteas] not found` count must be zero post-fix.
4. **Edge Network Hit event coverage.** Every Track event in the session has a matching downstream Edge Network Hit event. Pre-fix this was failing for push tracking (wiki item 6); post-fix it should be 1:1.
5. **CJA tile sanity.** After Task 5 lands and a handful of real device launches accumulate (15–30 minute ingestion window):
   - "Launches" tile is non-zero.
   - "Users" tile is non-zero.
   - "Installs" tile reflects at least the device(s) used during this verification.
6. **AEP-side checklist (§3.6) signed off.** Schema, dataset, datastream, Tags property all confirmed on the target version; cut-over option (§3.5) executed; baseline captured.

If any of 1–6 fails, do not merge — the migration is partial and downstream reporting will inherit the gap.

---

## 8. Out of scope

- **Wiki item 1 — POS schema + Mockaroo automation.** Bootcamp data-generation tooling, no mobile code involved. Hand back to whoever owns the bootcamp data pipeline.
- **Wiki item 8 — Push bounce rate.** Diagnostic question that needs Assurance push-debug session data to investigate. Track as a separate ticket; do not merge into this migration.
- **Edge Network "Track events missing Edge Network Hit event" warning** — secondary symptom of item 6. Should clear once Task 4 resolves the validation error. If it persists after Task 4, open a follow-up to investigate Edge configuration in Launch / Tags (not an app code issue).
- **Email hash identity (`_adobecmteas.identities.hashedEmail`).** Schema exposes the field; app doesn't compute or send it today. The wiki doesn't ask for it. Leave as a future enhancement.
