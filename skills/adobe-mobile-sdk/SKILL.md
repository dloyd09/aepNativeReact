# Adobe Mobile SDK Skill
> Agent skill for `aepsdk-react-native` bootcamp app development
> Source: https://developer.adobe.com/client-sdks/home/current-sdk-versions/#react-native

---

## Quick Reference

- SDK repo: `https://github.com/adobe/aepsdk-react-native`
- Min React Native version: **0.60.0 or later**
- New Architecture (0.7x+): all extensions supported via interop layer
- Architecture: Dual-audience app (Technical View + Consumer View)
- Core loop: **Configure Launch tags → Run app → Observe SDK behavior**
- Governance: See `governance.md` at project root

---

## Official React Native Extensions (npm)

### Base Extensions
| Extension | npm Package |
|---|---|
| Mobile Core | `@adobe/react-native-aepcore` |
| Profile | `@adobe/react-native-aepuserprofile` |
| Adobe Experience Platform Assurance | `@adobe/react-native-aepassurance` |

### Edge Network Extensions
| Extension | npm Package |
|---|---|
| AEP Edge Network | `@adobe/react-native-aepedge` |
| Identity for Edge Network | `@adobe/react-native-aepedgeidentity` |
| Consent for Edge Network | `@adobe/react-native-aepedgeconsent` |
| Edge Bridge | `@adobe/react-native-aepedgebridge` |
| Adobe Journey Optimizer | `@adobe/react-native-aepmessaging` |
| Offer Decisioning and Target | `@adobe/react-native-aepoptimize` |

### Solution Extensions
| Extension | npm Package |
|---|---|
| Places Service | `@adobe/react-native-aepplaces` |
| Adobe Target | `@adobe/react-native-aeptarget` |
| Adobe Campaign Classic | `@adobe/react-native-aepcampaignclassic` |

> ⚠️ **Adobe Analytics** is NOT supported in AEP-prefixed React Native libraries.
> Analytics workflows must go through **Edge Network** or **Edge Bridge** extensions.
> Migration guide: https://developer.adobe.com/client-sdks/solution/adobe-analytics/migrate-to-edge-network/

---

## Core Principles

1. **Protect the learning loop** — the configure → run → observe cycle is the product
2. **Two audiences, one codebase** — never let technical complexity bleed into the consumer view
3. **Upstream fidelity** — always follow Adobe's recommended SDK patterns, no divergent workarounds
4. **Stability over novelty** — this is a live bootcamp tool; breaking changes have curriculum costs

---

## Architecture Rules

### Dual-View Pattern
- `TechnicalView` — exposes SDK configuration, extension registration, event logging
- `ConsumerView` — simulates a real app experience, hides SDK internals
- Never share mutable state directly between views; use a shared config context/store
- SDK initialization must happen once at app bootstrap, not inside either view

### Launch Tag Configuration
- Users configure their own `environmentFileID` (Launch tag) at runtime
- Store the configured value in persistent local state (AsyncStorage or equivalent)
- Always validate the App ID format before passing to `MobileCore.initializeWithAppId()`
- Provide clear UI feedback when configuration is pending, active, or failed

### Extension Registration
- All extensions auto-register via `initializeWithAppId()` — no manual `registerExtensions()` call needed
- Recommended init order: set log level → `initializeWithAppId()` → verify extension versions → set consent
- Wrap in try/catch and surface errors in the Technical View log panel
- Never register extensions conditionally based on view state

---

## SDK Patterns

### Initialization (correct pattern)
```typescript
import { MobileCore, LogLevel } from '@adobe/react-native-aepcore';

// Set log level first — VERBOSE for dev, ERROR for production
MobileCore.setLogLevel(LogLevel.ERROR);

// App ID comes from AsyncStorage (user-configured at runtime) — never hardcode
const appId = await AsyncStorage.getItem('@adobe_app_id');
await MobileCore.initializeWithAppId(appId);
```

> ❌ Do NOT use `MobileCore.configureWithAppID()` — wrong method for this SDK version.
> ❌ Do NOT use `MobileCore.start()` — not part of this SDK version.
> ✅ Call `initializeWithAppId()` once at app bootstrap (`app/_layout.tsx`), never inside a component.

### Edge Network Event — the only correct analytics pattern
```typescript
import { Edge, ExperienceEvent } from '@adobe/react-native-aepedge';
import { buildPageViewEvent } from '@/src/utils/xdmEventBuilders';

// Always use a builder from xdmEventBuilders.ts — never construct raw XDM inline
const event = await buildPageViewEvent({ identityMap, profile, pageTitle, pagePath, pageType });
await Edge.sendEvent(event);
```

> ❌ Do NOT use `MobileCore.trackAction()` or `MobileCore.trackState()` — those are Analytics Classic.
> This app does NOT use those methods. All analytics go through `Edge.sendEvent()` with XDM builders.
> Edge Bridge exists only for migrating legacy code, not for new development.

