# Commerce Fields We Populate (XDM)

This doc aligns with Adobe’s Commerce data type and CJA/reporting. It lists which commerce fields we send and any notable gaps.

## What we send

| Commerce field | Where we send it | Notes |
|----------------|------------------|--------|
| **commerce.productListViews.value** | Cart page view (`buildPageViewEvent` with `pageType: 'cart'`) | Added so “Cart Views” metrics in CJA can use this. |
| **commerce.productListOpens.value** | When a new cart session is created | `buildProductListOpenEvent`; sent from cart screen when `productListOpenPending` is set (see `useCartSession`). |
| **commerce.checkouts.value** | Checkout screen (“Proceed to checkout”) | `buildCheckoutEvent`; also `web.webPageDetails.pageViews.value: 1` for “Checkout Views” style metrics. |
| **commerce.purchases.value** | “Pay Now” on Checkout | `buildPurchaseEvent`. |
| **commerce.productListAdds.value** | Add to cart (product detail, offers, decisioning) | `buildProductListAddEvent`. |
| **commerce.productListRemovals.value** | Remove from cart | `buildProductRemovalEvent`. |
| **commerce.productListUpdates.value** | Quantity increase | `buildProductInteractionEvent`. |
| **commerce.productViews.value** | Product detail page | `buildProductViewEvent`. |

We also send on **purchase**:

- **commerce.order**: purchaseID, **priceTotal** (grand total = subtotal + shipping + tax), currencyCode, **taxAmount**
- **commerce.shipping.shippingAmount** (demo flat rate on Checkout; replace with real rates when available)
- **productListItems** with **priceTotal** per line item (merchandise subtotals)

Checkout computes subtotal from the cart, demo tax (8.25% of subtotal), demo shipping ($5.99), and passes **priceTotal** as the sum so Order Total / Revenue match the SDR.

## Optional / not sent (by design or later)

| Field | Meaning | Why we don’t send (or send later) |
|-------|--------|------------------------------------|
| **commerce.productListReopens** | Cart reopened after abandon | Not implemented; would need a definition of “abandoned” and “reopen”. |
| **commerce.cart** | Cart object (e.g. cart ID) | Cart session ID is carried in `_adobecmteas.lowerFunnel.cartID` on product list items; we don’t send a separate `commerce.cart` object. |
| **commerce.saveForLaters** | Wishlist / save for later | No wishlist in app. |
| **commerce.shipping / commerce.billing** | Shipping/billing details | Optional; not implemented. |

## Consistency fixes made

- **Checkout event:** Added `visitorDetails` to `_adobecmteas` and `web.webPageDetails.pageViews: { value: 1 }` so “Checkout Views” metrics can use it.
- **Cart page view:** Added `commerce.productListViews.value: 1` so “Cart Views” metrics that use this field populate.
- **New cart:** Added `buildProductListOpenEvent` and wiring from `useCartSession` + cart screen so `commerce.productListOpens` is sent when a new cart is created.

## References

- [Adobe Commerce data type](https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/commerce.html)
- [QA-Use-Cases-Review.md](QA-Use-Cases-Review.md) – Cart Views, Purchase, etc.
- [Automated-Checks-For-QA-Use-Cases.md](Automated-Checks-For-QA-Use-Cases.md) – What’s covered by tests
