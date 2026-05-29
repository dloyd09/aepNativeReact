# Push Platform Collision — AJO Sends APNS When FCM Expected

**Date:** 2026-05-29
**App:** AEP Native React (CMT Bootcamp Demo)
**Confirmed via:** AJO journey test execution, RTCDP profile inspection (`View JSON`), Assurance Push Debug, AJO push channel configuration review, `app.json` bundle config
**Symptom:** A test journey on Android excludes the push send with `PushNoTokenFoundInProfile` and `pushChannelContext.platform: "apns"`, even though the device registered an FCM token. Assurance shows registration succeeding.

---

## Summary

Four conditions stack up to produce the symptom. None of them is a bug in how the app builds XDM — the app-side `Platform.OS === 'ios' ? 'apns' : 'fcm'` logic never feeds the deliverable push profile. The deepest cause (#4) is a genuine app defect and has been fixed; see [Fixes](#fixes-in-priority-order).

| # | Condition | Effect |
|---|---|---|
| 1 | iOS and Android share **one identical App ID** | `platform` becomes the only field distinguishing an APNS token from an FCM token on a profile |
| 2 | The journey's push action resolves `platform = Apns` | AJO looks for an **APNS** token specifically; this device only has FCM tokens |
| 3 | The merged test profile has **no `pushNotificationDetails` token at all** | Nothing to deliver to → exclusion |
| 4 | **Un-normalized email** splits the device's tokens onto a *different* profile cluster than the journey's test profile | The token exists, but not on the profile AJO targets |

Net result: AJO delivery feedback `feedbackStatus: "exclude"`, `messageExclusion.code: "CJMRT-050030-422"`, `reason: "PushNoTokenFoundInProfile"`, `pushChannelContext.platform: "apns"`.

The crux: **Assurance and AJO were reading two different profiles.** Assurance Push Debug inspects the live device's current ECID and confirms a healthy FCM token; AJO delivery reads the merged marketing profile the journey qualified — a separate identity cluster, split off by email case, that never received the token.

---

## How push tokens actually reach AJO

In `src/utils/pushNotifications.ts`, `registerTokenWithAdobe` fires two things:

1. **`MobileCore.setPushIdentifier(token)`** (`pushNotifications.ts:413`) — the **only** call that writes the deliverable AJO push profile. It creates/updates a `pushNotificationDetails` entry keyed by **`appID` + `platform`**, holding the token. The `platform` value (`apns` / `apnsSandbox` / `fcm`) is set by the **native SDK based on the OS** — iOS native → APNS, Android native → FCM. It is **not** settable from JavaScript.

2. **`buildPushRegistrationEvent`** (`xdmEventBuilders.ts:1272`) — a custom XDM event into the `_adobecmteas` tenant dataset. Its `pushNotificationTracking.pushProvider` field is **tracking metadata only** and does **not** populate the deliverable push profile. (Its own doc comment: *"The token value itself is not echoed into the payload."*)

> **Key trap:** The `Platform.OS === 'ios' ? 'apns' : 'fcm'` ternaries in `pushNotifications.ts:426` and `app/_layout.tsx:171` feed only the *custom tracking events*. Seeing `pushProvider: "fcm"` in Assurance tells you nothing about the platform AJO will deliver through — that comes from `setPushIdentifier` (OS-derived) and the journey action config.

---

## Condition 1 — One App ID for two platforms (the structural cause)

`app.json`:

```
ios.bundleIdentifier:  com.cmtBootCamp.AEPSampleAppNewArchEnabled
android.package:       com.cmtBootCamp.AEPSampleAppNewArchEnabled    ← identical
```

AJO channel config `weRetail_Push_Messgaing`:

```
iOS     App id:  com.cmtBootCamp.AEPSampleAppNewArchEnabled
Android App id:  com.cmtBootCamp.AEPSampleAppNewArchEnabled          ← identical
```

A push token lives in a `pushNotificationDetails` entry keyed by **`appID` + `platform`**. When both platforms use the same App ID, **`platform` is the sole discriminator** between an iOS token and an Android token. There is no App-ID-level separation to fall back on, so any mismatch in the `platform` selector silently excludes the send.

## Condition 2 — Journey action selects `platform = Apns`

The "Thank you Message" push action in journey *davidCall Center Disposition Push* resolves its push parameters to:

```
token *:    PushNotificationDetails                          (binds to profile push details)
appID *:    com.cmtBootCamp.AEPSampleAppNewArchEnabled
platform *: Apns                                             ← the selector
```

This tells AJO: *find a `pushNotificationDetails` where `appID = com.cmtBootCamp…` AND `platform = apns`.* On an Android/FCM profile that lookup can never match — with Condition 1, there is no App-ID distinction, so the APNS-vs-FCM choice rests entirely on this pinned value.

## Condition 3 — No token on the merged profile

The test profile (`_id: email-dtboards09-gmail-com`) shows:

- `identityMap.ecid.0.id`, `ecid.1.id`, `ecid.2.id` — **3 stitched ECIDs**
- `identityMap.email.0.id`, `identityMap.phone.0.id`, `person.name.firstName`, `testProfile: true`
- **No `pushNotificationDetails` attribute of any platform**

The journey entered on the **Phone** identity (`primaryIdentity.namespaceCode: "Phone"`). Qualification via Phone is fine, but delivery still needs a `pushNotificationDetails` token of the action's platform on the merged profile — and there is none.

**Why the token is missing:** the 3 stitched ECIDs are the fingerprint of repeated `resetIdentities()` from `clearAdobePushTokens()` (`pushNotifications.ts:669`). Each reset mints a new ECID; email/phone stitching merges them into one profile. `setPushIdentifier(token)` attaches the token to whichever ECID was live at registration. If registration aborted on the ECID poll timeout (`pushNotifications.ts:405`) or attached to a fragment the time-based merge policy isn't surfacing, the merged profile ends up with no token.

---

## Evidence (AJO delivery feedback JSON)

```json
"messageProfile": {
  "channel": { "_id": "https://ns.adobe.com/xdm/channels/push" }
},
"messageDeliveryfeedback": {
  "feedbackStatus": "exclude",
  "messageExclusion": {
    "code": "CJMRT-050030-422",
    "reason": "PushNoTokenFoundInProfile"
  }
},
"pushChannelContext": { "platform": "apns" }
```

---

## Condition 4 — Email case sensitivity splits the profile (the deepest cause)

Assurance Push Debug, pointed at the live Android device, reports a **fully healthy** registration:

- **Client → "Device Configured and Push Token Detected"** ✅ — Ecid `52040127126385264108460169926…`, Push Token `d9_1nmBUQnyRxt5lL0UQm9:APA91bF…` (the `:APA91b…` shape is an FCM token).
- **App Store Credentials → "Matching App Successfully Detected"** ✅ — App ID `com.cmtBootCamp.AEPSampleAppNewArch…`, Sandbox `training`, **Messaging Service: Firebase Cloud Messaging V1**.
- **Profile → ⚠️ "Invalid Message Tracking Dataset"** — a *separate* issue (the message tracking dataset is missing required field groups: Push Notification Tracking, Environment details, Application details, CJM Message Profile/Execution Details). It affects open/engagement tracking, not this delivery exclusion.

So the device registered an FCM token correctly. Pulling the device's RTCDP profile (by its live ECID) shows why AJO still can't reach it — **it is a different profile from the journey's test profile:**

| | Journey test profile | Device profile (Assurance) |
|---|---|---|
| Email value | `dtboards09@gmail.com` (lowercase) | `Dtboards09@gmail.com` (**capital D**) |
| `_id` | `email-dtboards09-gmail-com` | — |
| Merge policy | **Default Timebased** | `f7c7ab64-20c6-4b13-b329-3288358e539e` |
| ECIDs | `51714…`, `41701…`, `21823…` (3) | **19**, none matching the left column |
| Push tokens | **none** | **10, all `platform: "fcm"`** |
| `testProfile` | `true` | (not set) |

The two clusters **share no ECIDs**, and the email differs **only by case**. That is the splitter:

- **AEP's `Email` namespace is case-sensitive.** `Dtboards09@gmail.com` and `dtboards09@gmail.com` are distinct identity values anchoring two separate identity graphs that never merge.
- The app produced exactly this. `app/(consumerTabs)/profile.tsx` set the `Email` identity from the **raw `inputEmail`** (un-normalized), while `hashEmail()` in `identityHelpers.ts` lowercases only the *hashed tenant field*. Typing the address with different capitalization across sessions — or a test profile created in a different case — forks the profile.
- The journey's profile is also flagged `testProfile: true`, indicating a synthetic test record created with email + phone but **no push token** — so test mode ran against a profile that never had a token, independent of the real device.

The device profile also lays bare the **ECID churn**: 19 ECIDs in `identityMap`, 17 with consent, 10 `pushNotificationDetails` — and the *same physical token* re-stamped across multiple ECIDs (e.g. `d9_1nmBUQ…` on both `12385596…` and `52040127…`). Every `resetIdentities()` minted a fresh ECID and re-registered the same device token onto it.

### Evidence (device RTCDP profile, abridged)

```json
"pushNotificationDetails": [
  { "platform": "fcm", "appID": "com.cmtBootCamp.AEPSampleAppNewArchEnabled",
    "token": "d9_1nmBUQnyRxt5lL0UQm9:APA91bF…",
    "identity": { "namespace": { "code": "ECID" }, "id": "52040127126385264108460169926202624611" } }
  /* …9 more entries, every one "platform": "fcm", no APNS anywhere… */
],
"identityMap": {
  "ecid": [ /* 19 ECIDs */ ],
  "email": [ { "id": "Dtboards09@gmail.com" } ]
},
"mergePolicyId": "f7c7ab64-20c6-4b13-b329-3288358e539e"
```

Note: **zero APNS entries.** Even once the token lands on the right profile, the journey action's `platform: Apns` (Condition 2) would still reject every FCM token here.

### Fix applied

`app/(consumerTabs)/profile.tsx` now normalizes the email **once** at the top of `handleLogin` (`trim().toLowerCase()`) and uses that canonical value for the `Email` identity, `UserProfile.updateUserAttributes`, profile storage, and the login event — mirroring `hashEmail()`. This stops the case-split at the source so a given user resolves to one profile graph.

---

## Fixes (in priority order)

1. **Normalize the email before setting the identity** *(applied — `profile.tsx`)*. `handleLogin` now lowercases + trims `inputEmail` once and uses that canonical value for the `Email` identity, attributes, profile storage, and login event. Without this, case variants fork the profile and strand push tokens on the wrong cluster (Condition 4).

2. **Give iOS and Android distinct App IDs** *(the structural fix)*. Configure platform-specific App IDs in the AJO channel config (e.g. `…AEPSampleAppNewArchEnabled.ios` bound to the APNS credential, `…AEPSampleAppNewArchEnabled.android` bound to the FCM credential) and register the matching App ID per platform from the app. This lets AJO select the token by App ID rather than relying on the fragile `platform` discriminator. As long as one App ID serves both platforms, this APNS/FCM confusion will recur.

3. **Match the journey action's `platform` to the device under test.** Testing on Android requires `platform = fcm` (or a dynamic expression that reads the platform off the profile's actual token instead of a pinned `Apns`). Pinned to `Apns`, an Android/FCM profile is excluded every time.

