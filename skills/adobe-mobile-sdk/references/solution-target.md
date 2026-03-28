# Solution Extension: Adobe Target
> `@adobe/react-native-aeptarget`
> Docs: https://developer.adobe.com/client-sdks/solution/adobe-target/

---

## What it is

The Target extension retrieves **A/B test experiences and personalization activities** from Adobe Target using the legacy Target delivery API (non-Edge). It enables prefetching of mbox content, loading Target activities, and reporting impressions and conversions.

> ⚠️ **Note on modern vs legacy path:**
> Adobe Target is also accessible via the `@adobe/react-native-aepoptimize` (Optimize) extension through Edge Network, which is the **preferred modern approach**. Use this standalone Target extension only if your implementation requires the legacy Target v1 delivery API or specific Target-only features not yet in Optimize.

---

## Installation

```bash
npm install @adobe/react-native-aeptarget
```

iOS:
```bash
cd ios && pod install
```

---

## Registration

```typescript
import { MobileCore } from '@adobe/react-native-aepcore';
import { Target } from '@adobe/react-native-aeptarget';

MobileCore.registerExtensions([Target]).then(() => {
  MobileCore.configureWithAppID('YOUR_LAUNCH_ENVIRONMENT_ID');
});
```

---

## Core APIs

### Prefetch mbox content
```typescript
import { Target, TargetPrefetchObject } from '@adobe/react-native-aeptarget';

const prefetchList = [
  new TargetPrefetchObject('hero-banner', { 'userType': 'member' }),
  new TargetPrefetchObject('promo-bar', {})
];

Target.prefetchContent(prefetchList, { 'app.version': '2.0' });
```

### Load Target requests (retrieve content)
```typescript
import { Target, TargetRequestObject } from '@adobe/react-native-aeptarget';

const request = new TargetRequestObject(
  'hero-banner',          // mbox name
  { 'userType': 'member' }, // mbox parameters
  'Default Hero Content', // default content if Target unavailable
  (content) => {
    console.log('Target content:', content);
    // Render content in Consumer View
  }
);

Target.loadRequests([request], {});
```

### Track display and click
```typescript
// Track mbox display impression
Target.displayedLocations(['hero-banner'], { 'page': 'home' });

// Track mbox click conversion
Target.clickedLocation('hero-banner', { 'page': 'home' });
```

### Reset session / clear prefetch cache
```typescript
Target.resetExperience();
Target.clearPrefetchCache();
```

---

## Bootcamp usage pattern

Use Target to demonstrate **A/B testing and experience personalization**:
1. Configure a Target A/B activity with two experiences for a mbox (e.g. `hero-banner`)
2. Use `prefetchContent` on app load to pre-cache the experience
3. Render the returned content in the Consumer View
4. Use Assurance to confirm which experience was served and the mbox parameters sent

Show learners the difference between the legacy Target path (this extension) and the modern Optimize/Edge path — both are valid in the field.

---

## Key rules

- ✅ Prefer `prefetchContent` over `loadRequests` for performance — prefetch on app launch, retrieve on demand
- ✅ Always provide default content in `TargetRequestObject` — shown if Target is unreachable
- ✅ Call `displayedLocations` when rendering Target content — required for impression counting
- ❌ For new implementations, prefer `@adobe/react-native-aepoptimize` via Edge Network instead
- ❌ Do not use both Target extension and Optimize extension for the same mbox — pick one path

---

## API Reference
https://developer.adobe.com/client-sdks/solution/adobe-target/api-reference/