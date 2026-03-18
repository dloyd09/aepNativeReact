# Decisioning and Offers Consumer QA

This document is an updated implementation review of the consumer-facing decisioning surfaces in this app as of 2026-03-17. It focuses on:

- `app/(consumerTabs)/decisioningItems.tsx`
- `app/(consumerTabs)/offers.tsx`
- supporting technical screens and checkout behavior that affect consumer personalization

It complements [QA-Use-Cases-Review.md](QA-Use-Cases-Review.md) and [Fix-And-Test-Adjustment-Plan.md](Fix-And-Test-Adjustment-Plan.md).

## 1. Current alignment summary

### 1.1 Decisioning Items consumer tab

Overall, the current `decisioningItems.tsx` implementation is directionally aligned with the intended Adobe Journey Optimizer Code-Based Experience pattern:

- shared config is loaded from `@decisioning_items_config`
- initial load is cache-first via `Messaging.getPropositionsForSurfaces`
- server refresh uses `Messaging.updatePropositionsForSurfaces`
- embedded JSON content (`isJsonContent`) is unpacked into individual cards
- proposition display and click/interact tracking are attempted through the SDK first, with a manual Edge fallback

That said, there are still important framework and QA gaps that can produce stale content, duplicate display tracking, and skipped analytics when identity or session state is not ready.

### 1.2 Offers consumer tab

The current `offers.tsx` implementation is now broadly aligned with the intended Optimize pattern.

What is aligned:

- it reads the decision scope from the same AsyncStorage key used by `OptimizeView.tsx`
- it refreshes propositions from Edge with `Optimize.updatePropositions`
- it reads propositions with `Optimize.getPropositions`
- it registers an `Optimize.onPropositionUpdate` listener that uses a ref-backed current scope
- it sends page-view and add-to-cart XDM events
- it tracks proposition display via `FlatList` viewability
- it tracks proposition interaction before add-to-cart logic runs
- it guards missing images with a placeholder

What is not aligned:

- refresh still depends on a valid stored decision scope
- proposition visibility tracking is session-based and should still be validated in Assurance
- identity readiness still depends on runtime refreshes before analytics events are emitted

The Offers tab no longer depends on another screen warming the cache first. The remaining risk is mostly around scope correctness, identity readiness, and validating reporting fidelity in Assurance.

## 2. Decisioning Items review

### 2.1 What matches the documented approach

Verified in [app/(consumerTabs)/decisioningItems.tsx](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx):

- Focus load reads config and fetches items on tab entry at [app/(consumerTabs)/decisioningItems.tsx:526](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L526)
- Cache read happens in `getCachedDecisioningItems()` at [app/(consumerTabs)/decisioningItems.tsx:629](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L629)
- Server refresh happens in `fetchDecisioningItemsFromServer()` at [app/(consumerTabs)/decisioningItems.tsx:666](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L666)
- Cache-first behavior is implemented in `fetchDecisioningItems()` at [app/(consumerTabs)/decisioningItems.tsx:720](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L720)
- Embedded offer handling with parent proposition item plus tracking token is implemented in `processPropositions()` at [app/(consumerTabs)/decisioningItems.tsx:748](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L748)
- Manual refresh calls the server path through `refreshDecisioningItems()` at [app/(consumerTabs)/decisioningItems.tsx:1124](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L1124)

Verified in [app/(techScreens)/DecisioningItemsView.tsx](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(techScreens)/DecisioningItemsView.tsx):

