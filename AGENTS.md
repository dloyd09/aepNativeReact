# Agent guide – WeRetail / Adobe AEP sample app

## Governance (read first)

This app is a teaching tool for structured bootcamps. The full governance framework is in `governance.md`. The core principle: **the learning loop is sacred** — configure App ID → verify Assurance → login → push token → self-send test → AJO journey. Any change that breaks or obscures that loop is a regression regardless of technical merit.

**Decision filter — apply before every change:**
1. Does it protect the learning loop?
2. Does it serve both audiences (consumer view + technical view)?
3. Is it aligned with Adobe SDK best practices?
4. Is it stable enough for a live bootcamp?
5. Would a new learner understand it without a guide?

Use `/governance-check` to evaluate any proposal explicitly. Use `/implement-item` to implement plan items with the filter built in.

**Governance tiers:**
- 🔴 Learning Loop — do first
- 🟡 Real-World Fidelity — misleads learners if absent
- 🟢 Clarity — noise that distracts from learning
- ⚪ Stability — cleanup, no curriculum impact

---

## Repo layout

- **Main app**: `aepNativeReact/` — single Expo (React Native) app. All app code, config, and native projects live here.
- **Workspace root**: This file lives at the workspace root. Do not assume other top-level app folders exist.

## Stack

- **Runtime**: React Native (Expo SDK ~51), TypeScript (strict).
- **Routing**: expo-router (file-based), drawer + tabs.
- **Analytics / identity**: Adobe Mobile SDK (AEP) — Edge, Identity, Consent, Messaging, Optimize, Target, Places, Assurance. Events go to Adobe Edge via XDM with `_adobecmteas` tenant namespace.
- **Push**: Firebase Cloud Messaging (Android), native APNs device token (iOS); registration with Adobe via `MobileCore.setPushIdentifier()`.
- **Path alias**: `@/` resolves to `aepNativeReact/` (e.g. `@/components`, `@/src/utils`).

## Key docs

- `README.md` — setup, App ID, Assurance, push, XDM migration.
- `readme-PushTokens.md` — push token lifecycle, mismatch fix, Adobe registration.
- `docs/App-Optimization-Plan.md` — **primary planning doc** — 30 active items across 7 groups covering SDK init, push fixes, event coverage, tech screen accuracy, and cleanup. Read this before implementing any change.
- `docs/Fix-And-Test-Adjustment-Plan.md` — phased fix and test plan; push registration sequence, purchase journey, decisioning.
- `docs/QA-Use-Cases-Review.md` — QA use cases (Call Center Push, Purchase In-App Journey, Cart Views in CJA, Decisioning).

## Custom slash commands

These commands are available in Claude Code for this project:

| Command | Purpose |
|---|---|
| `/implement-item` | Implement a single item from `docs/App-Optimization-Plan.md` following project patterns |
| `/xdm-audit` | Audit XDM event coverage across all consumer screens — report only, no code changes |
| `/push-audit` | Audit push notification registration health against plan items 4.2, 4.6, 4.7 — report only |

## XDM event pattern (consumer screens)

All consumer analytics follow this pattern — do not deviate:

```typescript
// 1. Get identity state (ECID + email) from the screen's existing identity hook/state
// 2. Build the event using a builder from src/utils/xdmEventBuilders.ts
const event = buildPageViewEvent({ ecid, email, pageTitle, ... });
// 3. Send via Edge
await Edge.sendEvent(event);
```

**Never** construct raw XDM objects inline in screen files. **Never** call `Edge.sendEvent()` with a manually assembled object — always go through the builders.

Available builders (all in `src/utils/xdmEventBuilders.ts`):
- `buildPageViewEvent()` — all screen focus events; accepts optional `productListItems` for commerce context
- `buildProductViewEvent()` — single product detail screen
- `buildProductListAddEvent()` — add to cart
- `buildProductRemovalEvent()` — remove from cart
- `buildProductListOpenEvent()` — new cart session created
- `buildCheckoutEvent()` — checkout initiated
- `buildPurchaseEvent()` — order completed
- `buildLoginEvent()` / `buildLogoutEvent()` — authentication events

