# Adobe Experience Platform Sample App

This is an Expo / React Native sample app for Adobe Experience Platform mobile SDK integrations. It includes App ID configuration, Assurance, push registration, decisioning, and consumer event flows sent through Adobe Edge using XDM.

## Quick Start

Follow these steps in order:

1. Open **App ID Configuration** and save the Adobe Launch App ID.
2. Open **Assurance**, paste the session URL, and tap `Start Session`.
3. Open **Push**, request notification permission, and verify the app shows a current token.
4. In Assurance, confirm the token in Adobe matches the token shown in the app.
5. Use **Decisioning** to fetch propositions or refresh in-app messages when needed.

## Technical View

The supported Technical View screens are:

- `Setup`
- `Assurance`
- `Push`
- `Decisioning`
- `App ID Configuration`

Older SDK sample/lab screens are hidden and are not part of the normal QA flow.

## Push Notifications

The app uses platform-native token sources:

- Android: FCM token
- iOS: native APNs device token

Adobe registration uses `MobileCore.setPushIdentifier()`.

Current behavior:

- the app auto-registers the current token with Adobe after startup / registration
- Android token refreshes are re-applied to Adobe automatically
- the Push screen is for status and recovery, not for a separate manual Adobe registration step

If Assurance shows a push token mismatch:

1. Open `Push`
2. Tap `Clear Adobe Push Tokens (Fix Mismatch)`
3. Restart the app
4. Reconfigure App ID if needed
5. Request notifications again
6. Verify the current token now appears in Assurance

See [readme-PushTokens.md](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/readme-PushTokens.md) for more detail.

## Assurance

The normal Assurance screen only supports:

- `Start Session`
- `Clear Saved Session`
- `Refresh Session Status`

Use one of these URL formats:

- `myapp://?adb_validation_sessionid=YOUR_SESSION_ID`
- `com.cmtBootCamp.AEPSampleAppNewArchEnabled://?adb_validation_sessionid=YOUR_SESSION_ID`
- `assurance://?adb_validation_sessionid=YOUR_SESSION_ID`

## Decisioning

The Technical View `Decisioning` screen is a small diagnostics surface for:

- editing the current surface value
- fetching propositions
- refreshing in-app messages
- reviewing the last fetch result

Default surface configuration is stored under `@decisioning_items_config`.

Current consumer behavior:

- the Decisioning Items tab reads cached propositions and then refreshes from Edge on focus
- checkout refreshes in-app messages and also refreshes the stored decisioning surface after purchase
- the Offers tab refreshes Optimize propositions from Edge on focus when a valid decision scope is configured

## Consumer Analytics / XDM

Consumer analytics events must use the event builders in:

- [src/utils/xdmEventBuilders.ts](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/src/utils/xdmEventBuilders.ts)
- [src/utils/identityHelpers.ts](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/src/utils/identityHelpers.ts)

Events are sent with `Edge.sendEvent(experienceEvent)` and use the `_adobecmteas` tenant namespace.

## Key Files

- [app/_layout.tsx](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/_layout.tsx): app entry and Adobe startup
- [src/utils/adobeConfig.ts](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/src/utils/adobeConfig.ts): Adobe SDK configuration
- [src/utils/pushNotifications.ts](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/src/utils/pushNotifications.ts): push token retrieval and Adobe registration
- [app/(techScreens)/PushNotificationView.tsx](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(techScreens)/PushNotificationView.tsx): push diagnostics screen
- [app/(techScreens)/DecisioningItemsView.tsx](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/app/(techScreens)/DecisioningItemsView.tsx): decisioning diagnostics screen

## QA Docs

- [docs/QA-Use-Cases-Review.md](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/docs/QA-Use-Cases-Review.md)
- [docs/Fix-And-Test-Adjustment-Plan.md](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/docs/Fix-And-Test-Adjustment-Plan.md)
- [readme-PushTokens.md](/C:/Users/dloyd/Desktop/my_workspace/aepNativeReact/readme-PushTokens.md)

## Local Checks

Useful commands:

```powershell
node .\node_modules\typescript\bin\tsc --noEmit
```

```powershell
npx expo run:android
```

## Build Notes

- Android local testing is supported from Windows.
- iOS validation should use EAS / TestFlight from this setup.
