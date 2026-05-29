# Assurance Validation Report

---

## Session: 2026-05-27

**Date:** 2026-05-27
**Validated by:** David Loyd
**Session UUID:** `d3b92cf1-4e25-4486-9a3d-3df29806852e` (same long-running session)
**Sandbox:** `training`

> **Note on API lag:** The Assurance GraphQL pagination endpoint caches results and lags behind real-time streaming by up to several hours when a session has accumulated many events. New events in this session (token 7314+) were validated by inspecting raw payloads from the Assurance UI directly rather than via the fetch script.

---

### Login Event — `mobileApp.navigation.clicks` @ 2026-05-27T00:25:47Z

**Streaming validation result:** ✅ Accepted — `outputTopics: acp_data_xdm_dcs`

| Field | Value | Status |
|---|---|---|
| `_adobecmteas.identities.ecid` | `63745351...8517` | ✅ |
| `_adobecmteas.identities.emailAddress` | `Dtboards09@gmail.com` | ✅ |
| `_adobecmteas.identities.hashedEmail` | `ed288a60...498` | ✅ |
| `_adobecmteas.identities.mobilePhone` | `+18056122367` | ✅ |
| `_adobecmteas.authentication.loginStatus` | `logged-in` | ✅ |
| `_adobecmteas.authentication.signInSuccess` | `1` (int) | ✅ |
| `_adobecmteas.visitorDetails.visitorType` | `Customer` | ✅ |
| `_adobecmteas.channelInfo.channel` | `Mobile App` | ✅ |
| `_adobecmteas.channelInfo.participantName` | `david` | ✅ |
| `web.webPageDetails._adobecmteas.pageTitle/pagePath/pageType` | `Profile / /profile / profile` | ✅ |
| `web.webInteraction._adobecmteas.engagement.transactionType` | `Authentication` | ✅ |
| `identityMap.ECID` | present | ✅ |
| `identityMap.Email` | present, `authenticatedState: authenticated` | ✅ |
| `environment` | Android 16, `en-US`, `type: application` | ✅ |

**15/15 fields correct. No issues.**

---

### Logout Event — `mobileApp.navigation.clicks` @ 2026-05-27T00:57:30Z

**Streaming validation result:** ✅ Accepted — `outputTopics: acp_data_xdm_dcs`

| Field | Value | Status |
|---|---|---|
| `_adobecmteas.authentication.loggoffSuccess` | `1` (int) | ✅ |
| `_adobecmteas.authentication.loginStatus` | `logged-out` | ✅ |
| `_adobecmteas.identities.*` | all four fields present | ✅ |
| `_adobecmteas.visitorDetails.visitorType` | `Prospect` | ✅ |
| `_adobecmteas.channelInfo.channel` | `Mobile App` | ✅ |
| `_adobecmteas.channelInfo.participantName` | `prospect` (lowercase) | ⚠️ — see below |
| `identityMap.ECID + Email` | both present | ✅ |
| `environment` | Android 16, `en-US` | ✅ |

**Bug found and fixed:** `participantName` was hardcoded to the string literal `'prospect'` in `buildLogoutEvent` (`src/utils/xdmEventBuilders.ts:865`) regardless of the caller-supplied `params.profile`. `profile.tsx` correctly captures `currentProfile = getProfile()` before clearing state and passes it to the builder, but the builder ignored it. In CJA, the logout row for every session showed `participantName = 'prospect'` — the departing user's name was lost.

**Fix applied:** `xdmEventBuilders.ts:865` changed to `params.profile?.firstName || 'prospect'`. Future logout events will carry the authenticated user's name (e.g. `david`) so CJA can attribute session-end events correctly.

---

### Spurious DCVS Error — `personalization.request` @ 2026-05-27T01:00:45Z

**Streaming validation result:** ❌ Rejected — `outputTopics: acp_data_error_dcs`
**Error:** `DCVS-1106-400: required key [_adobecmteas] not found`

#### What it is

This is **not** a proposition tracking event. `personalization.request` with `propositionEventType.send: 1` is the SDK asking AJO *"do you have any in-app messages for this user?"* — generated internally by the Messaging extension when `Messaging.refreshInAppMessages()` is called. The app never built this event; the SDK emitted it autonomously.

#### Why it fired without visiting the Decisioning screen

