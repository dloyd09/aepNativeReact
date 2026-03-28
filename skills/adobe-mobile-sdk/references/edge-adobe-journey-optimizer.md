# Edge Extension: Adobe Journey Optimizer
> `@adobe/react-native-aepmessaging`
> Docs: https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/

---

## What it is

The AJO Messaging extension enables two key mobile engagement channels delivered through Adobe Journey Optimizer:

- **In-App Messaging (IAM)** — modal, banner, or fullscreen messages triggered by SDK events or Journey Optimizer campaigns
- **Push Notifications** — rich push notifications tracked and managed through AJO

Both channels are routed through the Edge Network and require the Edge and Identity extensions to be registered.

---

## Installation

```bash
npm install @adobe/react-native-aepmessaging
```

iOS:
```bash
cd ios && pod install
```

---

## Prerequisites

```
@adobe/react-native-aepcore
@adobe/react-native-aepedge
@adobe/react-native-aepedgeidentity
```

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { Messaging } from '@adobe/react-native-aepmessaging';

MobileCore.registerExtensions([Edge, Identity, Messaging]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## In-App Messaging

IAM is triggered automatically based on rules configured in AJO — no additional API calls needed to display messages. The SDK fetches message definitions from AJO on app launch and evaluates trigger conditions locally.

### Refresh in-app messages manually
```typescript
import { Messaging } from '@adobe/react-native-aepmessaging';

// Force a refresh of in-app message definitions from AJO
Messaging.refreshInAppMessages();
```

---

## Push Notifications

### Sync push token
```typescript
import { MobileCore } from '@adobe/react-native-aepcore';

// Call after obtaining FCM/APNs token
MobileCore.setPushIdentifier('YOUR_DEVICE_PUSH_TOKEN');
```

### Track push notification interactions
```typescript
import { Messaging } from '@adobe/react-native-aepmessaging';

// Track when user taps a push notification
Messaging.handleNotificationResponse(notificationResponse);
```

---

## Bootcamp usage pattern

Use AJO Messaging to demonstrate:
- **IAM in Consumer View** — trigger an in-app message by performing a tracked action (e.g. "view product"), then show the message appearing as configured in AJO
- **Push token sync in Technical View** — show the push token being registered and visible in the identity map
- **Assurance validation** — confirm IAM fetch and trigger events in the Technical View event log

This shows learners the full loop: configure a message in AJO → trigger it via SDK event → observe it fire in the consumer experience.

---

## Key rules

- ✅ Register Edge and Identity for Edge Network — IAM fetch goes through Edge Network
- ✅ Call `setPushIdentifier` immediately after receiving the device token from FCM/APNs
- ✅ Show IAM trigger events in Assurance to confirm rule evaluation is working
- ❌ Do not use AJO Messaging without a configured Datastream pointing to AJO — messages won't load
- ❌ Do not call `refreshInAppMessages` on every screen render — only on explicit user action or app foreground

---

## API Reference
https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/api-reference/

## Push Notifications Guide
https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/push-notification/

## In-App Messaging Guide
https://developer.adobe.com/client-sdks/edge/adobe-journey-optimizer/in-app-message/