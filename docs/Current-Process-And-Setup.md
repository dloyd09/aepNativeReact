# Current Process and Setup Guide

This document captures the **development setup and run process** for the Native React Mobile App (Expo / Node), including steps that were originally on the [Adobe Wiki](https://wiki.corp.adobe.com/spaces/~dloyd/pages/3462410543/Native+React+Mobile+App+Expo+Node). For in-app configuration (App ID, Assurance, Push, etc.), see [README.md](../README.md). For QA use cases and fix plans, see [QA-Use-Cases-Review.md](QA-Use-Cases-Review.md) and [Fix-And-Test-Adjustment-Plan.md](Fix-And-Test-Adjustment-Plan.md).

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later; Node 20 LTS recommended for current toolchain)
- [Java 17 JDK](https://adoptium.net/)
- [Android Studio](https://developer.android.com/studio) (with SDK + Emulator)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (via project: `npx expo …`)
- Git
- PowerShell (for Windows users)

---

## Project origin and Windows path

If you cloned from the Adobe SDK mono-repo, move the app to a **shallow path** to avoid long-file-path issues on Windows:

- **From:** `C:\aepsdk\apps\AEPSampleAppNewArchEnabled` (or similar deep path)
- **To:** e.g. `C:\AEPSampleAppNewArchEnabled` or your workspace root

```powershell
Move-Item "C:\aepsdk\apps\AEPSampleAppNewArchEnabled" "C:\AEPSampleAppNewArchEnabled"
cd C:\AEPSampleAppNewArchEnabled
```

This repo may already be at a shallow path (e.g. `aepNativeReact/` in your workspace). The important part is **avoiding very long paths** when building on Windows.

---

## Metro config

The app uses Expo’s Metro bundler. A root `metro.config.js` should use the default Expo config, for example:

```javascript
const { getDefaultConfig } = require('@expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
```

If the project already has a root `metro.config.js`, ensure it’s present and that the `@/` path alias is resolved (see [Known issues](#known-issues--fixes) below).

---

## Running the app (Android)

### Option A: Single command (Expo)

From the app root (e.g. `aepNativeReact/`):

```powershell
npx expo run:android
```

Metro will start and the app will build and install. See [README.md](../README.md) for logs and troubleshooting.

### Option B: Two terminals (React Native CLI style)

If you prefer separate Metro and build steps:

**Terminal 1 – Metro bundler**

```powershell
npx react-native start
```

**Terminal 2 – Build and install**

```powershell
cd android
./gradlew clean
cd ..
npx react-native run-android
```

The first full build can take up to ~15 minutes.

---

## Killing stuck background processes (Windows)

If Metro, Gradle, or ADB get stuck, you can stop them (run PowerShell **as Administrator**):

```powershell
Stop-Process -Name "java"   -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node"  -Force -ErrorAction SilentlyContinue
Stop-Process -Name "adb"   -Force -ErrorAction SilentlyContinue
Stop-Process -Name "gradle" -Force -ErrorAction SilentlyContinue
```

Then restart Metro and/or run the app again.

---

## Project structure

High-level layout of the app:

| Path         | Purpose                          |
|-------------|-----------------------------------|
| `/app`      | App screens and navigation        |
| `/components` | Shared UI components           |
| `/hooks`    | Custom React hooks               |
| `/styles`   | Theme and style constants        |
| `/constants` | Environment and SDK constants  |
| `/types`    | TypeScript interfaces            |
| `/assets`   | Static images and resources      |

The path alias `@/` points at the app root (e.g. `import x from '@/components/X'`). See project rules and `tsconfig.json` for exact resolution.

---

## Known issues & fixes

### Long file paths on Windows

- **Symptom:** Build or Metro fails with path-length or resolution errors.
- **Fix:** Move the project to a shallow path (e.g. `C:\AEPSampleAppNewArchEnabled` or `…\my_workspace\aepNativeReact`). See [Project origin and Windows path](#project-origin-and-windows-path) above.

### Metro can’t resolve `@/components/...`

- **Symptom:** Imports like `@/components/ThemedText` fail to resolve.
- **Fix:** The project standard is to **use the `@/` alias**. Ensure `tsconfig.json` (and any Metro/Babel config) has the correct `paths` / `extraNodeModules` so `@/` resolves to the app root. If you must work around a broken alias temporarily, you can use relative paths (e.g. `from '../components/ThemedText'`), but prefer fixing the alias configuration.

### Splash screen stays forever

- **Symptom:** App opens but splash screen never hides.
- **Fix:** Ensure `app/_layout.tsx` handles the splash lifecycle and calls `SplashScreen.hideAsync()` after the app is ready (e.g. in a `useEffect` when init and routing are set up).

### Deep linking: separate URL scheme intent-filters (Android)

- **Symptom:** Adobe Assurance or the app’s custom URL scheme don’t open the app correctly.
- **Fix:** In `android/app/src/main/AndroidManifest.xml`, use **two separate intent-filters** for the two URL schemes:
  - One for `myapp` (e.g. Assurance)
  - One for the full package scheme `com.cmtBootCamp.AEPSampleAppNewArchEnabled`
  Each should have its own `&lt;intent-filter&gt;` with the appropriate `action` and `category`. Combining both schemes in a single intent-filter can break deep linking for one or both.

---

## Adobe SDK configuration (current vs. wiki)

The wiki once described **hardcoded environment IDs** in native files (e.g. `AdobeConfig.h` on iOS, `build.gradle` on Android) and init in `AdobeBridge.m`. The **current app** uses:

- **App ID** from in-app configuration (stored and applied at runtime), not a hardcoded env ID in native projects.
- **Init and extension registration** from `src/utils/adobeConfig.ts`, invoked from `app/_layout.tsx`.

Do not re-add hardcoded env IDs in native code; follow [README.md](../README.md) for App ID setup and leave the existing init flow in place.

---

## Optional: first-time repo / GitHub setup

If you are creating a new repo from this app:

```powershell
git init
git remote add origin https://github.com/YOUR_ORG/aepNativeReact.git
git config --global --add safe.directory C:/path/to/your/app
# Ensure node_modules/ is in .gitignore
git add .
git commit -m "Initial commit"
git push -u origin main
```

Adjust `origin` URL and branch name as needed.

---

## Related docs

- [README.md](../README.md) – App setup (App ID, Assurance, Push), troubleshooting, XDM, building APK
- [readme-PushTokens.md](../readme-PushTokens.md) – Push token lifecycle and mismatch fix
- [QA-Use-Cases-Review.md](QA-Use-Cases-Review.md) – QA use cases (Call Center Push, Purchase Journey, Cart Views, Decisioning)
- [Fix-And-Test-Adjustment-Plan.md](Fix-And-Test-Adjustment-Plan.md) – Fix plan, Windows toolchain, Android/iOS test paths