After the login/logout identity change, the Messaging extension detected a state change and auto-requested a proposition fetch for the newly unauthenticated user. `Messaging.refreshInAppMessages()` is also called explicitly at SDK init (`adobeConfig.ts:251`, `adobeConfig.ts:308`), which re-runs after any App ID reconfiguration. Neither trigger requires the user to visit the Decisioning Items screen.

#### Why the DCVS error is unfixable from app code

`personalization.request` events are generated entirely by the SDK — they never pass through `buildXxxEvent()` builders. There is no hook to inject `_adobecmteas` into them. The schema requires `_adobecmteas` on all event types, but SDK-internal events are outside app control.

**Data impact: none.** The event was routed to `acp_data_error_dcs` (the streaming error dead-letter topic). It does not land in the AEP dataset, does not affect profiles, and does not influence AJO journeys.

#### Side note: duplicate `matchedSurfaces`

The event payload contains `matchedSurfaces: ["mobileapp://...AEPSampleAppNewArchEnabled/", "mobileapp://...AEPSampleAppNewArchEnabled/"]` — the same surface listed twice. This is an AJO server-side artifact (the activity has a duplicate surface entry) and is not caused by app code.

#### Instructor note for bootcamp

Students will see this DCVS error in Assurance during any session where the app initializes or the user logs in/out. It is a known false alarm. The events to validate are `commerce.*`, `decisioning.propositionDisplay`, `decisioning.propositionInteract`, and `mobileApp.navigation.clicks` — these are the events that land in AEP.

---

### Checkout / Purchase Event Investigation

During this session, `commerce.checkouts` and `commerce.purchases` events were absent from the 42 captured Edge events despite the user performing these flows. Investigation found two root causes:

**1. Silent guard bypass in `cart.tsx`**

The checkout button at `cart.tsx:256` had:
```ts
if (!identityMap || Object.keys(identityMap).length === 0) {
  console.warn('IdentityMap not ready for checkout');
  return; // ← silent drop, no UI feedback, nothing in Assurance
}
```
If `identityMap` was stale (SDK not ready at cart mount time, or page view `useFocusEffect` skipped), the event was silently dropped and no navigation occurred. The student saw nothing — no error, no Assurance event.

Additionally, the checkout event was built from the `identityMap` state value, which may not have been refreshed since the screen last focused.

**Fix applied:** The checkout handler now calls `refreshIdentityMap()` inline immediately before the guard, uses the live-fetched value for the event, and displays a visible red error message below the Checkout button when the guard fires.

**2. Post-purchase throw masked purchase success in `Checkout.tsx`**

`Edge.sendEvent(purchaseEvent)`, `Messaging.refreshInAppMessages()`, and `refreshDecisioningSurfaceFromStoredConfig()` were all in the same `try` block. If either post-purchase call threw, the `catch` reset `purchaseInProgress` and showed nothing — even though the purchase event had already been sent. The cart was not cleared and the student saw no feedback.

**Fix applied:** The purchase event send is now isolated in its own `try/catch`. Post-purchase side effects (`Messaging.refreshInAppMessages`, `refreshDecisioningSurface`, cart clear, confetti) are in a separate block. A failure there logs a non-fatal warning and does not mask the purchase confirmation.

**3. Identity fetch in `Checkout.tsx` was mount-only**

`Identity.getIdentities()` was called once in `useEffect([], [])` — never refreshed on re-focus. The purchase event was built from potentially stale state. Fixed: converted to a `refreshIdentityMap` callback called on every `useFocusEffect`.

---

### Full Tenant Field Coverage — 2026-05-27 window

Based on the 42 Edge events in the API-fetched window (2026-05-23 → 2026-05-26T21:44) plus the three streaming validation events inspected manually:

