import { Edge } from '@adobe/react-native-aepedge';
import { Messaging } from '@adobe/react-native-aepmessaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { safeParseJSON } from './safeParseJSON';
import {
  buildPropositionDisplayEvent,
  buildPropositionInteractEvent,
} from './xdmEventBuilders';

export const DECISIONING_ITEMS_CONFIG_KEY = '@decisioning_items_config';
export const DEFAULT_SURFACE = 'edge-offers';
export const DEFAULT_PREVIEW_URL = 'com.cmtBootCamp.AEPSampleAppNewArchEnabled://decisioning-items';

// Messaging.updatePropositionsForSurfaces is fire-and-forget (returns void). The
// Edge response populates the in-memory cache that getPropositionsForSurfaces
// reads from. 800ms covers a typical Edge round-trip on the bootcamp networks;
// if the cache is empty after this wait we fall back to whatever
// getPropositionsForSurfaces returns (usually a previous fetch's result).
const PROPOSITION_REFRESH_SETTLE_MS = 800;

export interface DecisioningItemsConfig {
  surface: string;
  previewUrl: string;
  activityId?: string;
  description?: string;
}

export interface DecisioningItem {
  id: string;
  itemID?: string;
  content: any;
  format?: string;
  /** The Messaging proposition this item belongs to (carries scope + scopeDetails). */
  proposition: any;
  /** The proposition item / offer; plain object from the Messaging bridge. */
  propositionItem: any;
  surface: string;
  trackingToken?: string;
  isEmbeddedItem?: boolean;
}

export interface ParsedDecisioningContent {
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  price: string | null;
  discount: string | null;
  badge: string | null;
  priority: string | null;
  tone: string | null;
  itemID: string | null;
  trackingToken: string | null;
  raw: any;
}

function extractValue(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj && typeof obj === 'object' && obj[key]) {
      return obj[key];
    }
  }
  return null;
}

export function parseDecisioningItemContent(item: DecisioningItem): ParsedDecisioningContent {
  let parsedContent = item.content;

  if (typeof item.content === 'string') {
    try {
      parsedContent = JSON.parse(item.content);
    } catch {
      parsedContent = { text: item.content };
    }
  }

  return {
    title: extractValue(parsedContent, ['name', 'IVRmessage', 'title', 'headline', 'header', 'label']),
    subtitle: extractValue(parsedContent, ['subtitle', 'subheader', 'subheading', 'tagline']),
    description: extractValue(parsedContent, ['description', 'body', 'text', 'content', 'message']),
    image: extractValue(parsedContent, ['image', 'imageUrl', 'img', 'picture', 'photo']),
    ctaText: extractValue(parsedContent, ['cta-text', 'ctaText', 'buttonText', 'linkText', 'actionText', 'cta']),
    ctaUrl: extractValue(parsedContent, ['url', 'cta-url', 'ctaUrl', 'buttonUrl', 'linkUrl', 'actionUrl', 'link']),
    price: extractValue(parsedContent, ['price', 'cost', 'amount', 'value']),
    discount: extractValue(parsedContent, ['discount', 'savings', 'offer', 'deal']),
    badge: extractValue(parsedContent, ['classification', 'badge', 'tag', 'label', 'category']),
    priority: extractValue(parsedContent, ['priority', 'importance', 'weight']),
    tone: extractValue(parsedContent, ['IVRtone', 'tone']),
    itemID: extractValue(parsedContent, ['itemID', 'id']),
    trackingToken: extractValue(parsedContent, ['data-item-token', 'trackingToken', '_trackingToken']),
    raw: parsedContent,
  };
}

// ============================================================================
// SURFACE URI HELPER
// ============================================================================

/**
 * Build the full AJO surface URI from a user-entered partial surface name.
 *
 * AJO surfaces are addressed as `mobileapp://<bundleId>/<surface>`. The
 * Messaging extension accepts the partial name and prefixes the bundle
 * identifier internally — this helper is retained for display, debug logs,
 * and tests that need the resolved URI.
 */
export function buildSurfaceUri(surface: string): string {
  const trimmed = (surface || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('mobileapp://')) return trimmed;

  const expoCfg: any = Constants.expoConfig;
  const bundleId =
    Platform.OS === 'ios'
      ? expoCfg?.ios?.bundleIdentifier
      : expoCfg?.android?.package;

  if (!bundleId) {
    // Last-resort fallback — bundle ID is present in app.json for this project.
    return trimmed;
  }
  return `mobileapp://${bundleId}/${trimmed}`;
}

