# Base Extension: Profile
> `@adobe/react-native-aepuserprofile`
> Docs: https://developer.adobe.com/client-sdks/home/base/profile/

---

## What it is

The Profile extension lets your app create and manage a **client-side user profile** — a local key-value store of user attributes that persists on the device. These attributes can be used by the Rules Engine to personalize behavior and trigger consequences without a server round-trip.

Profile is part of the base extension set but is **optional** — only include it if your implementation uses profile-based rules or personalization.

---

## Installation

```bash
npm install @adobe/react-native-aepuserprofile
```

iOS:
```bash
cd ios && pod install
```

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { UserProfile } from '@adobe/react-native-aepuserprofile';

MobileCore.registerExtensions([UserProfile]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Core APIs

### Update profile attributes
```typescript
import { UserProfile } from '@adobe/react-native-aepuserprofile';

// Set one or more user attributes locally on device
UserProfile.updateUserAttributes({
  'membership_tier': 'gold',
  'last_login': new Date().toISOString(),
  'push_opted_in': true,
});
```

### Remove profile attributes
```typescript
// Remove specific attributes
UserProfile.removeUserAttributes(['membership_tier', 'last_login']);
```

### Get profile attributes
```typescript
// Retrieve current values for specified keys
const attributes = await UserProfile.getUserAttributes(['membership_tier', 'push_opted_in']);
console.log(attributes);
// { membership_tier: 'gold', push_opted_in: true }
```

---

## How Profile works with Rules Engine

Profile attributes are evaluated by the Rules Engine in Adobe Launch. For example:

- Rule condition: `membership_tier == 'gold'`
- Consequence: fire a custom event, send a postback, or show in-app message

This means you can demo **real-time personalization** in the bootcamp Consumer View by setting profile attributes in the Technical View and watching rule consequences fire.

---

## Bootcamp usage pattern

Use Profile to demonstrate the bridge between:
- **Technical View** — update profile attributes manually (simulate a CRM sync)
- **Consumer View** — show personalized content driven by those attributes via Launch rules

This is a powerful teaching moment: the learner sets `membership_tier = 'gold'` and immediately sees different content in the Consumer View as the Rules Engine fires.

---

## Key rules

- ✅ Profile attributes are **device-local** — they do not automatically sync to AEP server-side profiles
- ✅ Use Profile to teach Rules Engine personalization, not as a data persistence layer
- ✅ Always show current profile state in the Technical View log panel
- ❌ Do not use Profile as a substitute for Edge Network identity or consent management
- ❌ Do not store sensitive PII in profile attributes

---

## API Reference
https://developer.adobe.com/client-sdks/home/base/profile/api-reference/