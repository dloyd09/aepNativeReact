# Edge Extension: Adobe Experience Platform Edge Network
> `@adobe/react-native-aepedge`
> Docs: https://developer.adobe.com/client-sdks/edge/edge-network/

---

## What it is

The Edge Network extension is the **primary data collection pipeline** for the modern AEP SDK stack. It replaces direct Analytics tracking by sending XDM-formatted Experience Events to the Adobe Edge Network, which then routes data to any configured downstream service (Analytics, Target, AJO, CDP, etc.) via a Datastream.

This is the extension that makes the SDK truly platform-agnostic — you send one event, the Datastream decides where it goes.

---

## Installation

```bash
npm install @adobe/react-native-aepedge
```

iOS:
```bash
cd ios && pod install
```

---

## Prerequisites

Edge Network requires these extensions registered alongside it:
- `@adobe/react-native-aepcore` (Mobile Core)
- `@adobe/react-native-aepedgeidentity` (Identity for Edge Network)

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';

MobileCore.registerExtensions([Edge, Identity]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Sending XDM Experience Events

```typescript
import { Edge, ExperienceEvent } from '@adobe/react-native-aepedge';

// Minimal XDM event
const xdmData = {
  eventType: 'commerce.productViews',
  commerce: {
    productViews: { value: 1 }
  },
  productListItems: [
    { name: 'AEP Hoodie', SKU: 'HDIE-001', priceTotal: 49.99 }
  ]
};

const experienceEvent = new ExperienceEvent({ xdmData });
Edge.sendEvent(experienceEvent);
```

### With free-form data (non-XDM)
```typescript
const experienceEvent = new ExperienceEvent({
  xdmData: { eventType: 'web.webpagedetails.pageViews' },
  data: { 'custom.key': 'custom_value' } // free-form data map
});
Edge.sendEvent(experienceEvent);
```

### With Datastream config override
```typescript
const configOverrides = {
  com_adobe_analytics: {
    reportSuites: ['bootcamp-override-rsid']
  }
};
const experienceEvent = new ExperienceEvent({ xdmData, datastreamConfigOverride: configOverrides });
Edge.sendEvent(experienceEvent);
```

---

## Bootcamp usage pattern

Use Edge `sendEvent` to demonstrate:
- **XDM schema compliance** — show learners why event shape matters for downstream routing
- **Datastream routing** — one event → multiple Adobe services
- **Assurance validation** — confirm events arrive with correct XDM structure in the Technical View log

---

## Key rules

- ✅ Always use XDM-formatted `eventType` values — they map to XDM schema field groups
- ✅ Register `Identity` for Edge Network alongside `Edge` — required for ECID to be attached
- ✅ Validate events in Assurance before assuming downstream delivery
- ❌ Do not use `MobileCore.trackAction` / `trackState` as a substitute — those are Analytics-only patterns
- ❌ Do not send PII in XDM data fields without consent signals in place

---

## API Reference
https://developer.adobe.com/client-sdks/edge/edge-network/api-reference/

## XDM Experience Events Guide
https://developer.adobe.com/client-sdks/edge/edge-network/xdm-experience-events/

## Validation Guide
https://developer.adobe.com/client-sdks/edge/edge-network/validation/validation/