| Field | Status | Notes |
|---|---|---|
| `_adobecmteas.identities.ecid` | ✅ | All events |
| `_adobecmteas.identities.emailAddress` | ✅ | All logged-in events |
| `_adobecmteas.identities.hashedEmail` | ✅ | All logged-in events |
| `_adobecmteas.identities.mobilePhone` | ✅ | All logged-in events |
| `_adobecmteas.authentication.loginStatus` | ✅ | All events |
| `_adobecmteas.authentication.signInSuccess` | ✅ | Login click events only (correct) |
| `_adobecmteas.authentication.loggoffSuccess` | ✅ | Logout click events only (correct) |
| `_adobecmteas.authentication.signInFailure` | ❌ | Not exercised — no failed login in session |
| `_adobecmteas.authentication.registrationSuccess` | ❌ | Not exercised — no new registration in session |
| `_adobecmteas.visitorDetails.visitorType` | ✅ | `Customer` logged-in, `Prospect` anonymous/logged-out |
| `_adobecmteas.channelInfo.channel` | ✅ | All events |
| `_adobecmteas.channelInfo.participantName` | ✅ | Fixed: logout now uses caller name instead of hardcoded `'prospect'` |
| `commerce._adobecmteas.lowerFunnel.reviewOrderPage` | ➖ | No checkout events in API window; checkout flow under investigation |
| `productListItems[]._adobecmteas.lowerFunnel.cartID` | ❌ | Missing from all product list events in API window |
| `productListItems[]._adobecmteas.products.unitPrice` | ❌ | Missing from all product list events in API window |
| `web.webPageDetails._adobecmteas.*` | ✅ | All page view events |
| `web.webInteraction._adobecmteas.engagement.transactionType` | ✅ | All click events |

### Remaining Gaps

| Gap | Severity | Action |
|---|---|---|
| `productListItems[]._adobecmteas.lowerFunnel.cartID` missing from commerce events | 🟡 | Pass `cartID` from cart state into product event builders |
| `productListItems[]._adobecmteas.products.unitPrice` missing from commerce events | 🟡 | Add `unitPrice` field to product item builder |
| `signInFailure` never tested | 🟡 | Attempt a bad-password login in a future session |
| `registrationSuccess` never tested | 🟡 | Run a new-account registration flow in a future session |
| Checkout / purchase events not yet confirmed in Assurance | 🟡 | Re-run checkout flow with Assurance connected; watch for `commerce.checkouts` after cart.tsx fix |
| `personalization.request` DCVS errors (SDK-internal) | ℹ️ | Unfixable from app; inform students this is expected noise |

---

## Session: 2026-05-26

**Date:** 2026-05-26
**Validated by:** David Loyd
**Session UUID:** `d3b92cf1-4e25-4486-9a3d-3df29806852e`
**Sandbox:** `training`

### Streaming Validation Error — `decisioning.propositionInteract`

**Error code:** `DCVS-1106-400`
**Error message:** `required key [_adobecmteas] not found`
**Path:** `#` (root level of the XDM document)
**Affected event types:** `decisioning.propositionInteract` (confirmed), `decisioning.propositionDisplay` (same code path — same issue)

#### What happened

A `decisioning.propositionInteract` event fired when a user tapped an offer on the Decisioning Items screen. The event reached the Edge Network and was rejected by streaming schema validation because the top-level `_adobecmteas` tenant block was absent.

#### Root cause

The event went through the **manual fallback path** in `trackDecisioningItemInteraction` (`src/utils/decisioningItems.ts:230`). This path is taken when `propositionItem.track()` is not available on the item — which occurs for embedded JSON offer items.

The manual fallback builds only this XDM structure:

```ts
{
  eventType: 'decisioning.propositionInteract',
  _experience: { decisioning: { propositions: [...] } }
}
```

The `_adobecmteas` tenant block is never constructed. Every event builder in `xdmEventBuilders.ts` includes it — but `trackDecisioningItemInteraction` and `trackDecisioningItemDisplay` in `decisioningItems.ts` were written as minimal wrappers and the tenant block was never added. The SDK is not at fault — `ExperienceEvent` wraps whatever XDM it is given and does not inject tenant fields.

#### What was present in the payload

| Field | Status | Notes |
|---|---|---|
| `_adobecmteas` | ❌ Missing | Root cause of rejection |
| `identityMap` (ECID) | ✅ Present | SDK auto-injects from ambient identity state |
| `_experience.decisioning.propositions[0].scopeDetails.correlationID` | ✅ Present (`04770c73-4ee5-41c5-b19e-02cd810a835c-0`) | Spread from `item.proposition.scopeDetails` — works correctly |
| `environment` | ⚠️ Empty object `{}` | SDK injects an empty shell; `buildEnvironment()` never called |
| `_experience.decisioning.propositionAction.label` | ✅ Present (`"click"`) | Correct |