### Assurance (debugging)
```typescript
import { Assurance } from '@adobe/react-native-aepassurance';

// Start Assurance session with deep link URL
Assurance.startSession('your-assurance-url://');
```

---

## File Structure Conventions

```
app/
├── _layout.tsx                     # SDK init (configureAdobe), push listener
├── (consumerTabs)/                 # Consumer View — simulated shopping experience
│   ├── home.tsx                    # Page view event
│   ├── cart.tsx                    # Cart events (add, remove, checkout)
│   ├── Checkout.tsx                # Purchase event
│   ├── profile.tsx                 # Login/logout + identity
│   ├── offers.tsx                  # Optimize proposition display
│   └── decisioningItems.tsx        # AJO code-based experience display
└── (techScreens)/                  # Technical View — SDK internals
    ├── CoreView.tsx                # Setup status, versions, ECID display
    ├── AssuranceView.tsx           # Assurance session connect
    ├── PushNotificationView.tsx    # Push token management
    ├── AppIdConfigView.tsx         # App ID entry and storage
    └── [Extension]View.tsx         # Per-extension debug screens

src/utils/
├── adobeConfig.ts                  # configureAdobe(), initializeAdobe(), debug helpers
├── xdmEventBuilders.ts             # All XDM ExperienceEvent constructors
├── identityHelpers.ts              # hashEmail, buildTenantIdentities, extractECID
├── pushNotifications.ts            # PushNotificationService singleton
└── decisioningItems.ts             # CBE proposition parsing and tracking
```

---

## Bug Triage Priority

| Priority | Condition |
|---|---|
| P0 | Breaks the configure → run → observe loop |
| P1 | Breaks one of the two views entirely |
| P2 | SDK event not firing or incorrectly tracked |
| P3 | UI/UX issue that doesn't block learning |
| P4 | Code quality / refactor, no user-facing impact |

---

## What NOT to Do

- ❌ Do not use `MobileCore.configureWithAppID()` — wrong method; use `initializeWithAppId()`
- ❌ Do not use `MobileCore.start()` — not part of this SDK version
- ❌ Do not call `initializeWithAppId()` inside a component or more than once per session
- ❌ Do not hardcode the App ID — must come from `AsyncStorage` (user-configured at runtime)
- ❌ Do not use `MobileCore.trackAction()` / `trackState()` — Analytics Classic; use `Edge.sendEvent()` with XDM builders
- ❌ Do not construct raw XDM objects inline in screen files — always use builders from `xdmEventBuilders.ts`
- ❌ Do not call `MobileCore.setPushIdentifier()` before confirming ECID is present
- ❌ Do not use ACP-prefixed packages — those are the previous SDK generation
- ❌ Do not swallow SDK errors silently — surface them in the Technical View log

---

## Supported Platforms

| Platform | Supported Version |
|---|---|
| React Native | 0.60.0 or later |
| Android | API level 21 (Android 5) or later |
| iOS | 12 or later |

---

## Reference Files

Detailed per-extension guides live in `skills/adobe-mobile-sdk/references/`:

### Base Extensions
| File | Extension |
|---|---|
| `base-mobile-core.md` | Mobile Core — Configuration, Identity, Lifecycle, Rules Engine, Signal |
| `base-assurance.md` | Adobe Experience Platform Assurance |
| `base-profile.md` | Profile (User Profile) |

### Edge Network Extensions
| File | Extension |
|---|---|
| `edge-network.md` | AEP Edge Network — XDM event sending |
| `edge-identity.md` | Identity for Edge Network — ECID and identity map |
| `edge-consent.md` | Consent for Edge Network — opt-in/out management |
| `edge-bridge.md` | Edge Bridge — Analytics migration compatibility layer |
| `edge-adobe-journey-optimizer.md` | Adobe Journey Optimizer — IAM and push |
| `edge-optimize.md` | Offer Decisioning and Target — propositions via Edge |

### Solution Extensions
| File | Extension |
|---|---|
| `solution-places.md` | Places Service — geofencing and POI |
| `solution-target.md` | Adobe Target — legacy A/B testing path |
| `solution-campaign-classic.md` | Adobe Campaign Classic — push registration and tracking |

---

## External References

- [AEP React Native SDK — GitHub](https://github.com/adobe/aepsdk-react-native)
- [Current SDK Versions — Official Docs](https://developer.adobe.com/client-sdks/home/current-sdk-versions/#react-native)
- [Adobe Experience Platform Mobile SDK Docs](https://developer.adobe.com/client-sdks/documentation/)
- [Adobe Launch / Data Collection UI](https://experience.adobe.com/#/data-collection)
- [Migrate Analytics to Edge Network](https://developer.adobe.com/client-sdks/solution/adobe-analytics/migrate-to-edge-network/)
- [ACP to AEP Migration Guide](https://github.com/adobe/aepsdk-react-native/blob/main/docs/migration.md)
- Project `governance.md` — mission, values, and decision filter
- [Optimization Plan](references/optimization-plan.md) — 42 active items, governance-prioritized; read before implementing any change