# Push Token Management Overview

Push tokens allow Adobe and the platform push providers to target a specific device.

This app uses:

- iOS: native APNs device token
- Android: FCM token

## Current Registration Model

The app now applies push tokens to Adobe automatically with `MobileCore.setPushIdentifier()`.

That means:

- there is no separate required "register token with Adobe" step in the Push screen
- startup can re-apply an already-known token
- Android token refreshes are pushed back to Adobe automatically

## Common Issue: Push Token Mismatch

When Assurance shows a push token mismatch, Adobe is holding an older token than the one currently used by the device.

Typical reasons:

- app reinstall
- cleared app data
- token rotation
- switching App IDs / environments

## Recovery Flow

1. Open `Push`
2. Tap `Clear Adobe Push Tokens (Fix Mismatch)`
3. Force close and relaunch the app
4. Reconfigure App ID if needed
5. Request push notifications again
6. Verify Assurance now shows the same token as the app

## Normal Lifecycle

Normal path:

1. App starts or push registration runs
2. Current APNs / FCM token is retrieved
3. App calls `MobileCore.setPushIdentifier(token)`
4. Adobe stores the token on the current profile

Mismatch path:

1. Device gets a newer token
2. Adobe profile still holds an older token
3. Delivery and reporting can fail until Adobe is updated or reset

## Technical Detail

Adobe registration:

```typescript
await MobileCore.setPushIdentifier(token);
```

Android token source:

```typescript
const fcmToken = await messaging().getToken();
```

iOS token source:

```typescript
const apnsToken = await Notifications.getDevicePushTokenAsync();
```

Clearing Adobe token state:

```typescript
await MobileCore.setPushIdentifier('');
MobileCore.resetIdentities();
```

## Best Practices

- Configure App ID before validating push flows
- Use a physical device, not a simulator
- Verify the exact token in Assurance before testing delivery
- Re-test after reinstall or token rotation scenarios

## Quick Checklist

- App ID configured
- Notification permission granted
- Current device token shown in the app
- Matching token shown in Assurance
- Adobe profile refreshed if mismatch recovery was needed
