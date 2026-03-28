# Solution Extension: Adobe Campaign Classic
> `@adobe/react-native-aepcampaignclassic`
> Docs: https://developer.adobe.com/client-sdks/solution/adobe-campaign-classic/
> ⚠️ **NOT INSTALLED** in this app — reference only. Do not add without governance approval.

---

## What it is

The Campaign Classic extension enables **push notification registration and tracking** for Adobe Campaign Classic (ACC). It handles device token registration with ACC and tracks push notification impressions and click-throughs back to Campaign reporting.

This extension is specifically for **Adobe Campaign Classic (v6/v7/v8)** — not Campaign Standard. If using Campaign Standard, that is a separate extension (not available in the AEP React Native package set).

---

## Installation

```bash
npm install @adobe/react-native-aepcampaignclassic
```

iOS:
```bash
cd ios && pod install
```

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { CampaignClassic } from '@adobe/react-native-aepcampaignclassic';

MobileCore.registerExtensions([CampaignClassic]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Core APIs

### Register device with Campaign Classic
```typescript
import { CampaignClassic } from '@adobe/react-native-aepcampaignclassic';

// Call after receiving FCM (Android) or APNs (iOS) push token
CampaignClassic.registerDeviceWithToken(
  'YOUR_PUSH_TOKEN',
  { 'userKey': 'user@example.com' } // optional additional data
);
```

### Track push notification receive
```typescript
// Track when a push notification is received (app in foreground/background)
CampaignClassic.trackNotificationReceive({
  '_mId': 'MESSAGE_ID',
  '_dId': 'DELIVERY_ID'
});
```

### Track push notification click
```typescript
// Track when user taps the push notification
CampaignClassic.trackNotificationClick({
  '_mId': 'MESSAGE_ID',
  '_dId': 'DELIVERY_ID'
});
```

---

## Bootcamp usage pattern

Use Campaign Classic to demonstrate the **push notification lifecycle**:
1. Show device registration in Technical View — confirm token sent to ACC
2. Simulate receiving a push (using a test delivery in ACC)
3. Show `trackNotificationReceive` and `trackNotificationClick` firing in Assurance
4. Correlate back to delivery reporting in the ACC console

This is a strong enterprise use case — many Adobe Campaign Classic clients are specifically looking for the React Native integration path.

---

## Key rules

- ✅ Always call `registerDeviceWithToken` after obtaining a fresh push token — tokens can rotate
- ✅ Track both receive and click events — both are needed for accurate Campaign delivery reporting
- ✅ Pass `_mId` and `_dId` from the push payload into tracking calls — these link back to the ACC delivery
- ❌ Do not confuse with Campaign Standard — that is a different product and extension
- ❌ Do not call `registerDeviceWithToken` without a valid non-empty token string

---

## API Reference
https://developer.adobe.com/client-sdks/solution/adobe-campaign-classic/api-reference/

## Push Templates
https://developer.adobe.com/client-sdks/solution/adobe-campaign-classic/push-templates/