# Push Token Management Overview

## 🔑 Understanding Push Tokens

Push tokens are unique identifiers that allow services to send push notifications to your device. In this app, we use different token systems for iOS and Android:

- **iOS**: Expo Push Tokens (via Expo's push service)
- **Android**: FCM (Firebase Cloud Messaging) tokens

## 🚨 Common Issue: Push Token Mismatch

### What is a Push Token Mismatch?

When you see **"Push Token Mismatch"** in Adobe Assurance, it means:
- Adobe's profile has stored an **old push token**
- Your device now has a **new/different push token**
- Adobe can't deliver notifications because the tokens don't match

### Why Does This Happen?

Push tokens can change when:
- ✅ App is reinstalled
- ✅ App data is cleared
- ✅ Device is restarted
- ✅ Firebase configuration changes
- ✅ Development builds are updated

### The Problem
```
Adobe Profile: "Token ABC123" (old)
Your Device:   "Token XYZ789" (new)
Result:       ❌ Mismatch - notifications won't work
```

## 🔧 How to Fix Push Token Mismatch

### Step 1: Clear Adobe Tokens
1. Open the app
2. Go to **"Push Notifications"** screen
3. Tap **"Clear Adobe Push Tokens (Fix Mismatch)"** button
4. This clears the old token from Adobe's profile

### Step 2: Reset Adobe Profile
1. **Restart the app completely** (force close and reopen)
2. Go to **"App ID Configuration"** screen
3. Re-enter your Adobe App ID
4. This creates a fresh Adobe profile

### Step 3: Register New Token
1. Start a new **Assurance session**
2. Go to **"Push Notifications"** screen
3. Tap **"Register for Push Notifications"**
4. This registers your current FCM token with Adobe

### Step 4: Verify Success
- ✅ Adobe Assurance should show the correct token
- ✅ No more "Push Token Mismatch" error
- ✅ Push notifications will work properly

## 🔄 Token Lifecycle

### Normal Flow:
```
1. App starts → Generate new FCM token
2. Register token with Adobe Messaging
3. Adobe stores token in user profile
4. Notifications work ✅
```

### When Mismatch Occurs:
```
1. App starts → Generate new FCM token
2. Adobe still has old token in profile
3. Tokens don't match → Mismatch error ❌
4. Need to clear and re-register
```

## 🛠️ Technical Details

### Token Registration Process:
```typescript
// 1. Get FCM token from Firebase
const fcmToken = await messaging().getToken();

// 2. Register with Adobe Messaging extension
await Messaging.setPushIdentifier(fcmToken);

// 3. Register with MobileCore (for Assurance)
await MobileCore.setPushIdentifier(fcmToken);
```

### Clearing Tokens:
```typescript
// Clear from Adobe Messaging
await Messaging.setPushIdentifier('');

// Clear from MobileCore
await MobileCore.setPushIdentifier('');

// Reset identities (clears ECID and profile)
MobileCore.resetIdentities();
```

## 📱 Platform Differences

### iOS (Expo Tokens):
- Uses Expo's push notification service
- Tokens format: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`
- More stable, changes less frequently

### Android (FCM Tokens):
- Uses Firebase Cloud Messaging
- Tokens format: Long alphanumeric string
- Can change more frequently during development

## 🎯 Best Practices

### For Development:
1. **Clear tokens** when switching between development builds
2. **Reset Adobe profile** when changing App IDs
3. **Test token registration** after major app updates

### For Production:
1. **Monitor token changes** and handle gracefully
2. **Implement token refresh** listeners
3. **Log token registration** for debugging

## 🚀 Quick Fix Checklist

When you see "Push Token Mismatch":

- [ ] Go to Push Notifications screen
- [ ] Tap "Clear Adobe Push Tokens (Fix Mismatch)"
- [ ] Force close and restart the app
- [ ] Reconfigure App ID
- [ ] Start new Assurance session
- [ ] Register for push notifications
- [ ] Verify no mismatch error

## 🔍 Troubleshooting

### Still Getting Mismatch?
1. **Check App ID**: Ensure it's correctly configured
2. **Verify Network**: Make sure you have internet connectivity
3. **Clear All Caches**: Use "Clear All Adobe Caches" button
4. **Restart Device**: Sometimes helps with FCM token issues

### Token Not Generating?
1. **Physical Device**: FCM only works on real devices, not simulators
2. **Firebase Config**: Ensure `google-services.json` is properly configured
3. **Permissions**: Check that notification permissions are granted

## 📚 Related Documentation

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Adobe Messaging Extension](https://developer.adobe.com/client-sdks/documentation/messaging/)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)

---

**Remember**: Push token mismatches are common during development. The "Clear Adobe Push Tokens" button is specifically designed to fix this issue quickly and easily.