4. **Get a token onto the profile and stop fragmenting it.** Run a clean Android registration, confirm in RTCDP that `pushNotificationDetails` appears with `platform: fcm` and the expected ECID, and avoid `clearAdobePushTokens()` / `resetIdentities()` between registration and the test send — that is what produced the multi-ECID churn (19 ECIDs on the device profile).

5. **Test against the real device profile**, not a synthetic `testProfile: true` record with no token — or ensure the test profile carries a real `pushNotificationDetails` token of the right platform.

## How to verify

- **RTCDP profile** → expand `pushNotificationDetails[]`. Confirm an entry exists with the expected `platform` and a non-empty `token`. If empty or wrong platform, the send will be excluded.
- **Compare ECIDs across tools.** The ECID in Assurance Push Debug is the *device's live* ECID; the journey delivers to the *merged marketing profile's* ECIDs. If they're disjoint, the token Assurance sees is on a profile AJO never targets — exactly the failure here.
- **Check the email identity value.** A single user should resolve to one `identityMap.email` value. Two values differing only by case means the case-split is still happening.
- **Assurance** → inspect the actual `setPushIdentifier` / push-profile-update event's `platform` field (the source of truth for delivery), **not** the custom `pushNotificationDetails` tenant event's `pushProvider` (tracking metadata only).
- **Device log** → confirm `✅ Push token registered via MobileCore.setPushIdentifier` AND `ECID resolved after N attempt(s)`. If you see `push registration aborted`, the token never reached AJO.

---

## Takeaway

This is a configuration + identity-hygiene problem, not an XDM-builder bug. The platform AJO delivers through is decided by (a) the channel/App-ID configuration and (b) the journey action's `platform` selector — never by the app's `Platform.OS` ternaries, which only label custom tracking events. And **Assurance being all-green proves nothing about deliverability**: it inspects the live device, while AJO delivers to the merged marketing profile. When email case forks that profile (and `resetIdentities()` churns ECIDs), the token Assurance happily reports is sitting on a profile the journey never sees — producing `PushNoTokenFoundInProfile` on a device that is, by every device-side measure, correctly registered.