## Push registration pattern

The correct registration sequence (items 4.2 + 4.6 in the optimization plan):

1. Obtain platform token (APNs on iOS, FCM on Android)
2. Fetch ECID via `Identity.getExperienceCloudId()`
3. If ECID is present → `MobileCore.setPushIdentifier(token)`
4. If ECID is absent → store as `pendingPushToken`, do NOT call `setPushIdentifier`
5. After `configureAdobe()` completes or after login → call `retryPendingPushToken()`

Mock tokens (`MockToken_*`, `AndroidMockToken_*`) must never be passed to `setPushIdentifier`.

## Curriculum dependency chain

This app teaches a linear bootcamp curriculum. Each step is a prerequisite for the next:

```
1. App ID configured + Launch tag property published
        ↓
2. Assurance connection verified
        ↓
3. Profile login → ECID confirmed
        ↓
4. Push token generated + ECID present at registration
        ↓
5. Self-send push test (confirm end-to-end delivery)
        ↓
6. AJO Journey sends to device
```

## Known Android build gotchas

These issues recur after `expo prebuild --clean` regenerates the `android/` folder. Fix them before running `./gradlew` if the build fails.

### 1. Java 17 required — gradle.properties is wiped on clean prebuild

Android Gradle plugin requires Java 17. The system default is Zulu JDK 11 (`C:\Program Files\Zulu\zulu-11`). JDK 17 is installed at `C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot`.

After every `expo prebuild --clean`, re-add this line to `android/gradle.properties`:

```
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot
```

Permanent fix: set `JAVA_HOME` to the JDK 17 path via Windows System Environment Variables so it survives prebuilds.

### 2. Firebase manifest merger conflict — AndroidManifest.xml is wiped on clean prebuild

`react-native-firebase/messaging` declares `com.google.firebase.messaging.default_notification_color` pointing to `@color/white`. The app also declares it pointing to `@color/notification_icon_color`. The merger fails unless the app's entry has `tools:replace`.

After every `expo prebuild --clean`, apply two edits to `android/app/src/main/AndroidManifest.xml`:

1. Add `xmlns:tools="http://schemas.android.com/tools"` to the `<manifest>` tag.
2. Add `tools:replace="android:resource"` to the `com.google.firebase.messaging.default_notification_color` `<meta-data>` element.

Permanent fix: write a local Expo config plugin that patches the manifest automatically during prebuild so these edits never need to be made manually.

---

## Do not break

- `app/_layout.tsx` — app entry, router setup, push response listener
- `src/utils/adobeConfig.ts` — SDK initialization flow; called once on startup with stored App ID
- `src/utils/xdmEventBuilders.ts` — event builder signatures; add new builders, never change existing ones
- `src/utils/identityHelpers.ts` — identity helpers used across all event builders
- `android/` and `ios/` — native project files; do not rename, move, or modify
- `app.json` / `app.config.js` — Expo config; bundle IDs and project IDs are referenced in docs

## Adobe SDK imports

| Extension | Package | Primary use |
|---|---|---|
| MobileCore | `@adobe/react-native-aepcore` | Init, log level, push identifier, privacy, identities |
| Edge | `@adobe/react-native-aepedge` | `Edge.sendEvent()` for all XDM events |
| Edge Identity | `@adobe/react-native-aepedgeidentity` | ECID, identity map, login/logout identities |
| Edge Consent | `@adobe/react-native-aepedgeconsent` | Consent preferences |
| Messaging | `@adobe/react-native-aepmessaging` | In-app messages, code-based experiences |
| Optimize | `@adobe/react-native-aepoptimize` | Target decisioning, proposition tracking |
| Places | `@adobe/react-native-aepplaces` | Geolocation POIs (tech screen only) |
| Assurance | `@adobe/react-native-aepassurance` | Debug session connection |
| UserProfile | `@adobe/react-native-aepuserprofile` | Local user attribute storage |