- Tech screen saves and validates the same config key
- Test connection calls `Messaging.updatePropositionsForSurfaces()` and then `Messaging.getPropositionsForSurfaces()` at [app/(techScreens)/DecisioningItemsView.tsx:187](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(techScreens)/DecisioningItemsView.tsx#L187)

### 2.2 Confirmed gaps

1. Stale content can still appear briefly on tab open.
The current tab reads cached propositions first and then refreshes from Edge on focus. That is directionally correct, but it still means the user can momentarily see cached content before the fresh server response lands.

2. Display tracking needs QA validation, not a new implementation.
The tab now tracks display through `FlatList` viewability rather than layout callbacks. The remaining work is to confirm in Assurance that counts are accurate and not inflated by re-render or scroll behavior.

3. Post-purchase decisioning refresh is now implemented.
Checkout refreshes in-app messages and also refreshes the stored decisioning surface after purchase in [app/(consumerTabs)/Checkout.tsx:175](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/Checkout.tsx#L175).

4. Identity readiness can suppress analytics.
The tab loads `identityMap` once on mount via `Identity.getIdentities()` at [app/(consumerTabs)/decisioningItems.tsx:515](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L515). If identities are updated later, page views and product-list-add events can be skipped because the local state is stale.

5. The initial focus flow is sequenced.
`handleFocus()` now awaits `loadConfigAndFetchItems()` before sending the page-view event at [app/(consumerTabs)/decisioningItems.tsx:381](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L381).

6. CTA routing is permissive and can fail quietly.
Unknown schemes fall through to `router.push(url as any)` in `handleCustomCTA()` at [app/(consumerTabs)/decisioningItems.tsx:1070](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/decisioningItems.tsx#L1070). The current doc was right to call this out.

### 2.3 Recommendations to remediate

1. Change initial load from cache-first-only to stale-while-revalidate.
Render cached items immediately, then always call `Messaging.updatePropositionsForSurfaces()` on focus and merge/replace state with the fresh response.

2. Replace `onLayout` display tracking with viewability-based tracking.
Use `FlatList` viewability callbacks and a tracked-id set so each proposition item is marked displayed once per render session unless a repeat-display rule is intentional.

3. Add explicit post-purchase decisioning refresh.
This is already implemented. Keep it, and validate timing behavior in QA rather than treating it as a missing feature.

4. Refresh or subscribe to identity state when focus events occur.
At minimum, re-read identities on focus before page-view and cart tracking. A more robust approach is to centralize identity readiness in shared state.

5. Tighten CTA handling.
Allow only known deep-link schemes, `http`, `https`, or explicit in-app route patterns. Log and surface unsupported values rather than silently attempting a push.

## 3. Offers review

### 3.1 What matches the documented approach

Verified in [app/(consumerTabs)/offers.tsx](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/offers.tsx):

- decision scope is loaded from AsyncStorage and shared with the technical Optimize screen at [app/(consumerTabs)/offers.tsx:224](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/offers.tsx#L224)
- offers are read from cache using `Optimize.getPropositions()` at [app/(consumerTabs)/offers.tsx:315](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/offers.tsx#L315)
- page view is sent on focus at [app/(consumerTabs)/offers.tsx:241](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/offers.tsx#L241)
- add-to-cart XDM is sent at [app/(consumerTabs)/offers.tsx:369](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(consumerTabs)/offers.tsx#L369)

### 3.2 Confirmed gaps

1. Offers still depends on valid scope configuration.
If the stored scope is missing or wrong, the tab correctly returns no offers. QA should treat scope accuracy as the first prerequisite.

2. Visibility tracking still needs QA validation.
The tab now tracks display through `FlatList` viewability, but Assurance should still confirm it produces the expected display events and avoids duplicate inflation.

3. Identity readiness remains a real dependency.
The tab refreshes identities before page-view and add-to-cart events, but those analytics can still be skipped when identity state is unavailable at runtime.

4. Reporting fidelity needs end-to-end validation.
The consumer tab now implements refresh plus interaction/display tracking, but Adobe-side reporting should still be verified against Assurance before declaring full alignment.

### 3.3 Recommendations to remediate

1. Keep the current Optimize request pattern and validate it in Assurance.
The consumer tab already refreshes from Edge and reads propositions locally.

2. Keep the ref-backed listener scope approach.
This is already in place and should remain the pattern if the tab evolves further.

3. Validate display and interaction counts in Assurance.
This is now a QA follow-up, not a missing implementation.

4. Improve failure visibility around invalid scope or missing ECID.
The current code logs these cases; product-facing QA would benefit from clearer on-screen status.

5. Continue hardening identity readiness.
This remains a cross-cutting concern for both Offers and Decisioning Items.

## 4. QA adjustments

### 4.1 Decisioning Items

Add these checks to the current QA pass:

- Verify whether tab-open shows cached content first and then refreshes from Edge. Current expected behavior is yes.
- Validate display tracking counts in Assurance while scrolling, re-rendering, rotating, and returning to the tab.
- After checkout, verify whether post-purchase decisioning refreshes automatically. Current expected behavior is yes, subject to journey timing.
- Verify page view and add-to-cart behavior when identity is established after initial mount.

### 4.2 Offers

Add these checks to the current QA pass:

- Verify whether Offers refreshes from Edge on tab focus and via the refresh button. Current expected behavior is yes when scope and ECID are valid.
- Check whether Assurance shows Optimize display and interaction tracking from the consumer tab. Current expected behavior is present, but it still needs validation.
- Re-test proposition updates after changing the decision scope in Technical -> Optimize. Current expected behavior is correct so long as the stored scope matches the authored scope.

## 5. Recommended implementation order

1. Reconcile docs and QA scripts with the current implementation.
2. Validate reporting fidelity in Assurance for both consumer tabs.
3. Harden identity readiness and CTA validation in both consumer tabs.
4. Improve user-facing error/status handling around missing scope, ECID, or malformed CTA values.

## 6. Bottom line

The Decisioning Items consumer tab is broadly aligned with the intended AJO CBE approach. Its main remaining risks are timing, transient stale content during cache-to-server refresh, identity/runtime readiness, and CTA hardening.

The Offers consumer tab is also broadly aligned with the intended Optimize approach. Its main remaining risks are:

- identity/runtime readiness
- QA confirmation of Adobe-side display/interact reporting
- user-facing handling of invalid setup states

Those gaps should be treated as remediation items, not just QA notes, because they affect both correctness and Adobe reporting fidelity.
