# Automated Checks for QA Use Cases

This document describes how to run automated checks that verify the app behavior described in [QA-Use-Cases-Review.md](QA-Use-Cases-Review.md), and what remains manual.

## How to run automated checks

From the app root:

```powershell
npm run test:ci
```

For interactive watch mode (re-run on file changes):

```powershell
npm test
```

## What the tests verify

- **`src/utils/__tests__/xdmEventBuilders.test.ts`** — QA use cases (cart page view + purchase shape).
- **`src/utils/__tests__/xdmCjaPathsNonBlank.test.ts`** — For each commerce-related builder, asserts **CJA-relevant XDM paths are not blank** (no `null`/`undefined`/NaN/empty string on required fields).

| QA use case | What is automated | What is still manual |
|-------------|-------------------|----------------------|
| **1. Call Center Push (Bounced)** | — | Token registration flow, AJO channel config, identity/profile. Use Assurance + device testing. |
| **2. Purchase In-App Journey** | `buildPurchaseEvent()` produces `eventType: 'commerce.purchases'`, `_adobecmteas`, `commerce.order`, `productListItems`, and engagement `transactionType: 'purchase'`. | Journey entrance conditions in AJO, in-app vs CBE channel, timing of `refreshInAppMessages()` / surface refresh. Use Assurance + AJO. |
| **3. Cart Views in CJA** | `buildPageViewEvent()` with cart params produces `eventType: 'mobileApp.navigation.pageViews'`, `pageType: 'cart'`, `pagePath: '/cart'`, and correct `web.webPageDetails` / `_adobecmteas`. | CJA Data View and “Cart Views” metric definition, dataset/connection, report filters. Use Assurance + CJA. |
| **4. Decisioning (wonky)** | — | Surface name match with AJO, cache vs server behavior, content parsing, refresh after purchase. Use Assurance + app flows. |

## Summary

- **Automated:** Purchase and Cart **event payload shape** (use cases 2 and 3). Run `npm run test:ci` before releases or after changing `xdmEventBuilders.ts` or `identityHelpers.ts`.
- **Manual:** Push registration, journey/channel configuration, CJA metric definitions, decisioning surfaces and refresh behavior (use cases 1 and 4, plus config/UX for 2 and 3). Follow [Fix-And-Test-Adjustment-Plan.md](Fix-And-Test-Adjustment-Plan.md) for device and Assurance flows.

## Adding more automated checks

- **Event builders:** Add tests in `src/utils/__tests__/xdmEventBuilders.test.ts` for other builders (e.g. checkout, product list add) if they become critical for reporting.
- **Decisioning:** If `parseItemContent` or surface config is moved to a shared util, add unit tests there.
- **E2E:** Push and full journey behavior would require device or emulator E2E (e.g. Detox, Maestro) and are not covered by the current Jest suite.
