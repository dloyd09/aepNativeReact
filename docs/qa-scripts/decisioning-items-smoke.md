# Decisioning Items Smoke QA

Use this script to validate the consumer Decisioning Items tab against Adobe Assurance and expected app behavior.

## Preconditions

- App is installed on a real device or emulator with a valid Adobe App ID configured.
- Assurance session is connected.
- `Technical -> Decisioning Items` has a valid surface saved.
- At least one AJO Code-Based Experience campaign is published for that surface.
- If testing embedded offers, the payload includes an `isJsonContent` array and item tracking tokens.

## Test 1. Cold load with empty cache

1. Clear app data or reinstall the app.
2. Open `Technical -> Decisioning Items`.
3. Verify the saved surface is the expected one.
4. Navigate to the consumer `Decisioning Items` tab.
5. Observe the initial loading state.
6. Wait for content to render.

Expected:

- The tab loads without a crash.
- If no cache exists, the tab fetches content from Edge.
- One or more cards render for the configured surface, or the empty-state guidance appears.
- Assurance shows a page-view event for `pagePath: /decisioning-items`.

## Test 2. Warm cache vs freshness

1. Open `Decisioning Items` once and let it load.
2. Change the campaign content in AJO or activate a different experience for the same surface.
3. Return to the app and open the `Decisioning Items` tab again without pulling to refresh.

Expected today:

- Previously cached content may appear.
- Fresh Edge content may not appear until a manual refresh is triggered.

Expected after fix:

- Cached content may render first.
- A follow-up Edge refresh should run automatically and replace stale content if the campaign changed.

## Test 3. Manual refresh

1. Pull to refresh on the `Decisioning Items` tab.
2. Watch Assurance and device logs.

Expected:

- A server refresh is triggered for the configured surface.
- The rendered cards update if campaign content changed.
- No duplicate or stale cards remain after refresh.

## Test 4. Display tracking

1. Open the tab with at least two rendered cards.
2. Keep the first card in view.
3. Scroll away and back.
4. Rotate the device or trigger a layout change if practical.

Expected today:

- Display tracking may fire more than once because tracking is layout-driven.

Expected after fix:

- Each rendered proposition item is tracked when it becomes visible.
- Duplicate display events are suppressed unless repeat-display behavior is intentionally allowed.
- Assurance shows proposition display events with the expected surface, proposition ID, and item token where applicable.

## Test 5. Add to cart interaction

1. Tap `Add to Cart` on a standard decisioning item.
2. Repeat with a second item if available.

Expected:

- Proposition interaction tracking fires before or alongside commerce add-to-cart tracking.
- The item is added to the cart UI.
- Assurance shows the decisioning interaction and a commerce `productListAdds` event.
- If identity or cart session is missing, note whether commerce tracking is skipped.

## Test 6. Custom CTA

1. Test a card with an internal deep link CTA.
2. Test a card with an `https` CTA.
3. If available, test an unsupported or malformed scheme.

Expected:

- Internal deep links route correctly inside the app.
- `https` links open correctly.
- Unsupported schemes fail safely and are logged clearly.

## Test 7. Post-purchase refresh

1. Add a decisioning item to the cart.
2. Complete checkout.
3. Return to the `Decisioning Items` tab.

Expected today:

- In-app messages may refresh.
- Decisioning surface content may not refresh automatically.
- A manual refresh may still be required to see post-purchase experiences.

Expected after fix:

- The relevant decisioning surface is refreshed after purchase.
- Post-purchase decisioning content appears without requiring the user to manually refresh.

## Evidence to capture

- Screenshots of the rendered cards before and after refresh.
- Assurance screenshots for:
  - page view
  - proposition display
  - proposition interaction
  - productListAdds
- The exact configured surface name used during the run.

