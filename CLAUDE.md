# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npx expo start                                          # dev server
npx expo run:android                                    # build + run Android
npx expo run:ios                                        # build + run iOS
node .\node_modules\typescript\bin\tsc --noEmit         # type check
npx expo lint                                           # lint
npx jest --ci --runInBand                               # all tests
npx jest src/utils/__tests__/xdmEventBuilders.test.ts  # single test
```

## Project

Expo / React Native demo app for Adobe Experience Platform Mobile SDK, used as a bootcamp teaching tool. The learning loop is sacred: **App ID → Assurance → login → push token → self-send test → AJO journey**. Never break this chain.

Two navigation layers (drawer in `app/_layout.tsx`):
- **`(consumerTabs)/`** — bottom-tab shopping experience (learner persona)
- **`(techScreens)/`** — per-extension diagnostic screens (hidden from drawer by default)

Path alias: `@/` resolves to repo root.

## Files That Must Not Be Broken

| File | Why |
|---|---|
| `app/_layout.tsx` | App entry, Drawer setup, push response listener, `ProfileProvider` + `CartProvider` mount |
| `src/utils/adobeConfig.ts` | SDK init sequence; called once per session |
| `src/utils/xdmEventBuilders.ts` | Add builders freely; never change existing signatures. See `docs/XDM-Event-Builder-Pattern.md` for required field checklist. |
| `src/utils/identityHelpers.ts` | Used by every event builder |
| `components/ProfileContext.tsx` | Single source of truth for shared user profile state across every consumer screen; AsyncStorage-backed. Replaces `useProfileStorage`. |
| `src/utils/safeParseJSON.ts` | Shared helper used by every AsyncStorage parse site; do not inline `JSON.parse` on stored values |
| `android/` and `ios/` | Native project files |
| `app.json` / `app.config.js` | Bundle IDs referenced in docs and Adobe console |

## Android Build Gotchas (after `expo prebuild --clean`)

**1. Java 17** — add to `android/gradle.properties`:
```
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot
```
Run `Get-ChildItem "C:\Program Files\Eclipse Adoptium\"` to find the current JDK path if the version above has changed.

**2. Firebase manifest merger** — edit `android/app/src/main/AndroidManifest.xml`:
- Add `xmlns:tools="http://schemas.android.com/tools"` to `<manifest>`
- Add `tools:replace="android:resource"` to the `com.google.firebase.messaging.default_notification_color` `<meta-data>` element

## Skills

Load a skill when the task matches — don't front-load all of them.

| Task | Skill |
|---|---|
| Evaluate any change before implementing | `/governance-check` |
| Implement an item from `docs/App-Optimization-Plan.md` | `/implement-item` |
| Audit XDM analytics instrumentation | `/xdm-audit` |
| Audit push notification registration health | `/push-audit` |
| Validate live Assurance session vs schema + app | `/assurance-validate` |
| Adobe SDK patterns (init, XDM, push, identity, consent) | `/adobe-mobile-sdk` |
