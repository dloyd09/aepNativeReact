# Agent guide – WeRetail / Adobe AEP sample app

## Repo layout

- **Main app**: `aepNativeReact/` — single Expo (React Native) app. All app code, config, and native projects live here.
- **Workspace root**: This file and `.cursor/` (rules, skills). Do not assume other top-level app folders.

## Stack

- **Runtime**: React Native (Expo SDK ~51), TypeScript (strict).
- **Routing**: expo-router (file-based), drawer + tabs.
- **Analytics / identity**: Adobe Mobile SDK (AEP) — Edge, Identity, Consent, Messaging, Optimize, Target, Places, Assurance. Events go to Adobe Edge via XDM with `_adobecmteas` tenant.
- **Push**: Firebase Cloud Messaging (Android), native device token (iOS); registration with Adobe via `MobileCore.setPushIdentifier()`.
- **Path alias**: `@/` resolves to `aepNativeReact/` (e.g. `@/components`, `@/src/utils`).

## Key docs (in `aepNativeReact/`)

- `README.md` — setup, App ID, Assurance, push, XDM migration.
- `readme-PushTokens.md` — push token lifecycle, mismatch fix, Adobe registration.
- **Agent-facing QA and planning** (in `aepNativeReact/docs/`):
  - `docs/QA-Use-Cases-Review.md` — QA use cases (Call Center Push, Purchase In-App Journey, Cart Views in CJA, Decisioning); what to verify without code changes.
  - `docs/Fix-And-Test-Adjustment-Plan.md` — fix and test plan; Windows setup, Android/iOS test paths, phased delivery.

## Cursor rules and skills

- **Security**: Handled by `.cursor/rules/` security domains (security-global, security-lang). Do not weaken or bypass those rules.
- **Project conventions**: `.cursor/rules/project/` — overview, Adobe SDK usage, React Native/Expo patterns.
- **Adobe SDK QA**: Use the **qa-adobe-mobile-sdk** skill when reviewing or changing Adobe integration, event tracking, or push/identity.

## Don’t break

- App entry: `aepNativeReact/app/_layout.tsx` and expo-router entry.
- Adobe init: `aepNativeReact/src/utils/adobeConfig.ts`; init runs from `_layout.tsx` when App ID is stored.
- Event builders: `aepNativeReact/src/utils/xdmEventBuilders.ts` and `identityHelpers.ts` — consumer analytics must use these and `Edge.sendEvent(experienceEvent)`.
- Native projects: `aepNativeReact/android/`, `aepNativeReact/ios/` (if present) — don’t rename or move; links and IDs are referenced in app.json and docs.
