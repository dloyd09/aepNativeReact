# Edge Extension: Consent for Edge Network
> `@adobe/react-native-aepedgeconsent`
> Docs: https://developer.adobe.com/client-sdks/edge/consent-for-edge-network/

---

## What it is

The Consent extension manages **user data collection consent preferences** and communicates them to the Edge Network. It implements the Adobe standard consent schema (based on IAB TCF and Adobe's consent XDM field group), ensuring that data is only collected and processed when the user has given appropriate consent.

Consent is not optional in production implementations — it is a legal and compliance requirement in most markets.

---

## Installation

```bash
npm install @adobe/react-native-aepedgeconsent
```

iOS:
```bash
cd ios && pod install
```

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Consent } from '@adobe/react-native-aepedgeconsent';

MobileCore.registerExtensions([Consent]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Core APIs

### Update consent preferences
```typescript
import { Consent } from '@adobe/react-native-aepedgeconsent';

// User opts IN to data collection
Consent.update({
  consents: {
    collect: { val: 'y' }
  }
});

// User opts OUT
Consent.update({
  consents: {
    collect: { val: 'n' }
  }
});

// Pending / not yet collected
Consent.update({
  consents: {
    collect: { val: 'p' }
  }
});
```

### Get current consent preferences
```typescript
const preferences = await Consent.getConsents();
console.log(preferences);
// { consents: { collect: { val: 'y' } } }
```

---

## Consent values

| Value | Meaning |
|---|---|
| `y` | Yes — user has consented to data collection |
| `n` | No — user has opted out; SDK stops sending data |
| `p` | Pending — consent not yet collected; SDK holds events |

---

## Bootcamp usage pattern

Build a **consent toggle** in the Consumer View to demonstrate:
1. Set consent to `p` (pending) — show events held in Technical View log
2. User taps "Accept" — set to `y`, watch queued events flush
3. User taps "Decline" — set to `n`, confirm no