#### Key finding: correlationID confirmed working for proposition interactions

`_experience.decisioning.propositions[0].scopeDetails.correlationID` is present in the payload via the `...item.proposition.scopeDetails` spread. AJO includes this field in the Edge response for code-based experiences. The proposition tracking path does **not** need the item 4.8 correlationID fix — that fix is specific to push tracking only.

#### Fix required

Update `trackDecisioningItemInteraction` and `trackDecisioningItemDisplay` manual fallback paths in `src/utils/decisioningItems.ts` to:
1. Accept `identityMap` and `profile` parameters
2. Add `_adobecmteas` tenant block (same pattern as `xdmEventBuilders.ts`)
3. Add `environment: buildEnvironment()`
4. Update both callers in `app/(consumerTabs)/decisioningItems.tsx` (lines 424 and 473) to pass identity data

**Backlog item:** `App-Optimization-Plan.md` item 6.4

---

## Session: 2026-05-23

**Date:** 2026-05-23
**Validated by:** Claude Code + David Loyd
**Session UUID:** `7135551e-d823-418b-9af2-a4c905f929e3`
**Session span:** 2026-05-23 01:06 → 15:25 UTC (~14 hours)
**Sandbox:** `training`

### Session Summary

| | |
|---|---|
| Total Assurance events | 3,663 |
| Server-validated XDM events (`streaming.validation`) | 123 |
| Event types | pageViews (68), clicks (8), productListAdds (5), productViews (4), productListOpens (4), checkouts (2), purchases (2), personalization.request (16), decisioning.propositionDisplay (3), decisioning.propositionInteract (7) |
| Login cycles | 3 sign-ins, 3 logoffs |
| Purchases completed | 2 |
| Push registrations | 2 valid (FCM token, ECID `816304...` at 15:14 UTC) |

### Tenant Field Coverage

| Field | Expected Type | Status | Notes |
|---|---|---|---|
| `_adobecmteas.identities.ecid` | string | ✅ | 93 events; ECID `816304...` post identity reset |
| `_adobecmteas.identities.emailAddress` | string | ✅ | 57 events; logged-in state only (correct) |
| `_adobecmteas.identities.hashedEmail` | string | ✅ | 57 events; SHA-256 confirmed |
| `_adobecmteas.identities.mobilePhone` | string | ✅ | 53 events; logged-in state only |
| `_adobecmteas.authentication.loginStatus` | string | ✅ | `logged-in` (50), `not-logged-in` (40), `logged-out` (3) |
| `_adobecmteas.authentication.signInSuccess` | int | ✅ | 5 events; fires on `mobileApp.navigation.clicks` (login button tap) |
| `_adobecmteas.authentication.signInFailure` | int | ❌ | Not exercised — no failed login in session |
| `_adobecmteas.authentication.loggoffSuccess` | int | ✅ | 3 events; fires on `mobileApp.navigation.clicks` (logoff tap) |
| `_adobecmteas.authentication.registrationSuccess` | int | ❌ | Not exercised — existing account used, no new registration |
| `_adobecmteas.visitorDetails.visitorType` | string | ✅ | `Customer` when logged-in, `Prospect` when anonymous/logged-out |
| `_adobecmteas.channelInfo.channel` | string | ✅ | `Mobile App` on all 93 attributed events |
| `_adobecmteas.channelInfo.participantName` | string | ✅ | `david` on all 93 attributed events |
| `commerce._adobecmteas.lowerFunnel.reviewOrderPage` | int | ✅ | `1` on checkout events only |
| `productListItems[]._adobecmteas.lowerFunnel.cartID` | string | ✅ | Present on adds/checkouts/purchases; absent on productViews (correct — no cart yet) |
| `productListItems[]._adobecmteas.products.unitPrice` | number | ✅ | Present on all commerce events with product items |
| `web.webPageDetails._adobecmteas.pageTitle` | string | ✅ | Present on all navigation events |
| `web.webPageDetails._adobecmteas.pagePath` | string | ✅ | Present on all navigation events |
| `web.webPageDetails._adobecmteas.pageType` | string | ✅ | Present on all navigation events |
| `web.webInteraction._adobecmteas.engagement.transactionType` | string | ✅ | `Upper Funnel` / `Lower Funnel` correctly set per commerce phase |

### Notes

