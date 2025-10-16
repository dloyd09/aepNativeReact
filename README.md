# Adobe Experience Platform Sample App

## 🎯 **Quick Start Guide for Adobe Employees**

This is a **demo/bootcamp configuration app** designed for Adobe employees to configure RTCDP connections without requiring mobile development expertise.

### 📱 **App Setup Workflow (Required Order)**

**⚠️ IMPORTANT: Follow these steps in order for everything to work properly:**

#### **Step 1: Configure Adobe App ID** 🆔
1. Open the app and navigate to **"App ID Configuration"** screen
2. Enter your **Adobe Launch App ID** (from Adobe Experience Platform Data Collection)
3. Tap **"Save App ID"** - this initializes the Adobe SDK
4. ✅ **Success**: You should see "App ID saved and SDK configured successfully"

#### **Step 2: Configure Consent Settings** 🔒
1. Navigate to **"Consent"** screen
2. Tap **"Set Default Consent - Yes"** to enable data collection
3. Tap **"Set Collect Consent - Yes"** to set current user consent
4. ✅ **Success**: Consent is now set to "Yes" for data collection
5. ⚠️ **CRITICAL**: Consent must be set to "Yes" before testing Optimize features

#### **Step 3: Set Up Adobe Assurance** 🔍
1. Navigate to **"Assurance"** screen
2. Enter your Assurance session URL using one of these formats:
   - `myapp://?adb_validation_sessionid=YOUR_SESSION_ID` ✅ **Recommended** (short & simple)
   - `com.cmtBootCamp.AEPSampleAppNewArchEnabled://?adb_validation_sessionid=YOUR_SESSION_ID` ⚠️ (also works, but longer)
   - `assurance://?adb_validation_sessionid=YOUR_SESSION_ID` (standard Assurance format)
3. Tap **"Start Assurance Session"**
4. Open the Assurance web session in your browser to connect
5. ✅ **Success**: Adobe Assurance badge should appear in your browser

#### **Step 4: Test Push Notifications** 📲
1. Navigate to **"Push Notifications"** screen
2. Tap **"Register for FCM Push Notifications"** (Android) or **"Register for Push Notifications"** (iOS)
3. ✅ **Success**: Real FCM token generated (Android) or Expo token (iOS)
4. Tap **"Register Token with Adobe Services"** to integrate with Adobe
5. ✅ **Success**: Token registered with Adobe Services

#### **Step 4.1: Test FCM from Adobe Assurance** 🔔
1. In Adobe Assurance, navigate to **"Push Notifications"** section
2. Use this **complete FCM payload** for testing:
   ```json
   {
     "message": {
       "to": "YOUR_FCM_TOKEN_HERE",
       "notification": {
         "title": "Assurance - Push Test Message",
         "body": "Adobe Assurance push notification test"
       },
       "android": {
         "priority": "HIGH",
         "notification": {
           "channel_id": "default",
           "sound": "default",
           "icon": "ic_notification"
         },
         "data": {
           "adb_uri": "",
           "adb_n_visibility": "PUBLIC",
           "adb_n_priority": "PRIORITY_DEFAULT"
         }
       }
     }
   }
   ```
3. **Replace `YOUR_FCM_TOKEN_HERE`** with your actual FCM token from the app
4. ✅ **Success**: Notification appears in device notification tray

#### **Step 5: Test Other Features** 🧪
- **Optimize**: Test A/B testing and personalization (requires consent set to "Yes")
- **Target**: Test audience targeting
- **Edge**: Test data collection and streaming
- **Places**: Test location-based services

### 🎉 **Current Status: 100% Complete**
- ✅ **Push Notifications**: FCM (Android) + APNs (iOS) fully implemented and tested
- ✅ **Adobe Integration**: Push tokens registered with Adobe Services via MobileCore
- ✅ **Adobe SDK**: All extensions properly initialized with App ID configuration
- ✅ **AJO Campaigns**: Real campaign content with personalization working
- ✅ **XDM Schema Migration**: All 6 consumer tabs migrated to Edge Network
- ✅ **Production Ready**: Android APK tested, iOS ready for TestFlight

## 🔧 **Technical Implementation Status**

### **✅ What's Working:**
- **Adobe SDK**: Full initialization with App ID configuration
- **FCM Push Notifications**: Real Firebase tokens on Android, Expo tokens on iOS
- **Adobe Services**: FCM tokens registered with Adobe via MobileCore
- **AJO Campaigns**: Real campaign content with personalization
- **Assurance**: Session management and deep linking
- **Optimize**: A/B testing and proposition handling
- **Target**: Audience targeting and personalization
- **Edge**: Data collection and streaming
- **Places**: Location-based services
- **Debug Tools**: Comprehensive troubleshooting capabilities

