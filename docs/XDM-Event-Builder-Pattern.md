# XDM Event Builder Pattern

**Canonical reference:** `src/utils/xdmEventBuilders.ts`
**Schema reference:** `docs/mobileInteracionsSchema.json`, `docs/schema-sample-Mobile Interactions.json`

Every event builder in this app must produce a payload that matches the Mockaroo import record format. This doc is the single source of truth for which fields are required, where they live, and what values they take.

---

## Required fields on every event

```jsonc
{
  "_id": "<timestamp>-<random>",          // unique event ID — built by each builder
  "timestamp": "2026-05-13T21:04:08Z",    // new Date().toISOString()
  "eventType": "...",                      // see Event Types below
  "identityMap": { ... },                  // from Identity.getIdentities()

  "_adobecmteas": {
    "channelInfo": {
      "channel": "Mobile App",
      "participantName": "<firstName | 'prospect'>"   // always lowercase
    },
    "identities": {
      "ecid": "...",
      "emailAddress": "...",               // plain email
      "hashedEmail": "..."                 // SHA-256, built by identityHelpers
    },
    "authentication": {
      "loginStatus": "logged-in | not-logged-in | logged-out | login-failed"
    },
    "visitorDetails": {
      "visitorType": "Customer | Prospect"
    }
  },

  "environment": { ... },                  // buildEnvironment() — device/OS/viewport

  "web": {
    "webPageDetails": {
      "pageViews": { "value": 1 },         // on page-view events only
      "server": "mobileapp",               // ALWAYS "mobileapp"
      "name": "products:women:shorts",     // slash-path → colon-path via makePageName()
      "URL": "products/women/shorts",      // same value as _adobecmteas.pagePath
      "_adobecmteas": {
        "pageTitle": "...",
        "pagePath": "...",
        "pageType": "..."
      }
    },
    "webInteraction": {
      "linkClicks": { "value": 0 },        // 0 for page views; 1 for click events (login/logout)
      "name": "...",                        // pageTitle.toLowerCase() or product.name.toLowerCase()
      "_adobecmteas": {
        "engagement": {
          "transactionType": "..."          // see Engagement Values below
        }
      }
    }
  }
}
```

### `identities` is conditional
Only included in `_adobecmteas` when at least an ECID is present. Login and logout events always include it; page-view builders include it when available.

### `placeContext` — do NOT send from the app
The Edge Network datastream enriches events with `placeContext.geo` automatically from the sender's IP address. Never add this field in code.

---

## `makePageName()` helper

```typescript
const makePageName = (path: string): string =>
  path.replace(/^\//, '').replace(/\//g, ':');
```

Always use this to generate `web.webPageDetails.name` from `pagePath`:

| pagePath | name |
|---|---|
| `products/women/shorts/bahamas-shorts` | `products:women:shorts:bahamas-shorts` |
| `/cart` | `cart` |
| `/profile` | `profile` |

---

## Event types

| Builder | `eventType` |
|---|---|
| `buildPageViewEvent` | `mobileApp.navigation.pageViews` |
| `buildLoginEvent` / `buildLogoutEvent` | `mobileApp.navigation.clicks` |
| `buildProductViewEvent` | `commerce.productViews` |
| `buildProductListAddEvent` | `commerce.productListAdds` |
| `buildProductListOpenEvent` | `commerce.productListOpens` |
| `buildProductRemovalEvent` | `commerce.productListRemovals` |
| `buildCheckoutEvent` | `commerce.checkouts` |
| `buildPurchaseEvent` | `commerce.purchases` |
| `buildPushTrackingEvent` | `pushTracking.applicationOpened` or `pushTracking.customAction` |
| `buildPropositionDisplayEvent` | `decisioning.propositionDisplay` |
| `buildPropositionInteractEvent` | `decisioning.propositionInteract` |

---

## Engagement values (`transactionType`)

| Value | When to use |
|---|---|
| `Upper Funnel` | Browse, product view, add to cart, cart page |
| `Lower Funnel` | Checkout, purchase |
| `Authentication` | Login, logout |

---

## `linkClicks` rule

| Event class | `linkClicks.value` |
|---|---|
| Page views (`mobileApp.navigation.pageViews`) | `0` |
| Commerce events | `0` |
| Click/navigation events (`mobileApp.navigation.clicks`) | `1` |

---

## `productListItems` structure

Every item in the array must have this shape:

```jsonc
{
  "SKU": "eqswsuprs",
  "name": "Pro Series Swim Goggles",
  "quantity": 1,
  "priceTotal": 25,                        // unit price × quantity
  "productCategories": [
    { "categoryID": "primaryCategory",   "categoryName": "Equipment" },
    { "categoryID": "secondaryCategory", "categoryName": "Watersports" }  // when present
  ],
  "_adobecmteas": {
    "products": { "unitPrice": 25 },
    "lowerFunnel": { "cartID": "..." }     // cart events only (add, checkout, removal, purchase)
  }
}
```

- `formatProductListItems()` handles cart events (includes `cartID`).
- Product view and add builders inline the array directly (no `cartID` on the view itself, `cartID` present on add).

---

## Optional fields

| Field | Builder | When to include |
|---|---|---|
| `_adobecmteas.pageLoadTime` | `buildPageViewEvent` | Pass `pageLoadTime` in params when the screen measures it |
| `web.webPageDetails.siteSection` | `buildPageViewEvent` | Standard XDM top-level section |
| `web.webPageDetails._adobecmteas.siteSection2/3` | `buildPageViewEvent` | Sub-sections |
| `web.webPageDetails._adobecmteas.previousURL/pageName/pagePath` | `buildPageViewEvent` | Navigation breadcrumb |

---

## Adding a new builder — checklist

- [ ] `_id`, `timestamp`, `eventType`, `identityMap`
- [ ] `_adobecmteas` tenant block (channelInfo, identities when available, authentication, visitorDetails)
- [ ] `environment: buildEnvironment()`
- [ ] `web.webPageDetails` with `server: 'mobileapp'`, `name: makePageName(path)`, `URL: path`
- [ ] `web.webInteraction` with `linkClicks: { value: 0 or 1 }`, `name`, `_adobecmteas.engagement.transactionType`
- [ ] Correct `commerce.*` metric (`value: 1`)
- [ ] `productListItems` array when products are involved
- [ ] No `placeContext` — datastream handles it
