# Solution Extension: Places Service
> `@adobe/react-native-aepplaces`
> Docs: https://developer.adobe.com/client-sdks/solution/places/

---

## What it is

The Places extension enables **geofencing and location-based experiences** using Adobe Experience Platform Location Service. It monitors device location, evaluates entry/exit of configured Points of Interest (POIs), and fires SDK events that can trigger Launch rules, in-app messages, or Analytics events.

---

## Installation

```bash
npm install @adobe/react-native-aepplaces
```

iOS:
```bash
cd ios && pod install
```

---

## Required permissions

### iOS — `Info.plist`
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app uses your location to provide relevant experiences.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app uses your location in the background to detect nearby points of interest.</string>
```

### Android — `AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Places } from '@adobe/react-native-aepplaces';

MobileCore.registerExtensions([Places]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Core APIs

### Get nearby POIs
```typescript
import { Places } from '@adobe/react-native-aepplaces';

const location = { latitude: 37.3382, longitude: -121.8863 };
const limit = 10; // max POIs to return

const nearbyPOIs = await Places.getNearbyPointsOfInterest(location, limit);
nearbyPOIs.forEach(poi => {
  console.log(`POI: ${poi.name}, distance: ${poi.distanceFromCenter}m`);
});
```

### Process a region event (manual entry/exit)
```typescript
import { Places, PlacesRegionEvent } from '@adobe/react-native-aepplaces';

// Simulate entry into a POI region (useful for testing)
Places.processRegionEvent(PlacesRegionEvent.ENTRY, poi);
Places.processRegionEvent(PlacesRegionEvent.EXIT, poi);
```

### Get current POI membership
```typescript
const currentPOIs = await Places.getCurrentPointsOfInterest();
```

### Clear cached data
```typescript
Places.clear();
```

---

## Bootcamp usage pattern

Use Places to demonstrate **location-triggered personalization**:
1. Configure POIs in the AEP Location Service UI
2. Use `getNearbyPointsOfInterest` to show POIs around a given coordinate in Technical View
3. Use `processRegionEvent` to simulate entry/exit in the bootcamp (avoids needing physical movement)
4. Show in Assurance how the entry event triggers a Launch rule consequence

This is especially powerful for retail, hospitality, and venue-based use case demonstrations.

---

## Key rules

- ✅ Always request location permissions before calling Places APIs
- ✅ Use `processRegionEvent` for bootcamp demos — physical geofence testing is impractical in a classroom
- ✅ Show POI entry events in Assurance to confirm rule triggers fire
- ❌ Do not enable background location unless the use case explicitly requires it
- ❌ Do not call `getNearbyPointsOfInterest` on every render — cache results and refresh on significant location change

---

## API Reference
https://developer.adobe.com/client-sdks/solution/places/api-reference/

## Event Forwarding to AEP
https://developer.adobe.com/client-sdks/solution/places/places-to-platform/