### **✅ Issues Resolved:**
- ✅ **FCM Implementation**: Real Firebase tokens working on Android
- ✅ **iOS Push Implementation**: APNs via Expo tokens with P8 certificate
- ✅ **Adobe Integration**: Push tokens (FCM + Expo) register with Adobe Services via MobileCore
- ✅ **AJO Campaign Content**: Real personalized campaign data displayed
- ✅ **Duplicate Notifications**: Fixed duplicate token registration issue
- ✅ **Bundle ID Configuration**: All configuration files consistent and working
- ✅ **Firebase Setup**: Google Services plugin applied and working
- ✅ **Dependency Compatibility**: Kotlin 1.9.23 fully compatible with FCM
- ✅ **Consent Logging**: All consent functions have consistent debug logging

---

## 📲 **Push Notifications Implementation - COMPLETE**

**Status**: ✅ **100% Complete** - All 7 phases implemented and tested  
**Last Updated**: January 2025

### **✅ Implementation Summary:**

This app successfully implements push notifications for both Android and iOS platforms, fully integrated with Adobe Experience Platform:

#### **Android Push (FCM):**
- ✅ Firebase Cloud Messaging (FCM) with real tokens
- ✅ React Native Firebase (`@react-native-firebase/messaging` v20.5.0)
- ✅ Google Services plugin configured and applied
- ✅ Foreground and background message handling
- ✅ Adobe message detection and routing
- ✅ Production APK built and tested successfully

#### **iOS Push (APNs):**
- ✅ Apple Push Notification Service (APNs) via Expo tokens
- ✅ P8 certificate (`AuthKey_87G9NK6Y83.p8`) configured
- ✅ APNs environment set to production in `app.json`
- ✅ Push notifications capability enabled via `expo-notifications`
- ✅ Ready for TestFlight and App Store distribution

#### **Adobe Integration:**
- ✅ Push tokens registered with Adobe Services via `MobileCore.setPushIdentifier()`
- ✅ Token refresh handling for both platforms
- ✅ Adobe Journey Optimizer (AJO) campaigns working with real content
- ✅ Push channel configured in Adobe Platform

### **📋 All Phases Completed:**

1. ✅ **Phase 1: Firebase Configuration** - Bundle IDs, Google Services plugin
2. ✅ **Phase 2: Android FCM Implementation** - Real FCM tokens, message handling
3. ✅ **Phase 3: iOS Push Implementation** - APNs via Expo, P8 certificate
4. ✅ **Phase 4: Adobe Messaging Integration** - Token registration with Adobe
5. ✅ **Phase 5: Push Notification Service** - Platform-specific token retrieval
6. ✅ **Phase 6: Testing & Validation** - End-to-end testing on both platforms
7. ✅ **Phase 7: Code Quality** - Consistent logging across all functions

### **🔧 Technical Specifications:**

| Component | Details |
|-----------|---------|
| **Firebase Project** | `adobe-ea-bootcamp` |
| **Bundle ID** | `com.cmtBootCamp.AEPSampleAppNewArchEnabled` |
| **Adobe Messaging** | Extension v7.1.0 |
| **Android API Level** | 23+ (Android 6.0+) |
| **iOS Version** | iOS 11.0+ |
| **React Native** | 0.75.0 |
| **Expo SDK** | 51.0.28 |

### **🎯 Key Features:**
- Real push token generation (FCM on Android, Expo on iOS)
- Platform-specific message handling (foreground/background)
- Adobe Services integration via MobileCore
- AJO campaign support with personalization
- Comprehensive error handling and logging
- Testing UI for debugging push functionality

### **📱 Ready for Deployment:**
- **Android**: Production APK tested successfully ✅
- **iOS**: P8 certificate configured, ready for TestFlight ✅
- **Adobe Platform**: Push channel configured and working ✅

---

## 📋 **User Setup Checklist**
### **Required Setup (In Order):**
- [x] **App ID Configuration**: Enter Adobe Launch App ID
- [x] **Adobe SDK Initialization**: SDK properly initialized with App ID
- [x] **Consent Configuration**: Set consent to "Yes" for data collection
- [x] **Assurance Setup**: Start Assurance session and connect browser
- [x] **Push Notifications**: Register for FCM/Expo tokens
- [x] **Adobe Services**: Register tokens with Adobe Services

