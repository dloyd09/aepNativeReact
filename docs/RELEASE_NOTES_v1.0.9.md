# Release Notes — v1.0.9

**Date:** 2026-03-27
**Status:** Pending QA / Local Testing
**Branches affected:** `main`

---

## Summary

This release focuses on three areas: push notification observability, data layer consistency, and cross-platform UI reliability. No new features or Adobe SDK APIs were added — all changes are quality, stability, and experience improvements in preparation for bootcamp delivery.

---

## 1. Push Notification Improvements

### 1.1 — Token Acquisition Logging
Structured console logging was added at the push token convergence point in `pushNotifications.ts`. Each token acquisition now logs platform label (`iOS/APNs`, `iOS/simulator-mock`, `Android/FCM`, `Android/mock`), a truncated token value (`first8…last8`), and an ISO timestamp. This gives instructors a clear checkpoint to confirm token registration without exposing full token values in logs.

### 1.2 — Foreground Push Receipt Logging
Added an `addNotificationReceivedListener` in `_layout.tsx` that fires when a push notification arrives while the app is in the foreground. Logs the notification title, data payload key names, and whether a deep link or Adobe message ID is present.

### 1.3 — Push Interaction Tracking via Edge
Added an `addNotificationResponseListener` that fires on user interaction with a push notification (open, custom action, or dismiss). Dismissal is a silent no-op. Opens send an `Edge.sendEvent` with XDM `eventType: pushTracking.applicationOpened`; custom action taps send `pushTracking.customAction` with the `actionID`. Both events include `pushProvider` (`apns` / `fcm`) and `pushProviderMessageID`.

---

## 2. Data Layer — Profile Storage Consistency

### 2.1 — Canonical `useProfileStorage` Hook Rollout
All remaining consumer screens that were reading the user profile directly from `AsyncStorage` were migrated to the shared `useProfileStorage` hook. This ensures profile state is consistent across all screens without independent re-reads, and that the `isProfileLoading` guard is applied uniformly before XDM events are dispatched.

**Screens updated:**
- `_home/[category].tsx`
- `_home/[category]/[product].tsx`
- `decisioningItems.tsx`
- `offers.tsx` — also had a duplicate local `useProfileStorage` function removed; the local definition had no `isProfileLoading` state, unguarded `JSON.parse`, and was isolated from shared hook state.

### 2.2 — Critical Fix: Consent Not Reset on App ID Clear
`AppIdConfigView.clearAppId()` was calling `Consent.update({ consents: { collect: { val: 'n' } } })`. This silently disabled all Edge event dispatching for the remainder of the session with no visible error — any student using "Reset App ID" instead of the Instructor Reset flow would see no data in Assurance or AEP for the rest of their session. The Consent reset has been removed. Consent remains hardcoded to `y` as intended. An inline comment documents the reason.

### 2.3 — Optimize Proposition Listener Cleanup
`Optimize.onPropositionUpdate()` in `offers.tsx` was being called without storing its return value, meaning the listener was never cleaned up on unmount. This could cause duplicate update handlers after the tab re-mounted. The subscription is now stored and `.remove()` is called in the `useEffect` cleanup.

### 2.4 — Decisioning Interaction Tracking Error Handling
`trackDecisioningItemInteraction()` in `decisioningItems.tsx` was called with `await` inside `handleAddToCart` without a try-catch. If the Edge network was not ready, this produced an unhandled promise rejection. The call is now wrapped in a try-catch with a console error fallback.

---

## 3. UI / UX — Safe Area & Scrolling Fixes

### 3.1 — Top Safe Area Missing on All Consumer Screens
The consumer tab layout uses `headerShown: false` for all screens. Every consumer screen was using `SafeAreaView` with `edges={['left', 'right']}`, which left the top edge unhandled. On devices with a notch or Dynamic Island, screen content (tab titles, Back buttons) was rendering behind the status bar.

**Fixed in:**
- `home.tsx` — `edges` updated to `['top', 'left', 'right']`
- `cart.tsx` — `edges` updated to `['top', 'left', 'right']`
- `profile.tsx` — `edges` updated to `['top', 'left', 'right']`
- `offers.tsx` — converted to `useSafeAreaInsets`, `paddingTop: insets.top` applied to container
- `decisioningItems.tsx` — `paddingTop: insets.top` applied to container
- `Checkout.tsx` — `edges` updated to `['top', 'left', 'right']`
- `_home/[category].tsx` — `paddingTop: insets.top` applied to `ThemedView`
- `_home/[category]/[product].tsx` — hardcoded `paddingTop: 48` replaced with `insets.top + 8`

