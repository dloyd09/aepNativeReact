# Base Extension: Mobile Core
> `@adobe/react-native-aepcore`
> Docs: https://developer.adobe.com/client-sdks/home/base/mobile-core/

---

## What it is

Mobile Core is **mandatory** for all Adobe Experience Platform SDK implementations. It provides the shared foundation that all other extensions depend on: the event hub, Rules Engine, networking, Identity services, Lifecycle tracking, Configuration management, and Signal.

No other extension works without Mobile Core registered first.

---

## Sub-components bundled in Mobile Core

| Sub-component | Purpose |
|---|---|
| **Configuration** | Loads rules and settings from Adobe Launch via `environmentFileID` |
| **Identity** | Manages Experience Cloud ID (ECID) and visitor identity |
| **Lifecycle** | Tracks app launch, crash, upgrade, and session data automatically |
| **Platform Services** | Shared networking and disk access layer used by all extensions |
| **Rules Engine** | Evaluates Launch rules and triggers consequences (signals, postbacks, etc.) |
| **Signal** | Sends data to third-party URLs based on Rules Engine triggers |

---

## Installation

```bash
npm install @adobe/react-native-aepcore
```

iOS — run after install:
```bash
cd ios && pod install
```

---

## Initialization pattern (React Native)

```typescript
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';

// Set log level before configuring — DEBUG for development, ERROR for production
MobileCore.setLogLevel(LogLevel.DEBUG);

// Configure with your Adobe Launch environment file ID
// This triggers a network call to download your Launch rules
MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
```

> ⚠️ Call `configureWithAppID` once at app bootstrap (e.g., `App.js`), never inside a component.

---

## Lifecycle tracking

Lifecycle must be wired to `AppState` changes, not React component mount/unmount:

```typescript
import { AppState } from 'react-native';
import { MobileCore } from '@adobe/react-native-aepcore';

AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    MobileCore.lifecycleStart({});
  } else if (nextState === 'background') {
    MobileCore.lifecyclePause();
  }
});
```

---

## Track Action and Track State

```typescript
// Track an interaction (button tap, form submit, etc.)
MobileCore.trackAction('add_to_cart', {
  'product.id': '12345',
  'product.name': 'AEP Hoodie',
});

// Track a screen/view
MobileCore.trackState('home_screen', {
  'user.type': 'authenticated',
});
```

---

## Identity APIs

```typescript
import { Identity } from '@adobe/react-native-aepcore';

// Get the Experience Cloud ID
const ecid = await Identity.getExperienceCloudId();

// Sync a known user identifier (e.g. CRM ID)
Identity.syncIdentifier('CRMID', 'user@example.com', MobileVisitorAuthenticationState.AUTHENTICATED);
```

---

## Key rules

- ✅ Always set log level **before** calling `configureWithAppID`
- ✅ Register all extensions **before** calling `MobileCore.start()` if used
- ✅ Wire Lifecycle to `AppState`, not component lifecycle methods
- ❌ Never call `configureWithAppID` inside a render cycle or useEffect
- ❌ Never hardcode the environment file ID — load from user config input

---

## API Reference
https://developer.adobe.com/client-sdks/home/base/mobile-core/api-reference/

## Configuration API Reference
https://developer.adobe.com/client-sdks/home/base/mobile-core/configuration/api-reference/

## Identity API Reference
https://developer.adobe.com/client-sdks/home/base/mobile-core/identity/api-reference/

## Lifecycle API Reference
https://developer.adobe.com/client-sdks/home/base/mobile-core/lifecycle/api-reference/