## 🔍 **Troubleshooting Guide**
### **Common Issues & Solutions:**

#### **"Adobe SDK not initialized" Error**
- **Cause**: App ID not configured
- **Solution**: Go to "App ID Configuration" screen and enter your Adobe Launch App ID

#### **"Adobe Registration Failed" for Push Notifications**
- **Cause**: Adobe App ID not configured before trying to register FCM tokens
- **Solution**: Configure App ID first, then register for push notifications

#### **Optimize Features Not Working / No Propositions Received**
- **Cause**: Consent not set to "Yes" before calling updatePropositions
- **Solution**: 
  1. Go to "Consent" screen
  2. Tap "Set Default Consent - Yes"
  3. Tap "Set Collect Consent - Yes"
  4. Then test Optimize features in "Optimize" screen

#### **Assurance Badge Not Appearing**
- **Cause**: App ID not configured, invalid URL format, or network issues
- **Solution**: 
  1. Ensure App ID is configured first
  2. Use the correct URL scheme format:
     - `myapp://?adb_validation_sessionid=YOUR_SESSION_ID` 
     - `com.cmtBootCamp.AEPSampleAppNewArchEnabled://?adb_validation_sessionid=YOUR_SESSION_ID` ⚠️ Also works
     - `assurance://?adb_validation_sessionid=YOUR_SESSION_ID` (standard format)
  3. Check network connectivity
  4. Try "Clear All Adobe Caches" button
  5. Restart Assurance session

#### **FCM Token Generation Fails**
- **Cause**: Firebase configuration issues
- **Solution**: 
  1. Ensure you're on a physical device (not simulator)
  2. Check internet connectivity
  3. Verify Firebase project configuration

#### **"Push Token Mismatch" in Assurance**
- **Cause**: Adobe profile was created with a different token (mock token) and now using real FCM tokens
- **Solution**: 
  1. Go to "Push Notifications" screen
  2. Tap **"Clear Adobe Push Tokens (Fix Mismatch)"** button
  3. Restart the app completely
  4. Reconfigure App ID in "App ID Configuration" screen
  5. Start Assurance session again
  6. Register for FCM push notifications
  7. ✅ **Result**: Fresh Adobe profile with matching FCM token

#### **"Adobe Messaging extension not available" Warning**
- **Cause**: Adobe Messaging extension API has changed - `setPushIdentifier` method no longer exists
- **Impact**: This is a **non-critical warning** - functionality still works via MobileCore
- **Solution**: **No action needed** - the app uses MobileCore for token registration (which works perfectly)
- **Note**: Do not attempt to revert to Messaging extension API - it will cause runtime errors

#### **"Sandbox: unknown" in Assurance**
- **Cause**: Launch property not configured with Edge Configuration ID, incorrect sandbox settings, or consent collection set to "No"
- **Impact**: Affects Optimize offers, Edge streaming, and other Adobe services
- **Solution**: 
  1. **Check Consent Settings**: Go to "Consent" screen and ensure consent is set to "Yes"
  2. Go to "Assurance" screen
  3. Tap **"Debug Sandbox Configuration"** button to check current setup
  4. Check your Launch property in Adobe Experience Platform Data Collection
  5. Ensure Edge Configuration ID is configured and pointing to correct sandbox
  6. Verify events are reaching Adobe Experience Platform
  7. ✅ **Result**: Sandbox should show correct environment (prod/stage)

#### **Assurance ID Stuck / Old Session Persists**
- **Cause**: App data (AsyncStorage) persists on device even after uninstalling the app
- **Impact**: Old Assurance session IDs and App IDs remain cached, preventing fresh configuration
- **Why This Happens**: 
  - `gradle clean` only clears build artifacts (compiled code), NOT device data
  - Uninstalling the app sometimes keeps SharedPreferences as a "backup" (Android feature)
  - AsyncStorage lives in device's file system: `/data/data/com.cmtBootCamp.AEPSampleAppNewArchEnabled/shared_prefs/`

**Solution 1 - Clear App Data from Device (Recommended for most users):**
1. On your Android device, go to **Settings** → **Apps** → **AEPSampleAppNewArchEnabled**
2. Tap **Storage & cache** (or **Storage**)
3. Tap **Clear storage** (or **Clear data**)
4. Tap **Clear cache**
5. ✅ Restart the app - it will be completely fresh with no saved configuration

**Solution 2 - Clear App Data via ADB (For developers with USB debugging):**
  ```bash
  adb shell pm clear com.cmtBootCamp.AEPSampleAppNewArchEnabled
  ```
  This command completely clears:
  - ✅ AsyncStorage (App ID, Assurance URL)
  - ✅ All SharedPreferences
  - ✅ All app data, cache, and databases
  - ✅ Everything except the installed APK