### 3.2 — TechnicalScreen Hardcoded Top Margin
`TechnicalScreen.tsx` used a hardcoded `marginTop: 75` in its `contentContainerStyle`. On iPhone SE this caused content underlap; on larger-notch devices it left excessive whitespace. Replaced with `useSafeAreaInsets().top + 12` computed at render time.

### 3.3 — Cart FlatList Scrolling
The cart screen `ThemedView` had `justifyContent: 'center'` applied globally. This caused the `FlatList` inside the non-empty cart state to size itself to content rather than scrolling — users with 3+ items could not scroll to the Checkout button. `justifyContent: 'center'` was removed from the wrapper and `flex: 1, width: '100%'` was added to the `FlatList`.

### 3.4 — Offers FlatList Layout
Same `justifyContent: 'center'` pattern on the offers `ThemedView` was fighting the `FlatList` for vertical space. Container updated with `paddingTop: insets.top`; `justifyContent: 'center'` moved to the empty-state child only; `flex: 1` added to `FlatList`.

### 3.5 — TechnicalScreen KeyboardAvoidingView
`TechnicalScreen.tsx` used a bare `ScrollView` without `KeyboardAvoidingView`. On iOS, the software keyboard covered the decision scope `TextInput` in `OptimizeView` with no way to scroll past it. Wrapped the `ScrollView` in `KeyboardAvoidingView` with `behavior: 'padding'` on iOS and `keyboardVerticalOffset: insets.top`.

### 3.6 — Back Button Touch Targets
Multiple back buttons used `padding: 10`, below the recommended 44×44pt minimum touch target. Updated to `padding: 16` in:
- `Checkout.tsx`
- `_home/[category].tsx`
- `_home/[category]/[product].tsx` (both back buttons)

### 3.7 — Font Scaling Accessibility
`ThemedText.tsx` had `allowFontScaling={false}` applied globally, blocking iOS and Android system font size accessibility settings for all text in the app. The prop was removed. Text now respects the user's system font scale preference. Layouts are flex-based and will reflow gracefully at standard accessibility scales.

---

## Files Changed

| File | Change Type |
|---|---|
| `src/utils/pushNotifications.ts` | Enhancement — token logging |
| `app/_layout.tsx` | Enhancement — push received/response listeners |
| `app/(consumerTabs)/home.tsx` | Fix — SafeAreaView top edge |
| `app/(consumerTabs)/cart.tsx` | Fix — SafeAreaView top edge + FlatList scrolling |
| `app/(consumerTabs)/profile.tsx` | Fix — SafeAreaView top edge |
| `app/(consumerTabs)/offers.tsx` | Fix — SafeAreaView, FlatList layout, removed duplicate hook |
| `app/(consumerTabs)/decisioningItems.tsx` | Fix — SafeAreaView, interaction tracking error handling |
| `app/(consumerTabs)/Checkout.tsx` | Fix — SafeAreaView top edge, back button touch target |
| `app/(consumerTabs)/_home/[category].tsx` | Fix — SafeAreaView, back button touch target |
| `app/(consumerTabs)/_home/[category]/[product].tsx` | Fix — dynamic paddingTop, back button touch targets |
| `app/(techScreens)/AppIdConfigView.tsx` | Fix — removed consent reset from clearAppId |
| `app/(techScreens)/CoreView.tsx` | Cleanup — removed stale dead import |
| `app/(techScreens)/OptimizeView.tsx` | Cleanup — removed 5-second debug timeout |
| `components/TechnicalScreen.tsx` | Fix — dynamic safe area margin + KeyboardAvoidingView |
| `components/ThemedText.tsx` | Fix — removed allowFontScaling={false} |

---

## Testing Checklist

- [ ] App ID configuration → Assurance session connects
- [ ] "Reset App ID" — Edge events still fire after reset (consent regression check)
- [ ] Push token generates and logs correctly on both iOS and Android
- [ ] Self-send push → foreground receipt logs payload keys
- [ ] Tap push notification → `pushTracking.applicationOpened` appears in Assurance
- [ ] Consumer login → profile name appears in all screens (profile consistency check)
- [ ] Home → Category → Product → Add to Cart flow (scroll through multi-item cart)
- [ ] Checkout → Pay Now visible without scrolling on iPhone with home indicator
- [ ] Offers tab loads and scrolls with multiple offers
- [ ] Decisioning Items tab loads, scrolls, and Add to Cart works
- [ ] OptimizeView decision scope input not obscured by keyboard on iOS
- [ ] TechnicalScreen content not clipped on iPhone SE and iPhone 15 Pro Max
- [ ] Back buttons on Category and Product screens are easily tappable
- [ ] Large text accessibility setting (iOS Settings → Display & Text Size → Larger Text) — text reflows without overlap

---

*Pending Jira + Wiki update after local testing is confirmed.*
