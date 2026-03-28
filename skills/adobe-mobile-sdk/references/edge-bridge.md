# Edge Extension: Edge Bridge
> `@adobe/react-native-aepedgebridge`
> Docs: https://developer.adobe.com/client-sdks/solution/adobe-analytics/migrate-to-edge-network/

---

## What it is

Edge Bridge is a **migration compatibility layer** that intercepts `MobileCore.trackAction()` and `MobileCore.trackState()` calls and automatically forwards them through the Edge Network instead of directly to Adobe Analytics. It allows teams to adopt Edge Network without rewriting all existing tracking calls at once.

Think of it as a translation layer: old Analytics-style calls in, XDM-formatted Edge events out.

---

## Installation

```bash
npm install @adobe/react-native-aepedgebridge
```

iOS:
```bash
cd ios && pod install
```

---

## Prerequisites

Edge Bridge requires these extensions:
- `@adobe/react-native-aepcore` (Mobile Core)
- `@adobe/react-native-aepedge` (Edge Network)
- `@adobe/react-native-aepedgeidentity` (Identity for Edge Network)

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Edge } from '@adobe/react-native-aepedge';
import { Identity } from '@adobe/react-native-aepedgeidentity';
import { EdgeBridge } from '@adobe/react-native-aepedgebridge';

MobileCore.registerExtensions([Edge, Identity, EdgeBridge]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## How it works

Once registered, existing `trackAction` and `trackState` calls are automatically bridged — no API changes needed:

```typescript
// This call...
MobileCore.trackAction('add_to_cart', { 'product.id': '12345' });

// ...is automatically forwarded through Edge Network as an XDM event
// with eventType: 'analytics.track' and the context data mapped to xdm/data fields
```

---

## Migration paths

Adobe provides two paths for migrating Analytics to Edge Network:

| Path | When to use |
|---|---|
| **Edge Bridge** | Large existing codebase with many `trackAction`/`trackState` calls; phased migration |
| **Direct Edge `sendEvent`** | New implementation or full rewrite; preferred long-term approach |

---

## Bootcamp usage pattern

Use Edge Bridge to teach the **migration story**:
1. Show `trackAction` being called in the Consumer View
2. Show in Assurance how Edge Bridge intercepts and re-routes it through Edge Network
3. Contrast with a direct `Edge.sendEvent()` XDM call to show the difference in event shape

This demonstrates the practical path for clients who have existing Analytics implementations.

---

## Key rules

- ✅ Edge Bridge is a **transitional tool** — the goal is always to move toward direct `Edge.sendEvent()`
- ✅ Register Edge and Identity for Edge Network alongside Edge Bridge — required for routing to work
- ✅ Use Assurance to confirm bridged events are arriving correctly
- ❌ Do not treat Edge Bridge as a permanent architecture — document the migration intent
- ❌ Do not mix Edge Bridge and direct `Edge.sendEvent()` for the same event type — pick one path per event

---

## Full migration guide
https://developer.adobe.com/client-sdks/solution/adobe-analytics/migrate-to-edge-network/