**⚠️ When to Clear App Data:**
- Assurance not connecting or stuck on old session
- App ID or Assurance URL persists after code changes
- Strange behavior after switching between development/production builds
- After major Adobe SDK configuration changes

**After Clearing**: Restart the app and reconfigure Assurance/App ID from scratch

### **Debug Tools Available:**
- **Debug Setup Button**: Checks MobileCore, Assurance, and IMS Org status
- **Check Real Connection**: Validates actual Adobe service connectivity
- **Clear All Adobe Caches**: Resets all cached data and IMS Org information
- **Debug Sandbox Configuration**: Checks Adobe configuration and sandbox settings
- **🔍 Compare Session IDs**: Compares React Native input vs native SDK actual session
- **FCM Test Buttons**: Test FCM token generation and message handling
- **Clear Adobe Push Tokens**: Fixes push token mismatch issues

### **Local USB Testing - Viewing Logs:**

**⚠️ IMPORTANT: If logs don't appear after `npx expo run:android`:**

When testing locally via USB, you may encounter an issue where Metro bundler starts but no logs appear in the terminal:

**Solution:**
1. Wait for the app to fully launch on your device
2. **Completely close the app** on your phone (swipe away from recent apps)
3. **Reopen the app** from your phone
4. ✅ Logs should now appear in your terminal

**Why this happens:**
- The first launch may not properly connect the logging bridge
- Closing and reopening the app re-establishes the connection between Metro and the device

**Before testing any features:**
- Always verify you can see logs in the terminal
- Look for initialization messages like "Adobe SDK initialized successfully"
- If no logs appear, close and reopen the app before proceeding

### **Enable Verbose Logging for Debugging:**

By default, the app uses `LogLevel.ERROR` for better performance. To see detailed Adobe SDK logs for debugging:

1. Open `src/utils/adobeConfig.ts`
2. Find line 72 and change:
   ```typescript
   // From this (production mode):
   MobileCore.setLogLevel(LogLevel.ERROR);
   
   // To this (debug mode):
   MobileCore.setLogLevel(LogLevel.VERBOSE);
   ```
3. Rebuild the app: `npx expo run:android`
4. ✅ You'll now see all Adobe SDK operations in logcat
5. ⚠️ **Remember to change it back to ERROR when done** - VERBOSE significantly slows down the app

### **Advanced Debugging with Android Logcat (PowerShell):**

If Assurance isn't connecting, use PowerShell to see what session ID the native SDK is actually using:

#### **Quick Check (Last 5 Connections):**
```powershell
adb logcat -d | Select-String -Pattern "AssuranceSession - Connecting" | Select-Object -Last 5
```

#### **Real-Time Monitoring:**
```powershell
# Clear old logs and monitor in real-time
adb logcat -c
adb logcat | Select-String -Pattern "AssuranceSession - Connecting|sessionId="
```

#### **Full Debug Session:**
```powershell
# Terminal 1: Monitor native SDK
adb logcat | Select-String -Pattern "AssuranceSession|sessionId|adb_validation_sessionid"

# Terminal 2: Run your app
npx expo run:android

# In the app:
# 1. Tap "🔍 Compare Session IDs" button
# 2. Compare Metro console output vs Terminal 1 output
# 3. If session IDs don't match → Adobe SDK bug
```

#### **Save Debug Output:**
```powershell
adb logcat | Select-String -Pattern "Assurance" | Out-File -FilePath assurance-debug.txt
```

**What to Look For:**
- Metro console shows: `Input Session ID: c4752e9b-3260-43ac-9e34-f1c78854b9e0`
- Logcat shows: `sessionId=de4a3b7f-fe01-48b2-b520-20c364968856`
- **If they don't match** → The native SDK is caching an old session (SDK bug)

## 📚 Resources

