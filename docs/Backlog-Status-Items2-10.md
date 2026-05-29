# Backlog Items 2–10 Status

Source: [wiki.corp.adobe.com/spaces/~dloyd/pages/3843185182/Backlog+Items](https://wiki.corp.adobe.com/spaces/~dloyd/pages/3843185182/Backlog+Items)
Code audit: 2026-05-28 | Assurance session confirmed: 2026-05-28 (`37abdcb7-e6c0-4376-8b58-ca47283abb4a`, 680 events / 30 Edge)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Confirmed done in code |
| ⚠️ | Real gap — needs work |
| 🔍 | Needs runtime/Assurance validation |

---

## Item 2 — Commerce Transaction Types ✅ LIVE CONFIRMED

**Requirement:** Update `transactionType` values:
- Checkout & Purchase → `"Lower Funnel"`
- Add to Cart, Cart View, Product View → `"Upper Funnel"`
- Login Success → `"Authentication"`

**Status:** Done and confirmed in live session. Observed in Assurance:
- `commerce.productViews`, `commerce.productListAdds`, `commerce.productListOpens`, `commerce.productListOpens` (cart view) → `"Upper Funnel"` ✓
- `commerce.checkouts`, `commerce.purchases` → `"Lower Funnel"` ✓
- `mobileApp.navigation.clicks` (login) → `"Authentication"` ✓

**No action required.**

---

## Item 3 — Guest → Prospect ✅ LIVE CONFIRMED

**Requirement:** Rename visitor type `Guest` to `Prospect`.

**Status:** Done and confirmed in live session. `_adobecmteas.visitorDetails.visitorType` observed as `"Customer"` (logged-in) and `"Prospect"` (unauthenticated) across all 10 event types. `"Guest"` does not appear anywhere in the session.

**No action required.**

---

## Item 4 — productListItems Primary/Secondary Categories ✅ LIVE CONFIRMED

**Requirement:** Add `productCategories` array to every product event:
```json
"productCategories": [
  { "categoryID": "primaryCategory", "categoryName": "Equipment" },
  { "categoryID": "secondaryCategory", "categoryName": "Surfing" }
]
```

**Status:** Done and confirmed in live session. Observed on every product event with both primary + secondary populated correctly:
- Blast Mini Pump → `Equipment` / `Biking`
- Faba Running Pants → `Women` / `Pants`

Present on `commerce.productViews`, `commerce.productListAdds`, `commerce.productListOpens`, `commerce.checkouts`, `commerce.purchases`. `commerce.productViews` correctly omits `cartID` (pre-add); all other product events include it.

**No action required.**

---

## Item 5 — Assurance Screen Base URL ✅

**Requirement:** Add the app base URL `com.AEPSampleAppNewArchEnabled://` as a copyable field on the Assurance screen.

**Status:** Done. `app/(techScreens)/AssuranceView.tsx` defines `APP_BASE_URL = 'com.AEPSampleAppNewArchEnabled://'` (line 14), displays it in a row with a Copy button (lines 115–125) that calls `Clipboard.setString(APP_BASE_URL)` and shows a confirmation alert.

**No action required.**

---

## Item 6 — Ingestion Errors (_adobecmteas missing) ✅ LIVE CONFIRMED

**Requirement:** Fix Assurance validation errors: `required key [_adobecmteas] not found`.

**Status:** Resolved and confirmed. All 30 Edge events in the session include `_adobecmteas` — including `pushNotificationDetails` (the registration companion event). Zero ingestion validation errors in this session.

**No action required. If new errors appear, confirm the screen firing the event is using a builder rather than a hand-rolled payload.**

---

## Item 7 — AppID / CJA Lifecycle Metrics Missing ✅ RESOLVED — VERIFIED LIVE

**Requirement:** CJA OOTB Mobile template shows no Launches, Users, or Installs metrics. Cause: `application.id`, `application.name`, `application.version`, and `application.launches` are not reaching AEP.

> **✅ RESOLVED 2026-05-28.** Two Tags forwarding rules were added to mobile property
> `PR668240320734446d9bf0370c9932bace` and published to **Production**, then verified in Assurance
> session `37abdcb7-…-ca47283abb4a`. After a fresh install + background/foreground cycle (client
> `a52f029a`), each lifecycle event now appears as a **pair** — the on-device `eventType.lifecycle`
> trigger **and** a forwarded `eventType.edge` / `requestContent` event carrying `xdm.application`:
> - `application.close` @ 3:34 PM EDT → `{ isClose: true, closeType: "close", sessionLength: 787 }`
> - `application.launch` @ 3:49 PM EDT → `{ name: "WeRetail", id: "com.cmtBootCamp…", isLaunch: true, version: "1.0.9 (2)" }`
>
> Edge acknowledged the requests (a `state:store` response handle was returned to the client). The
> forwarded `requestContent` events show `identityMap.ECID` absent and no `_adobecmteas` block — both
> **expected and harmless**: Edge attaches the ECID when it builds the network call, and `application.*`
> is standard XDM (CJA lifecycle metrics don't use the tenant block). CJA Launches/Users/Installs
> populate after normal dataset→CJA processing.
>
> **Forwarding caveat for the next person:** publishing the rules is not enough. The running app must
> (1) be on the **same environment** the rules were published to (`build.environment = prod` here), and
> (2) **download + register the new ruleset, then complete a background→foreground cycle** — the launch
> that triggers the rule download won't forward itself. Also note Assurance's query API lags the live UI
> by many minutes, so validate against the live session or re-fetch after a delay.

### Background / how this was diagnosed

> **⚠️ The original fix in this item was wrong and has been replaced.** It prescribed calling
> `MobileCore.lifecycleStart({})` / `MobileCore.lifecyclePause()` from an `AppState` listener in
> `_layout.tsx`. **Those JS APIs do not exist in `@adobe/react-native-aepcore` v7.0.0** — verified in
> `node_modules/@adobe/react-native-aepcore/src/MobileCore.ts`, where the `IMobileCore` interface has no
> `lifecycleStart`/`lifecyclePause` (a repo-wide grep finds them nowhere in the package). Writing that
> code would fail `tsc --noEmit`. In v7, lifecycle tracking is **automatic**, enabled by default via
> `InitOptions.lifecycleAutomaticTrackingEnabled` (defaults to `true`). The app already uses this path
> (`initializeWithAppId(appId)` → `initialize({ appId })`), so **automatic lifecycle tracking is already
> on. No AppState wiring is needed or possible.**

**Actual root cause (confirmed via Assurance session `37abdcb7-…-ca47283abb4a`, 2026-05-28):**

The Lifecycle extension is generating the data correctly **on-device**. Assurance shows
`Application Launch (Foreground)`, `Application Close (Background)`, `Lifecycle Resume/Pause`, and a
`Lifecycle State` shared state carrying `launches: "1"`, `installevent`, `appid: "WeRetail 1.0.9 (2)"`.
The foreground event already has a complete, schema-aligned XDM payload:

```json
"application": { "name": "WeRetail", "id": "com.cmtBootCamp.AEPSampleAppNewArchEnabled",
                 "version": "1.0.9 (2)", "isLaunch": true },
"eventType": "application.launch"
```

**But none of these lifecycle events are forwarded to Edge Network.** Of the 30 Edge/XDM events sent to
AEP in that session, **0 carried any `xdm.application` node**. The lifecycle data stops on the device —
fully visible in Assurance (which taps the internal SDK event hub) but invisible to CJA (which reads only
what reaches the platform). Internal `generic`/`hub`/`sharedState` events are **never transmitted** by
themselves; only Edge **request** events reach AEP.

**This is a Data Collection (Tags) configuration gap, not an app-code bug.** The destination
`application` field group already exists in the `davidMobileInteractions` schema (Application Details
field group: `id`, `name`, `version`, `isLaunch`, `isInstall`, `isClose`, `sessionLength`, and the
`launches`/`installs`/`firstLaunches` measures) and maps 1:1 to the SDK's lifecycle XDM. Once forwarding
is enabled, those fields populate automatically.

**Do NOT populate `application.*` from the event builders.** `launches`, `installs`, and `firstLaunches`
are running counters owned by the Lifecycle extension; the commerce/pageview builders have no access to
that state, and stamping `isLaunch`/launch counts onto every event would massively over-count launches
and corrupt the CJA metrics. Launches must come from the one-per-launch `application.launch` event.

**Action required (config, in Data Collection → your mobile Tags property):**

Prerequisite: the **Lifecycle for Edge Network** extension must be installed in the property (it's what
emits the `application.launch` / `application.close` XDM — confirmed firing on-device in the session).

1. Rule "Forward Lifecycle Launch to Edge":
   - **Event** → Extension: `Mobile Core`, Event Type: `Foreground`
   - **Action** → Extension: `Adobe Experience Platform Edge Network`, Action Type: `Forward event to Edge Network`
2. Rule "Forward Lifecycle Close to Edge":
   - **Event** → Extension: `Mobile Core`, Event Type: `Background`
   - **Action** → Extension: `Adobe Experience Platform Edge Network`, Action Type: `Forward event to Edge Network`
3. Save each rule, then add both to a library, **Build**, and **Publish** to the environment the app's
   App ID points at.
4. Re-run `/assurance-validate` on a fresh session. Success = Edge events now appear with
   `eventType: application.launch` / `application.close` and a populated `xdm.application` node.

(Exact UI labels per Adobe docs: developer.adobe.com/client-sdks/edge/lifecycle-for-edge-network/)

### Why doesn't Mobile Core just auto-send lifecycle data to AEP?

It feels like it *should* work automatically — the reason it doesn't is a deliberate design choice in the
Edge architecture.

**Edge is a generic pipe, not a lifecycle-aware destination.** In the old (Analytics-coupled) Mobile SDK,
lifecycle *did* auto-send: `lifecycleStart` was wired directly to Analytics and appended lifecycle metrics
to the first Analytics hit of each session. One fixed destination, so "track" and "send" were the same
action. The Edge SDK deliberately broke that coupling — Edge Network is a destination-agnostic transport:
you hand it an XDM event and a *datastream* (server-side config) fans it out to AEP, Analytics, Target,
etc. Because Edge doesn't own any particular data type, it can't assume lifecycle is "for it."

**Lifecycle and Edge are independent extensions that don't talk directly.** Inside the SDK event hub:
- The **Lifecycle extension** detects foreground/background and dispatches an internal event of type
  **`com.adobe.eventType.lifecycle`**. That's all it does — compute and announce.
- The **Edge extension** only transmits events of type **`com.adobe.eventType.edge` / `requestContent`**
  (what `Edge.sendEvent()` produces).

Those are two different event types. The Edge extension isn't listening for lifecycle events, so a
lifecycle event never becomes an Edge request on its own. **Something has to translate `lifecycle` →
`edge`** — and that "something" is the Tags forwarding rule (or explicit `Edge.sendEvent` code). The rule
literally says: *"when you see a lifecycle event, dispatch a copy as an Edge request."*

**Why Adobe designed it this way (not an oversight):**
1. **Destination is the implementer's choice** — lifecycle could go to Edge/AEP, to Analytics via Edge
   Bridge, to the direct Analytics extension, or nowhere (just driving in-app rules). The SDK can't presume.
2. **You control the XDM shape, datastream, filtering, and data volume** at the rule layer, instead of the
   SDK force-sending a fixed payload everywhere.
3. **Tags rules are the supported "glue"** in the Edge world — the same mechanism that forwards any event.

**And the auto-tracking flag fits here too.** `lifecycleAutomaticTrackingEnabled: true` (the v7 default)
only automated the **generation** side — it replaced manual `lifecycleStart`/`lifecyclePause` so you don't
detect foreground/background yourself. It answers *"when is a lifecycle event created?"* — **not** *"where
does it go?"* Generation and transmission are separate concerns; only generation got automated.

> **One-liner:** Mobile Core auto-*generates* lifecycle events, but Edge only *transmits* what's explicitly
> routed to it — and lifecycle events aren't, by design. The forwarding rule is the intentional bridge.

**Optional code clarity — considered and intentionally NOT done (no change required).** In
`src/utils/adobeConfig.ts` the SDK is initialized with `MobileCore.initializeWithAppId(appId)`, which
expands to `initialize({ appId })`; the SDK then applies the default `lifecycleAutomaticTrackingEnabled:
true`. One could make that explicit — `MobileCore.initialize({ appId, lifecycleAutomaticTrackingEnabled:
true })` — purely so a reader can *see* that lifecycle auto-tracking is on. This is **runtime-identical**
(`true` is already the default) and was deliberately **left as-is** (decision 2026-05-28): no behavior
benefit, and lifecycle forwarding is fully handled by the Tags rules above. Documented here so the
default is understood without touching the init sequence (a "must not be broken" file).

> See the live Tags-property rule audit appended below (via `/reactor-rules`) for the exact rule
> configuration steps and whether any forwarding rule currently exists.

---

## Item 8 — Push Message Bounces ⚠️ NEW CLUE FROM ASSURANCE

**Requirement:** Investigate high bounce rate on AJO push messages.

**Status:** The `pushNotificationDetails` registration event in this session fired while the user was a **Prospect** (not logged in). As a result:
- `_adobecmteas.identities` only has `ecid` — no `emailAddress`, `hashedEmail`, or `mobilePhone`
- The `identityMap` shows `Email` with `authenticatedState: "ambiguous"` (carried from the identity graph, not the active session)

**Why this matters for bounces:** If AJO's audience for the push campaign qualifies on email identity and the registered push token is only linked to an ECID-only profile (no stitched email), AJO may fail to match the token to an addressable profile → bounce. Learners who register push before logging in are invisible to email-qualified audiences.

**Action required:**
1. In AJO, check the bounce reason codes in the delivery report for a recent push campaign.
2. In AEP Profile Viewer, confirm the test profile has `pushNotificationDetails.token` populated and that the profile has a stitched email identity alongside the ECID.
3. **Likely fix:** Trigger a second push re-registration call after login succeeds so the token is re-stamped with the fully-authenticated identity (email + ECID stitched). The existing `registerTokenWithAdobe` can be called again from the login success handler.
4. If tokens are mismatched device-side, add a manual "Re-register Push Token" button to the Push Debug screen.

---

## Item 9 — correlationID Not Populated ⚠️ / 🔍

**Requirement:** AJO push tracking requires `correlationID` to be manually populated in the push tracking XDM event (unlike Web SDK which auto-populates it).

**Status:** Infrastructure is in place but unvalidated:

**What exists:**
- `_layout.tsx` (lines 151–155) extracts from the push payload, trying three key names in order:
  ```ts
  const correlationID =
    (data as any)?.adb_correlation_id ||
    (data as any)?._adobe?.correlationid ||
    (data as any)?.adobe_correlation_id ||
    undefined;
  ```
- `buildPushTrackingEvent` (line 1240–1250) writes it to:
  ```json
  "_experience": {
    "decisioning": {
      "propositions": [{ "scopeDetails": { "correlationID": "..." } }]
    }
  }
  ```

**Two unknowns — one partially answered by this session:**

1. **Key name**: We don't know which key AJO injects in the raw APNs/FCM payload. `adb_correlation_id` is the most likely, but needs visual confirmation in Assurance → Event Transactions → raw push payload. Still requires an AJO push.

2. **XDM path**: The current code writes to `_experience.decisioning.propositions[0].scopeDetails.correlationID`. This session's live `decisioning.propositionInteract` and `decisioning.propositionDisplay` events confirm AJO uses exactly this path for offer decisioning correlationIDs (observed value: `04770c73-4ee5-41c5-b19e-02cd810a835c-0`). **This is partial confirmation the path is correct for push too** — AJO's push tracking uses the same decisioning engine. Full confirmation still requires a `pushTracking.applicationOpened` event from an actual AJO push.

**Action required:**
1. Send a push from an AJO journey/campaign while connected to an Assurance session.
2. In Assurance → Event Transactions, inspect the raw push payload to confirm the correlationID key name.
3. After the app is opened, inspect the `pushTracking.applicationOpened` Edge event to see what `_experience` block was sent.
4. If the key name or XDM path is wrong, update `_layout.tsx` (extraction) and `buildPushTrackingEvent` (XDM path) accordingly.
5. Add a unit test to `xdmPushTracking.test.ts` that asserts correlationID flows through into the correct XDM path when passed to `buildPushTrackingEvent`.

> **Note:** The Assurance "Send Test Push" (Project Griffon) will **not** work for this test — it bypasses AJO entirely and injects no correlationID. Must use an actual AJO journey or campaign push.

---

## Item 10 — Mobile Events Matching Mockaroo Pattern ✅ LIVE CONFIRMED

**Requirement:** Verify field names, casing, and node structure in mobile XDM events match the Mockaroo reference record.

**Status:** Confirmed by this Assurance session. The full commerce funnel fired and all field names, casing, and node structure match the Mockaroo reference:
- `_adobecmteas.channelInfo`, `.identities`, `.authentication`, `.visitorDetails` — all present ✓
- `eventType` format (`mobileApp.navigation.pageViews`, `commerce.purchases`, etc.) — correct ✓
- `productListItems` as array with `SKU`, `name`, `quantity`, `priceTotal`, `productCategories`, `_adobecmteas.products.unitPrice` — matches ✓
- `web.webPageDetails._adobecmteas` (`pageTitle`, `pagePath`, `pageType`) and `web.webInteraction._adobecmteas.engagement.transactionType` — present ✓
- Page paths follow `/home/women/faba-running-pants` slug format matching Mockaroo ✓

**No action required.**
