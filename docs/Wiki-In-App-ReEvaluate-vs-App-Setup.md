# Wiki assessment: In-app re-evaluation vs current app setup

This document maps the internal wiki page **“Re-Evaluate Campaign Journey for In-App”** (ADMS space, page `3637452248`) — which describes **AEP Messaging SDK** in-app fetch, storage, qualification, and the **WIP problem** that qualification is not automatically re-run when user context changes after fetch — to **this repo’s** Adobe Messaging setup as of the assessment date.

**Wiki source (internal):**  
[Re-Evaluate Campaign Journey for In-App WIP](https://wiki.corp.adobe.com/spaces/adms/pages/3637452248/Re-Evaluate+Campaign+Journey+for+In-App+WIP)

Related app docs: [QA-Use-Cases-Review.md](QA-Use-Cases-Review.md), [Fix-And-Test-Adjustment-Plan.md](Fix-And-Test-Adjustment-Plan.md), [Decisioning-And-Offers-Consumer-QA.md](Decisioning-And-Offers-Consumer-QA.md).

---

## 1. What the wiki asserts

| Topic | Wiki summary |
|-------|----------------|
| **Fetch** | In-app definitions are fetched when Messaging registers; manual fetch via `Messaging.refreshInAppMessages()`. |
| **Display** | SDK decides when to show; `MessagingDelegate` (`shouldShowMessage`, `onShow`, `onDismiss`, `urlLoaded`) overrides display behavior. |
| **Frequency** | Local event history enforces show-once / show-N. |
| **Problem** | After definitions are stored, **qualification is not automatically re-evaluated** when identity/profile/consent/context changes **unless** the app triggers refresh (or next launch path picks up new definitions). |
| **Symptoms** | Messages that should qualify after a context change may stay unshown until next app launch; ambiguity for **past-event-based** qualification. |
| **Short-term recommendation** | Call **`Messaging.refreshInAppMessages()`** after consent or profile updates; same API is described as useful for **journey-triggered** messages. |
| **Long-term (WIP)** | Possible `reEvaluateInAppMessages()` or auto refresh on shared-state / lifecycle (not assumed available in app today). |

---

## 2. Current app setup (code-aligned)

### 2.1 Initialization (`src/utils/adobeConfig.ts`)

| Step | Behavior | Wiki alignment |
|------|----------|----------------|
| Consent | Default + collect consent set to **yes** before Messaging-heavy work. | Matches wiki guidance to have consent settled before relying on messaging. |
| **Messaging delegate** | `Messaging.setMessagingDelegate({ shouldShowMessage: () => true, shouldSaveMessage: () => true, onShow/onDismiss/urlLoaded })` with deep-link handling. | Aligns with wiki “delegate control” section; default is show-all. |
| **Post-init refresh** | `await Messaging.refreshInAppMessages()` after delegate setup. | Matches wiki **short-term** workaround (explicit refresh after configuration). |

### 2.2 Purchase / AJO journey path (`app/(consumerTabs)/Checkout.tsx`)

| Step | Behavior | Wiki alignment |
|------|----------|----------------|
| Purchase XDM | `Edge.sendEvent(buildPurchaseEvent(...))`. | Journey entry depends on AJO + Edge (outside SDK doc). |
| In-app refresh | **`await Messaging.refreshInAppMessages()`** immediately after purchase send. | **Directly implements** wiki’s recommended pattern for journey-triggered / post-event messaging. |
| Code-based / decisioning | **`refreshDecisioningSurfaceFromStoredConfig()`** (see `src/utils/decisioningItems.ts`) after purchase when config exists. | Addresses post-purchase **CBE** surfaces; not in the wiki page (wiki is classic in-app), but reduces “refresh in-app only” gap for mixed journeys. |

### 2.3 Manual / QA paths

| Location | Behavior |
|----------|----------|
| `app/(techScreens)/MessagingView.tsx` | Button to call `refreshInAppMessages()`. |
| `app/(techScreens)/DecisioningItemsView.tsx` | Explicit in-app refresh + proposition fetch for surfaces. |

---

## 3. Gaps vs wiki recommendations

### 3.1 Consent or profile changes **without** refresh

The wiki recommends calling **`refreshInAppMessages()` after consent or profile updates.**

| Scenario | Current behavior | Risk |
|----------|------------------|------|
| User changes consent in **ConsentView** (`Consent.update`) | No automatic `refreshInAppMessages()`. | In-app eligibility may lag until next cold start or manual refresh (tech screen). |
| Profile / identity updates in consumer flows | Identity is refreshed in many screens for **XDM**, not wired to Messaging refresh. | If a journey keys off profile attributes updated only client-side, in-app rules may not re-run until refresh or relaunch. |

**Severity:** Medium for demos that toggle consent or profile mid-session; low for bootcamp default “consent yes at init” path.

### 3.2 Timing vs Edge / journey evaluation

The wiki does not fix **network ordering**: `refreshInAppMessages()` runs **immediately** after `Edge.sendEvent(purchase)` in Checkout. If AJO has not yet processed the purchase event when the SDK fetches definitions, the refresh may return **stale** rules. This matches existing QA notes (timing), not a separate “blocker” from the re-eval WIP page.

**Mitigation ideas (product/QA, not wiki-mandated):** delayed second refresh, Assurance verification of event then retrieve-definitions, or documented retry in test plans.

### 3.3 No `reEvaluateInAppMessages()` API

The wiki’s **long-term** option (local re-qualification without full fetch) is **not** available in public RN Messaging APIs as of this assessment. The app cannot implement it until the SDK exposes it.

### 3.4 Channel confusion (in-app vs CBE)

The wiki page is about **classic in-app messaging**. Post-purchase **code-based experiences** require proposition refresh (`updatePropositionsForSurfaces` / consumer decisioning flow). The app now refreshes a stored decisioning surface after purchase when configured; journeys must still be authored for the correct channel.

---

## 4. Overall assessment

| Question | Conclusion |
|----------|------------|
| Is the app **blocked** by the wiki WIP? | **No.** The page describes SDK behavior and recommends **`refreshInAppMessages()`**; the app uses that on **init** and **after purchase**, and refreshes decisioning when configured. |
| Are we **fully aligned** with every wiki suggestion? | **Partially.** We do **not** systematically call `refreshInAppMessages()` after **every** consent or identity/profile change outside init. |
| Main residual QA risk for purchase in-app journeys? | **Timing** (refresh vs journey evaluation) and **journey/channel design**, not absence of refresh API usage. |

---

## 5. Suggested follow-ups (optional)

1. After **ConsentView** (or any flow that calls `Consent.update` for real users), call **`Messaging.refreshInAppMessages()`** (and document in README/QA).
2. If login/profile sync to Edge is added, consider refresh after successful identity update when in-app campaigns depend on it.
3. For flaky purchase-triggered in-app QA: document **Assurance** sequence (purchase hit → personalization retrieve) and optional **delayed** second refresh for tests only.
4. Re-read the wiki when **`reEvaluateInAppMessages()`** (or auto re-eval) ships; revisit whether post-profile refresh can be lighter than full fetch.

---

*Assessment reflects wiki content retrieved via Confluence and codebase paths: `adobeConfig.ts`, `Checkout.tsx`, `decisioningItems.ts`, tech Messaging/Decisioning screens.*