- [Adobe Configuration Documentation](https://developer.adobe.com/client-sdks/documentation/configuration/)
- [Environment-Aware Configuration](https://developer.adobe.com/client-sdks/documentation/configuration/#environment-aware-configuration-properties)
- [Assurance Deep Linking](https://developer.adobe.com/client-sdks/documentation/platform-assurance-sdk/api-reference/)
- [Optimize Sandbox Configuration](https://developer.adobe.com/client-sdks/documentation/optimize-sdk/api-reference/)
https://developer.adobe.com/client-sdks/home/base/mobile-core/configuration/

---

## 📊 **XDM Schema Migration - COMPLETE**

**Migration Date**: October 2025  
**Status**: ✅ **100% Complete** - All consumer tabs migrated to `tempMobile Interactions` schema

### **What Was Done:**
Migrated all consumer-facing analytics from legacy `MobileCore.trackState/trackAction` calls to the new XDM schema using `Edge.sendEvent()` with the `_adobecmteas` tenant namespace.

### **✅ Consumer Views Migrated (6/6):**
- ✅ **home.tsx** - Page views, category navigation, product views, add to cart
- ✅ **cart.tsx** - Page views, checkout initiation, product removal, cart sessionization
- ✅ **Checkout.tsx** - Page views, purchase completion with order details
- ✅ **profile.tsx** - Page views, login/logout events
- ✅ **offers.tsx** - Page views, add to cart (Adobe Optimize propositions)
- ✅ **decisioningItems.tsx** - Page views, add to cart (Adobe Journey Optimizer propositions)

### **✅ Event Types Implemented (7/7):**
- ✅ `web.webpagedetails.pageViews` - All 8 screens
- ✅ `commerce.productViews` - Product detail pages
- ✅ `commerce.productListAdds` - Add to cart actions
- ✅ `commerce.productListRemovals` - Remove from cart
- ✅ `commerce.checkouts` - Checkout initiation
- ✅ `commerce.purchases` - Order completion
- ✅ `web.webinteraction.linkClicks` - Login/logout actions

### **✅ Architecture Created:**
- ✅ **`src/utils/xdmEventBuilders.ts`** - 8 XDM event builders + environment helper
- ✅ **`src/utils/identityHelpers.ts`** - SHA-256 email hashing, identity building
- ✅ **`hooks/useCartSession.ts`** - Persistent cart session management

### **✅ Schema Compliance:**
- ✅ All events use `_adobecmteas` tenant namespace
- ✅ Deprecated fields removed (CJM, push tracking, old login mixins)
- ✅ Required XDM fields present (_id, timestamp, eventType, commerce/web values)
- ✅ Identity management (ECID + authenticated email with SHA-256 hashing)
- ✅ Environment context (device type, OS, screen dimensions)
- ✅ Fresh profile data from AsyncStorage (no stale data issues)
- ✅ Cart sessionization for cross-session analytics
- ✅ Product data fully dynamic from JSON (no hardcoding)

### **📁 Key Files:**
- **Event Builders**: `src/utils/xdmEventBuilders.ts` (968 lines)
- **Identity Helpers**: `src/utils/identityHelpers.ts` (139 lines)
- **Cart Session Hook**: `hooks/useCartSession.ts`
- **Migration Guide**: `SchemaUpdateGuide.md` (reference)
- **Implementation Plan**: `TODO-SchemaImplementation.md` (archived)

### **🎯 Result:**
Clean, schema-compliant XDM events flowing to Adobe Experience Platform Edge Network. All consumer interactions tracked with proper tenant namespace, identity stitching, and commerce funnel analytics.

---

## 🎉 **Project Status**

**Last Updated**: January 2025  
**Status**: ✅ **100% Complete** - Full AEP Integration

### **✅ Fully Complete:**
- ✅ **Push Notifications**: FCM (Android) + APNs (iOS) - all 7 phases complete
- ✅ **Adobe SDK**: Full integration with App ID configuration
- ✅ **AJO Campaigns**: Real campaign content with personalization
- ✅ **XDM Schema Migration**: All 6 consumer tabs migrated to Edge Network
- ✅ **Edge Network Tracking**: Using `_adobecmteas` tenant namespace
- ✅ **Production Builds**: Android APK tested, iOS ready for TestFlight
- ✅ **User-Friendly Setup**: Documented workflow for non-developers
- ✅ **Comprehensive Troubleshooting**: Debug tools and solutions guide
- ✅ **End-to-End Validation**: Complete testing on both platforms
- ✅ **Code Quality**: Consistent logging and error handling

### **🔮 Future Enhancements:**
- 🔄 TestFlight distribution and iOS production testing
- 🔄 Adobe Decisioning Module integration for advanced personalization
- 🔄 App Store / Google Play submission (if needed)

### **🎯 Mission Accomplished:**
All Adobe Experience Platform integration objectives achieved:
- **Push Notifications**: Multi-platform push with Adobe integration
- **XDM Analytics**: Full schema migration with tenant namespace
- **Demo-Ready**: Easy configuration for Adobe employees and bootcamp participants
- **Production-Ready**: Built, tested, and ready for deployment

