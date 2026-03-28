# Edge Extension: Identity for Edge Network
> `@adobe/react-native-aepedgeidentity`
> Docs: https://developer.adobe.com/client-sdks/edge/identity-for-edge-network/

---

## What it is

Identity for Edge Network manages the **ECID (Experience Cloud ID) and identity map** for Edge Network requests. It is a separate extension from the Mobile Core Identity extension and is specifically required when using the Edge Network extension.

> ⚠️ **Two Identity extensions exist — do not confuse them:**
> - `Identity` from `@adobe/react-native-aepcore` — for legacy Analytics/Audience Manager workflows
> - `Identity` from `@adobe/react-native-aepedgeidentity` — for Edge Network workflows
>
> In most modern implementations you will register **both**, but use them for different purposes.

---

## Installation

```bash
npm install @adobe/react-native-aepedgeidentity
```

iOS:
```bash
cd ios && pod install
```

---

## Registration

Always register alongside Edge Network:

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';

MobileCore.registerExtensions([Edge, Identity]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Core APIs

### Get ECID
```typescript
import { Identity } from '@adobe/react-native-aepedgeidentity';

const ecid = await Identity.getExperienceCloudId();
console.log('ECID:', ecid);
```

### Get full identity map
```typescript
const identities = await Identity.getIdentities();
// Returns all identifiers in the identity map
```

### Update identities (add a custom ID)
```typescript
import { IdentityItem, IdentityMap, AuthenticatedState } from '@adobe/react-native-aepedgeidentity';

const identityMap = new IdentityMap();
const crmItem = new IdentityItem(
  'user@example.com',           // ID value
  AuthenticatedState.AUTHENTICATED, // auth state
  true                          // isPrimary
);
identityMap.addItem(crmItem, 'CRMId'); // namespace
Identity.updateIdentities(identityMap);
```

### Remove an identity
```typescript
Identity.removeIdentity(new IdentityItem('user@example.com'), 'CRMId');
```

---

## Bootcamp usage pattern

Surface the identity map in the **Technical View** to show learners:
- What ECID is automatically assigned to the device
- How custom identifiers (CRM ID, loyalty ID) are stitched to the ECID
- How identity stitching enables cross-channel profile resolution in AEP

This is a high-value teaching moment — the identity map is the foundation of everything in Real-Time CDP.

---

## Key rules

- ✅ Always register this extension when using Edge Network — ECID won't attach to events without it
- ✅ Show the identity map in Technical View — it's one of the most educational pieces of the SDK
- ✅ Use `AuthenticatedState` values correctly: `AUTHENTICATED`, `LOGGED_OUT`, or `AMBIGUOUS`
- ❌ Do not use this extension's `Identity` import for legacy Analytics calls — use the Core Identity instead
- ❌ Do not store raw identity values in React state — always retrieve fresh via `getIdentities()`

---

## API Reference
https://developer.adobe.com/client-sdks/edge/identity-for-edge-network/api-reference/