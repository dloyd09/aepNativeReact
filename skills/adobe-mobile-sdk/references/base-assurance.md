# Base Extension: Adobe Experience Platform Assurance
> `@adobe/react-native-aepassurance`
> Docs: https://developer.adobe.com/client-sdks/home/base/assurance/

---

## What it is

Assurance is Adobe's **real-time SDK debugging and validation tool**. It connects your running app to the Assurance UI in Adobe Experience Platform, giving you a live stream of SDK events, network requests, and extension state — without needing to instrument extra logging code.

In the context of this bootcamp app, Assurance is the **primary validation tool** for the Technical View. It lets learners visually confirm that their configured Launch tags are firing correctly.

---

## Installation

```bash
npm install @adobe/react-native-aepassurance
```

iOS:
```bash
cd ios && pod install
```

---

## Registration

Register Assurance alongside Mobile Core before `start()`:

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Assurance } from '@adobe/react-native-aepassurance';

MobileCore.registerExtensions([Assurance]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Starting an Assurance session

Assurance connects via a deep link URL generated in the AEP UI:

```typescript
import { Assurance } from '@adobe/react-native-aepassurance';

// Call this when user taps "Connect to Assurance" in Technical View
Assurance.startSession('assurance://?adb_validation_sessionid=YOUR_SESSION_ID');
```

Handle the deep link in your app entry point:

```typescript
import { Linking } from 'react-native';

Linking.getInitialURL().then((url) => {
  if (url) Assurance.startSession(url);
});

Linking.addEventListener('url', ({ url }) => {
  Assurance.startSession(url);
});
```

---

## Bootcamp usage pattern

The Technical View should expose an **Assurance connect button** that:
1. Accepts a session URL (QR code scan or paste from AEP UI)
2. Calls `Assurance.startSession(url)`
3. Displays connection status (connected / disconnected)

This lets bootcamp learners validate their SDK events live during the configure → run → observe loop.

---

## Key rules

- ✅ Only include Assurance in **development/debug builds** — never ship to production
- ✅ Surface the Assurance connect flow in **Technical View only**, not Consumer View
- ✅ Register Assurance before calling `configureWithAppID`
- ❌ Never hardcode an Assurance session URL — always accept it as runtime input
- ❌ Do not gate the learning loop on Assurance availability — it's a validation aid, not a requirement

---

## Resolving common issues
https://developer.adobe.com/client-sdks/home/base/assurance/common-issues/

## API Reference
https://developer.adobe.com/client-sdks/home/base/assurance/api-reference/