- **signInSuccess on clicks, not pageViews:** Counter fires once on the login button tap event (`mobileApp.navigation.clicks`). Subsequent page views carry only `loginStatus: "logged-in"`. This is correct — repeating the counter on every view would double-count in AEP.
- **ECID changed mid-session:** Events before 15:14 used ECID `255780...`; events at 15:14+ use `816304...`. Consistent with an app reinstall or identity reset between the two usage periods. Push token correctly tied to the current ECID.
- **Early push registrations (01:09, 01:20):** Had empty push tokens (pre-registration state, old ECID). Resolved by 15:14 when valid FCM token registered against current ECID.

### AJO Extension Fix Applied

**Issue:** Assurance Profile panel showed "Missing Message Tracking Dataset" warning.

**Root cause:** The Adobe Journey Optimizer extension in the Tags property ("Dloyd CMT EA Mobile Bootcamp") had the **Event Dataset** field blank — no dataset was selected for the Production, Stage, or Development environments.

**Fix:** Selected **`AJO Message Feedback Event Dataset`** in the AJO extension Event Dataset field (all environments), saved, and published the library.

**Impact:** AJO in-app message and push notification interaction events (displays, clicks, dismissals) will now write correctly to AEP. XDM edge event collection was unaffected by this issue.

### Remaining Gaps

| Gap | Severity | Action |
|---|---|---|
| `signInFailure` never tested | 🟡 Medium | Attempt a bad-password login in a future validation session |
| `registrationSuccess` never tested | 🟡 Medium | Run a new-account registration flow in a future session |
| ECID reset between session periods | ℹ️ Info | Expected after reinstall; no action needed |

---

## Session: 2026-05-22

**Date:** 2026-05-22
**Validated by:** Claude Code + David Loyd
**App:** AEP Native React (Bootcamp Demo)
**Tenant:** `_adobecmteas`

---

## Session Summary

| | |
|---|---|
| **Session UUID** | `6a384f2e-232e-433c-89df-ce4f0d5b3fc0` |
| **Total Assurance events** | ~300 (paginated fetch) |
| **Edge / XDM events** | 14 |
| **Auth method** | User access token (`AEP_ACCESS_TOKEN`) |
| **Event types seen** | `commerce.checkouts`, `commerce.productListAdds`, `commerce.productListViews`, `commerce.productViews`, `commerce.purchases`, `web.webpagedetails.pageViews`, authentication events |

---

## Tenant Field Coverage

| Field | Expected Type | Status | Notes |
|---|---|---|---|
| `_adobecmteas.identities.ecid` | string | ✅ | Present on all events via `identityMap.ECID` |
| `_adobecmteas.identities.emailAddress` | string | ✅ | Populated post-login |
| `_adobecmteas.identities.hashedEmail` | string | ✅ | SHA-256 via `expo-crypto`; confirmed populated |
| `_adobecmteas.identities.mobilePhone` | string | ➖ | SMS not in scope for this app |
| `_adobecmteas.authentication.loginStatus` | string | ✅ | Present on login event |
| `_adobecmteas.authentication.signInSuccess` | int | ✅ | Fires on successful login |
| `_adobecmteas.authentication.signInFailure` | int | ⚠️ | Not exercised in this session — no failed login test |
| `_adobecmteas.authentication.loggoffSuccess` | int | ✅ | Fires on logout |
| `_adobecmteas.authentication.registrationSuccess` | int | ⚠️ | Not exercised — no registration flow tested |
| `_adobecmteas.visitorDetails.visitorType` | string | ✅ | Present on page view events |
| `_adobecmteas.channelInfo.channel` | string | ✅ | Present; value: `mobile` |
| `_adobecmteas.channelInfo.participantName` | string | ✅ | Present; bootcamp participant name |
| `commerce._adobecmteas.lowerFunnel.reviewOrderPage` | int | ✅ | Fires on checkout screen |
| `productListItems[]._adobecmteas.lowerFunnel.cartID` | string | ✅ | Present on cart/checkout events |
| `productListItems[]._adobecmteas.products.unitPrice` | number | ✅ | Present on product events |
| `web.webPageDetails._adobecmteas.pageTitle` | string | ➖ | Web-only field; not applicable to mobile |
| `web.webPageDetails._adobecmteas.pagePath` | string | ➖ | Web-only field; not applicable to mobile |
| `web.webPageDetails._adobecmteas.pageType` | string | ➖ | Web-only field; not applicable to mobile |
| `web.webInteraction._adobecmteas.engagement.transactionType` | string | ✅ | Present on commerce interaction events |

