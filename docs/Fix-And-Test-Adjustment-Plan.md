# Fix and Test Adjustment Plan

This document is a practical plan for closing the gaps identified in [QA-Use-Cases-Review.md](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/docs/QA-Use-Cases-Review.md).

## Executive View

The remaining gaps fall into three buckets:

1. process / configuration gaps
2. app behavior gaps
3. reporting-definition gaps

Practical priority:

1. keep push registration and validation stable
2. clarify purchase journey channel behavior
3. improve decisioning freshness behavior
4. align CJA cart reporting to the XDM the app already sends

## 1. Call Center Push

### Current issue

Push can still show as bounced when Adobe profile/token state is stale or when setup order is wrong.

### Root causes to address

- App ID must already be configured before push registration works
- reinstall / token rotation can leave Adobe with an old token
- repo docs can drift from the actual token type used by the app

### Product / app adjustments

- Keep Adobe token registration in the normal push lifecycle
- Keep startup re-registration for an existing valid token
- Keep Android token refresh handling
- Treat missing App ID as a hard blocker in the push flow

### QA / process adjustments

Standard test sequence:

1. Clear app data or reinstall
2. Configure Adobe App ID
3. Start Assurance
4. Request push permissions / token
5. Verify the token auto-registers with Adobe
6. Verify the same token in Assurance before triggering the journey

### Exit criteria

- Fresh install registers push successfully
- Assurance shows the same active device token
- Reinstall / retest does not leave the profile in a permanently bounced state

## 2. Purchase In-App Journey

### Current issue

The app sends `commerce.purchases`, but post-purchase experience rendering still depends on whether the journey is using classic in-app messaging or a code-based experience surface.

### Root causes to address

- journey entrance conditions may not exactly match emitted XDM
- purchase-triggered refresh may happen too early
- QA may test the wrong channel or wrong configured surface
- QA may mix up journey entry with content rendering

### Product / app adjustments

- Decide the intended channel for the use case
- If classic in-app, keep `refreshInAppMessages()` and consider a delayed retry
- If code-based experience, keep the existing post-purchase surface refresh and verify the stored surface is the correct one
- Log purchase send, refresh start, and content response checkpoints

### QA / process adjustments

- Verify the exact XDM contract for journey entry
- In Assurance, confirm the purchase event reaches Edge before deciding the journey failed
- In AJO, document whether this use case is classic in-app or code-based experience

### Exit criteria

- Purchase event is visible in Assurance consistently
- Journey qualification is observable
- Post-purchase content renders reliably in the expected place

## 3. Cart Views in CJA

### Current issue

The app sends cart page views, but CJA may be expecting a metric definition that does not match the actual XDM.

### Root causes to address

- there is no literal `Cart Views` event in the app
- CJA metric may not be mapped to the cart page-view context that already exists
- report filters or date ranges may exclude valid events
- cart page-view emission still depends on runtime readiness

### Product / app adjustments

- Later hardening: make cart page-view emission more deterministic
- Keep a simple Assurance verification target for cart page views

### QA / process adjustments

- Redefine `Cart Views` in CJA from the event actually sent by the app
- Validate that the Data View includes the cart page fields needed for the metric
- Confirm the dataset / connection used by CJA matches the Edge dataset receiving mobile events

### Exit criteria

- Opening Cart generates a visible Assurance event
- CJA metric definition matches the XDM already in use
- Report counts move during test runs

## 4. Decisioning

### Current issue

Decisioning can feel inconsistent because cached propositions can mask newer server results briefly, surface configuration can drift from AJO, and purchase-driven refreshes can still race journey evaluation timing.

### Root causes to address

- cache-plus-refresh logic can still show stale content briefly before the server response lands
- timing between purchase event delivery and personalization refresh is not guaranteed
- some docs still describe older behavior and can mislead QA
- surface mismatch and content-shape mismatch are still possible

### Product / app adjustments

- Keep the current cache-plus-server-refresh behavior
- Keep the current post-purchase decisioning surface refresh
- Add lightweight UI state for cache result, server refresh, and last successful update
- Tighten proposition parsing expectations

### QA / process adjustments

- Record the exact surface name used in the app and the exact surface configured in AJO
- Validate first launch, cached reopen, and post-purchase scenarios separately

### Exit criteria

- Stale offers do not persist simply because cache exists
- Propositions can be refreshed on demand and after purchase
- The same surface consistently returns expected content in Assurance and in the app

## Delivery Plan by Phase

### Phase 1: Documentation and QA alignment

- update push testing instructions to match automatic token behavior
- document exact purchase journey channel type
- redefine CJA cart metric against actual XDM
- keep a repeatable device reset / clean-test checklist

### Phase 2: Instrumented validation

- run Android and iOS test passes with Assurance open
- capture screenshots and Assurance evidence for each use case
- classify each remaining issue as config, QA flow, or client behavior

### Phase 3: App fixes

- improve purchase-triggered refresh handling
- harden cart page-view firing
- add messaging refresh after consent or profile changes when in-app qualification depends on those updates

## Test Notes

### Push

- test after reinstall
- test after clearing Adobe push tokens
- verify the token auto-registers after permission / token retrieval
- test Android and iPhone separately because token source differs

### Purchase Journey

- confirm the purchase event in Assurance first
- then confirm rendered content behavior
- repeat once with an immediate post-purchase wait and once after navigating to the expected destination screen

### Cart Views

- open Cart from multiple entry points
- confirm the Assurance event each time
- compare against CJA after the expected processing window

### Decisioning

- test no-cache first run
- test cached second run
- test after purchase
- verify the exact surface name each time
