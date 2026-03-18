# QA Review: Four Use Cases (Mobile App)

This document reviews four QA use cases for the WeRetail / Adobe AEP sample mobile app: Call Center Push, Purchase In-App Journey, Cart Views in CJA, and Decisioning. Each section summarizes current app behavior, likely causes when things do not work, and what to verify without making code changes.

## 1. Call Center Push: AJO Journey has entries but reporting shows `Bounced`

### What the app does

- Android uses FCM via `messaging().getToken()`.
- iOS uses the native APNs device token via `Notifications.getDevicePushTokenAsync()`.
- The app applies the token to Adobe automatically with `MobileCore.setPushIdentifier(token)`.
- Android token refreshes are re-applied automatically.

### Likely causes of `Bounced`

| Area | Detail |
|------|--------|
| App ID/config order | If Adobe App ID is not configured before push registration, Adobe token registration cannot complete correctly. |
| Token/profile drift | Reinstall, app-data clears, or token rotation can leave Adobe holding an older token. |
| Token vs channel | The app uses native APNs on iOS and FCM on Android. AJO channel config must match the actual token type and environment. |
| Identity | The journey must target the same profile that holds the push token. |

### What to verify

- In Assurance, confirm the token in Adobe matches the token shown in the app.
- In AJO, confirm push channel configuration matches the right app, platform, credentials, and environment.
- After using `Clear Adobe Push Tokens`, request notifications again and verify the token reappears in Assurance before retrying the journey.

## 2. Purchase In-App Journey does not render expected content

### What the app does

- `Checkout.tsx` sends `commerce.purchases` with `Edge.sendEvent(purchaseEvent)`.
- Right after purchase it calls `Messaging.refreshInAppMessages()`.
- In the same purchase flow it also refreshes the configured code-based experience surface with `refreshDecisioningSurfaceFromStoredConfig()` when a decisioning surface has been saved.

### Likely causes

| Area | Detail |
|------|--------|
| Journey entrance | AJO entrance conditions must match the emitted `commerce.purchases` XDM. |
| Timing | The immediate in-app refresh can happen before journey evaluation finishes. |
| Channel mismatch | Classic in-app messaging and code-based experiences still require the journey to be authored for the correct delivery channel. |
| Identity/profile | The profile receiving the purchase event must be the profile targeted by the journey. |

### What to verify

- In Assurance, confirm the purchase event reaches Edge with the expected `_adobecmteas` fields.
- In AJO, confirm whether the use case is classic in-app messaging or code-based experience, and verify the configured app surface when testing CBE.
- Validate purchase-event delivery separately from content rendering.

## 3. Cart Views event not firing in CJA

### What the app does

- `cart.tsx` sends a page-view event when the cart screen is opened.
- The event uses cart page context such as `pageType: 'cart'` and `pagePath: '/cart'`.
- The app does not send a literal event named `Cart Views`.

### Likely causes

| Area | Detail |
|------|--------|
| CJA metric definition | CJA may be looking for a custom metric that does not match the XDM actually sent by the app. |
| Data View mapping | The Data View must expose the cart page fields used to define the metric. |
| Dataset/connection | The mobile dataset used by Edge must be the same one used in CJA reporting. |
| Timing/readiness | Cart page views depend on runtime readiness for identity/session data, so Assurance should be checked before clearing the client fully. |

### What to verify

- In Assurance, confirm a cart page-view event fires when the Cart screen opens.
- In CJA, define/report cart views from the actual XDM fields already in use.
- Confirm the dataset, date range, and filters are not excluding valid events.

## 4. Decisioning feels inconsistent

### What the app does

- Surface config is stored in AsyncStorage under `@decisioning_items_config`.
- The Technical View `Decisioning` screen lets testers edit the surface, fetch propositions, and refresh in-app messages.
- The consumer decisioning experience reads the same config.
- The consumer decisioning experience reads cached propositions first and then refreshes from Edge on focus.
- After purchase, the app refreshes in-app messages and also refreshes the configured decisioning surface.

### Likely causes

| Area | Detail |
|------|--------|
| Surface mismatch | The app surface must exactly match the AJO code-based experience surface. |
| Cache behavior | Cached propositions can still be shown briefly before the server refresh completes, so stale content can appear transiently. |
| Journey timing | Purchase-triggered personalization can still miss on the first immediate refresh if AJO evaluation has not completed yet. |
| Content shape | If AJO content structure differs from app expectations, rendering can look partial or wrong. |

### What to verify

- In the app, confirm the `Decisioning` screen surface matches the AJO surface exactly.
- In Assurance, inspect proposition requests and responses for that surface.
- Test first launch, cached re-open, and post-purchase scenarios separately.

## Summary

| Use case | Current app-side behavior | Most likely focus |
|----------|---------------------------|-------------------|
| Call Center Push | Automatic Adobe token registration via `MobileCore.setPushIdentifier` | App ID/config order, profile/token consistency, AJO push channel config |
| Purchase In-App Journey | Sends `commerce.purchases`, refreshes in-app messages, and refreshes the stored CBE surface when configured | Journey entrance contract, timing, channel type |
| Cart Views in CJA | Sends cart page-view XDM, not a literal `Cart Views` event | CJA Data View / metric definition |
| Decisioning | Uses configurable surface, cache plus server refresh on focus, and post-purchase surface refresh | Surface alignment, cache freshness, timing, content shape |