---

## Per-Event Issues

| Event Type | Field | Issue |
|---|---|---|
| `commerce.productListViews` (pre-login) | `_adobecmteas.identities.emailAddress` | `null` — expected for guest; confirm intentional |
| `commerce.productListViews` (post-login, already-mounted screen) | `_adobecmteas.identities.emailAddress` | `null` — **BUG**: stale hook state, email not refreshed after login |
| `commerce.checkouts` (post-login, already-mounted screen) | `_adobecmteas.identities.emailAddress` | `null` — same root cause as above |
| Any event | `_adobecmteas.authentication.signInFailure` | Not tested — no failed login attempted in session |
| Any event | `_adobecmteas.authentication.registrationSuccess` | Not tested — registration flow not exercised |

---

## Critical Bug: Post-Login Identity Carry

**Root cause:** `useProfileStorage` uses `useState` + `AsyncStorage`, instantiated independently per component. Screens already mounted when login completes (Cart, Checkout, Offers, etc.) read `AsyncStorage` only once at mount via `useEffect(fn, [])`. They are never notified when the Profile screen saves new credentials.

**Impact:** Any XDM event fired from a tab that was already open before login sends `email: null` and `hashedEmail: null` — identity is missing from the event in AEP.

**Governance tier:** 🔴 Learning Loop

**Approved fix:** Migrate shared profile state to a `ProfileContext` at the app root (`app/_layout.tsx`). Replace all `useProfileStorage()` calls with `useProfile()` from context. This is the correct React pattern — lifting shared state to a common ancestor eliminates the stale-read problem structurally without per-screen `useFocusEffect` patches.

**Status:** ✅ Implemented (2026-05-22). `components/ProfileContext.tsx` provides `ProfileProvider` + `useProfile`; wired at the root in `app/_layout.tsx`. All 8 consumer-screen callsites migrated; `hooks/useProfileStorage.js` and dead `App.js` deleted. Structural regression test in `components/__tests__/ProfileContext.test.tsx` proves saveProfile from one consumer propagates to siblings without remount. Awaiting manual Assurance verification per §"B. Manual reproduction".

---

## Infrastructure Findings

| Item | Finding |
|---|---|
| **IMS S2S scopes** | Original scope string was missing all `assurance_*` scopes. Fixed in `scripts/assurance-fetch.js`. S2S credentials now work without a user token. |
| **Event filter** | Original filter guessed wrong vendor/type. Actual: `vendor=com.adobe.griffon.mobile`, `type=generic`, source ends in `requestcontent`. Fixed. |
| **`assurance-fetch.js`** | Created at `scripts/assurance-fetch.js`. Supports `--session`, `--list-sessions`, `--out`, `--token` flags. Exported as module for programmatic use. |
| **`assurance-validate` skill** | Created at `.claude/skills/assurance-validate/SKILL.md`. Automates this validation workflow. |
| **`.env` setup** | `AEP_ORG_ID`, `AEP_CLIENT_ID`, `AEP_CLIENT_SECRET` confirmed working for S2S. `AEP_ACCESS_TOKEN` optional (expires ~24h); leave blank once S2S confirmed stable. |

---

## Gap Summary

| Gap | Severity | Suggested Fix |
|---|---|---|
| Post-login identity not carried to already-mounted screens | 🔴 Critical | Migrate to `ProfileContext` — see above |
| `signInFailure` never tested | 🟡 Medium | Add a failed login test to bootcamp validation checklist |
| `registrationSuccess` never tested | 🟡 Medium | Add a new-account registration step to validation run |
| Push notification XDM events not validated | 🟡 Medium | Run a dedicated push validation session (`buildPushTrackingEvent`) |

---

## What's Working Well

- ECID present on every event
- `hashedEmail` correctly computed via SHA-256 (`expo-crypto`) and populated post-login
- Commerce event coverage complete: add-to-cart, checkout, purchase, product views, list views
- Channel and visitor type fields consistent across all events
- Guest flow fires events correctly with null identity (expected behavior)
- Logout event fires and clears identity fields
