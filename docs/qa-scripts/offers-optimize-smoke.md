# Offers Optimize Smoke QA

Use this script to validate the consumer Offers tab and its alignment with the technical Optimize flow.

## Preconditions

- App is installed on a real device or emulator with a valid Adobe App ID configured.
- Assurance session is connected.
- `Technical -> Optimize` has a valid decision scope saved.
- An Adobe Optimize activity is live for that decision scope.

## Test 1. Scope load and cold cache

1. Clear app data or reinstall the app.
2. Open `Technical -> Optimize`.
3. Save the intended decision scope.
4. Go directly to the consumer `Offers` tab without warming the cache elsewhere.

Expected today:

- The scope loads from AsyncStorage.
- The Offers tab may show `No offers available` because it only reads cache.

Expected after fix:

- The Offers tab triggers an Optimize network refresh.
- Offers render without requiring a prior visit to the technical screen.

## Test 2. Warm cache baseline

1. In `Technical -> Optimize`, run the proposition update flow.
2. Return to the consumer `Offers` tab.

Expected:

- Offers render from cache.
- Assurance should show the consumer page-view event.

## Test 3. Refresh button behavior

1. On the consumer `Offers` tab, tap `Refresh Offers`.
2. Watch Assurance and logs.

Expected today:

- The button re-reads cache only.
- No real network fetch occurs.

Expected after fix:

- The button triggers `Optimize.updatePropositions`.
- New or changed offers appear after refresh.

## Test 4. Scope change propagation

1. In `Technical -> Optimize`, change the decision scope to a different valid scope.
2. Return to `Offers`.
3. Refresh or wait for proposition updates.

Expected today:

- The consumer listener may still behave as if the old scope is active.

Expected after fix:

- The consumer tab uses the latest scope consistently for both refresh and listener updates.

## Test 5. Offer display tracking

1. Open the `Offers` tab with at least one rendered offer.
2. Keep the first offer visible.
3. Scroll away and back if the list is long enough.

Expected today:

- Proposition display tracking from the consumer tab may be missing.

Expected after fix:

- Display tracking fires when the offer becomes visible.
- Assurance shows the expected Optimize proposition display events.

## Test 6. Offer interaction and add to cart

1. Tap `Add to Cart` on a rendered offer.
2. Check Assurance.

Expected today:

- Cart add tracking may appear.
- Optimize proposition interaction tracking may be missing from the consumer tab.

Expected after fix:

- Optimize proposition interaction tracking fires for the tapped offer.
- Commerce `productListAdds` also appears when identity and cart session are ready.

## Test 7. Missing image fallback

1. Test with an offer payload that omits `image` or uses an empty image string.

Expected today:

- Rendering may attempt to use an empty `Image` URI.

Expected after fix:

- A placeholder renders instead of a broken image request.

## Evidence to capture

- Screenshots of the Offers tab for cold cache and warm cache runs.
- Assurance screenshots for:
  - page view
  - Optimize display
  - Optimize interaction
  - productListAdds
- The exact decision scope used during the run.