// ============================================================================
// FETCH (Messaging — AJO Decisioning surface delivery)
// ============================================================================

async function readPropositionsForSurface(surface: string): Promise<any[]> {
  const result = await Messaging.getPropositionsForSurfaces([surface]);
  return normalizePropositionsResult(result);
}

/**
 * Read currently-cached propositions for the surface. Does not hit the Edge.
 * Returns [] if the surface has not been fetched yet this session.
 */
export async function getCachedPropositionsForSurface(
  surface: string
): Promise<any[]> {
  if (!surface) return [];
  try {
    return await readPropositionsForSurface(surface);
  } catch {
    return [];
  }
}

/**
 * Trigger an Edge fetch for the surface, wait for the cache to settle, then read.
 *
 * Messaging.updatePropositionsForSurfaces is fire-and-forget — there is no
 * Promise to await for the Edge response. We sleep
 * PROPOSITION_REFRESH_SETTLE_MS and then read from the in-memory cache via
 * getPropositionsForSurfaces. On the bootcamp's network this is typically
 * enough; on slower networks the first call may return a stale cache and the
 * next refresh will catch up.
 */
export async function fetchPropositionsForSurface(
  surface: string
): Promise<any[]> {
  if (!surface) return [];
  Messaging.updatePropositionsForSurfaces([surface]);
  await new Promise((resolve) => setTimeout(resolve, PROPOSITION_REFRESH_SETTLE_MS));
  return readPropositionsForSurface(surface);
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Accept any of the proposition response shapes the SDK might hand us:
 *   - Map<surface, proposition[]>  (legacy Optimize bridge)
 *   - Record<surface, proposition[]>  (Messaging bridge)
 *   - proposition[]  (already flattened by a caller)
 * Returns a flat array of propositions across all surfaces.
 *
 * Kept as an exported helper so screens and tests can pass either shape.
 */
export function normalizePropositionsResult(propositionsResult: any): any[] {
  if (!propositionsResult) return [];
  if (Array.isArray(propositionsResult)) return propositionsResult;
  if (typeof propositionsResult.forEach === 'function') {
    const result: any[] = [];
    propositionsResult.forEach((value: any) => {
      if (Array.isArray(value)) result.push(...value);
      else if (value) result.push(value);
    });
    return result;
  }
  if (typeof propositionsResult === 'object') {
    return Object.values(propositionsResult).flat() as any[];
  }
  return [];
}

export function processDecisioningPropositions(propositions: any[]): DecisioningItem[] {
  const items: DecisioningItem[] = [];

  propositions.forEach((proposition, propositionIndex) => {
    proposition.items?.forEach((offer: any, itemIndex: number) => {
      // Offer's content is exposed via the `content` getter (returns data.content)
      // on class instances, but plain-object propositions from tests use data.content directly.
      const content = offer.data?.content ?? offer.content ?? offer.data;
      let parsedContent = content;

      if (typeof content === 'string') {
        try {
          parsedContent = JSON.parse(content);
        } catch {
          parsedContent = content;
        }
      }

      if (offer.schema === 'https://ns.adobe.com/personalization/json-content-item') {
        let embeddedItems: any[] | null = null;
        if (parsedContent && Array.isArray(parsedContent.isJsonContent)) {
          embeddedItems = parsedContent.isJsonContent;
        } else if (Array.isArray(parsedContent)) {
          embeddedItems = parsedContent;
        }

        if (embeddedItems?.length) {
          embeddedItems.forEach((subOffer, offerIndex) => {
            const stableFallbackId = `embedded-${propositionIndex}-${itemIndex}-${offerIndex}`;
            items.push({
              id: subOffer.id || subOffer.itemID || stableFallbackId,
              itemID: subOffer.itemID,
              content: subOffer,
              format: 'application/json',
              proposition,
              propositionItem: offer,
              surface: proposition.scope,
              trackingToken: subOffer['data-item-token'] || subOffer.trackingToken,
              isEmbeddedItem: true,
            });
          });
          return;
        }

        items.push({
          id: offer.id || `json-${propositionIndex}-${itemIndex}`,
          content: parsedContent,
          format: 'application/json',
          proposition,
          propositionItem: offer,
          surface: proposition.scope,
        });
        return;
      }

      if (offer.schema === 'https://ns.adobe.com/personalization/html-content-item') {
        items.push({
          id: offer.id || `html-${propositionIndex}-${itemIndex}`,
          content: parsedContent,
          format: 'text/html',
          proposition,
          propositionItem: offer,
          surface: proposition.scope,
        });
        return;
      }

      items.push({
        id: offer.id || `generic-${propositionIndex}-${itemIndex}`,
        content: parsedContent,
        format: 'unknown',
        proposition,
        propositionItem: offer,
        surface: proposition.scope,
      });
    });
  });

  return items;
}

export function buildDecisioningItemTrackingKey(item: DecisioningItem): string {
  return `${item.proposition?.id || item.surface}:${item.id}`;
}

// ============================================================================
// TRACKING (Edge.sendEvent with synthesized decisioning XDM + custom-tenant envelope)
// ============================================================================

/** Profile shape used by the XDM builders (kept loose to avoid a circular type dep). */
type TrackingProfile = { firstName?: string; email?: string; phone?: string } | undefined;

function propositionIdOf(proposition: any): string | undefined {
  return proposition?.id ?? proposition?.uniqueId;
}

async function generateDisplayXdm(item: DecisioningItem): Promise<any> {
  const offer = item.propositionItem as any;
  if (offer && typeof offer.generateDisplayInteractionXdm === 'function') {
    return offer.generateDisplayInteractionXdm(item.proposition);
  }
  // Messaging propositions are plain objects (no generateXxxInteractionXdm).
  // Synthesize the minimum partial XDM so the builder still emits a valid
  // schema event.
  return {
    eventType: 'decisioning.propositionDisplay',
    _experience: {
      decisioning: {
        propositions: [
          {
            id: propositionIdOf(item.proposition),
            scope: item.proposition?.scope,
            scopeDetails: item.proposition?.scopeDetails,
            items: [{ id: offer?.id }],
          },
        ],
      },
    },
  };
}

async function generateTapXdm(item: DecisioningItem): Promise<any> {
  const offer = item.propositionItem as any;
  if (offer && typeof offer.generateTapInteractionXdm === 'function') {
    return offer.generateTapInteractionXdm(item.proposition);
  }
  return {
    eventType: 'decisioning.propositionInteract',
    _experience: {
      decisioning: {
        propositions: [
          {
            id: propositionIdOf(item.proposition),
            scope: item.proposition?.scope,
            scopeDetails: item.proposition?.scopeDetails,
            items: [{ id: offer?.id }],
          },
        ],
      },
    },
  };
}

export async function trackDecisioningItemDisplay(
  item: DecisioningItem,
  identityMap: any,
  profile?: TrackingProfile
): Promise<void> {
  const partialXdm = await generateDisplayXdm(item);
  const event = await buildPropositionDisplayEvent({
    generatedXdm: partialXdm,
    identityMap,
    profile,
    embeddedItem:
      item.trackingToken && item.isEmbeddedItem
        ? { id: item.id, trackingToken: item.trackingToken }
        : undefined,
  });
  await Edge.sendEvent(event);
}

export async function trackDecisioningItemInteraction(
  item: DecisioningItem,
  interaction: string,
  identityMap: any,
  profile?: TrackingProfile
): Promise<void> {
  const partialXdm = await generateTapXdm(item);
  const event = await buildPropositionInteractEvent({
    generatedXdm: partialXdm,
    identityMap,
    profile,
    interaction,
    embeddedItem:
      item.trackingToken && item.isEmbeddedItem
        ? { id: item.id, trackingToken: item.trackingToken }
        : undefined,
  });
  await Edge.sendEvent(event);
}

export async function refreshDecisioningSurfaceFromStoredConfig(): Promise<string | null> {
  const savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);
  const parsedConfig = safeParseJSON<DecisioningItemsConfig | null>(
    savedConfig,
    null,
    'refreshDecisioningSurfaceFromStoredConfig'
  );

  if (!parsedConfig?.surface) {
    return null;
  }

  Messaging.updatePropositionsForSurfaces([parsedConfig.surface]);
  return parsedConfig.surface;
}
