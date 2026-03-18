import { Edge, ExperienceEvent } from '@adobe/react-native-aepedge';
import { Messaging, MessagingEdgeEventType } from '@adobe/react-native-aepmessaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DECISIONING_ITEMS_CONFIG_KEY = '@decisioning_items_config';
export const DEFAULT_SURFACE = 'edge-offers';
export const DEFAULT_PREVIEW_URL = 'com.cmtBootCamp.AEPSampleAppNewArchEnabled://decisioning-items';

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
  proposition: any;
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

export function normalizePropositionsResult(propositionsResult: any): any[] {
  if (Array.isArray(propositionsResult)) {
    return propositionsResult;
  }

  if (propositionsResult && typeof propositionsResult === 'object') {
    return Object.values(propositionsResult).flat();
  }

  return [];
}

export function processDecisioningPropositions(propositions: any[]): DecisioningItem[] {
  const items: DecisioningItem[] = [];

  propositions.forEach((proposition, propositionIndex) => {
    proposition.items?.forEach((item: any, itemIndex: number) => {
      const content = item.data?.content || item.data;
      let parsedContent = content;

      if (typeof content === 'string') {
        try {
          parsedContent = JSON.parse(content);
        } catch {
          parsedContent = content;
        }
      }

      if (item.schema === 'https://ns.adobe.com/personalization/json-content-item') {
        let embeddedItems: any[] | null = null;
        if (parsedContent && Array.isArray(parsedContent.isJsonContent)) {
          embeddedItems = parsedContent.isJsonContent;
        } else if (Array.isArray(parsedContent)) {
          embeddedItems = parsedContent;
        }

        if (embeddedItems?.length) {
          embeddedItems.forEach((offer, offerIndex) => {
            const stableFallbackId = `embedded-${propositionIndex}-${itemIndex}-${offerIndex}`;
            items.push({
              id: offer.id || offer.itemID || stableFallbackId,
              itemID: offer.itemID,
              content: offer,
              format: 'application/json',
              proposition,
              propositionItem: item,
              surface: proposition.scope,
              trackingToken: offer['data-item-token'] || offer.trackingToken,
              isEmbeddedItem: true,
            });
          });
          return;
        }

        items.push({
          id: item.id || `json-${propositionIndex}-${itemIndex}`,
          content: parsedContent,
          format: 'application/json',
          proposition,
          propositionItem: item,
          surface: proposition.scope,
        });
        return;
      }

      if (item.schema === 'https://ns.adobe.com/personalization/html-content-item') {
        items.push({
          id: item.id || `html-${propositionIndex}-${itemIndex}`,
          content: parsedContent,
          format: 'text/html',
          proposition,
          propositionItem: item,
          surface: proposition.scope,
        });
        return;
      }

      items.push({
        id: item.id || `generic-${propositionIndex}-${itemIndex}`,
        content: parsedContent,
        format: 'unknown',
        proposition,
        propositionItem: item,
        surface: proposition.scope,
      });
    });
  });

  return items;
}

export function buildDecisioningItemTrackingKey(item: DecisioningItem): string {
  return `${item.proposition?.id || item.surface}:${item.id}`;
}

export async function trackDecisioningItemDisplay(item: DecisioningItem): Promise<void> {
  if (item.propositionItem && typeof item.propositionItem.track === 'function') {
    if (item.trackingToken && item.isEmbeddedItem) {
      item.propositionItem.track(null, MessagingEdgeEventType.DISPLAY, [item.trackingToken]);
      return;
    }

    item.propositionItem.track(null, MessagingEdgeEventType.DISPLAY);
    return;
  }

  const xdmData: any = {
    eventType: 'decisioning.propositionDisplay',
    _experience: {
      decisioning: {
        propositions: [
          {
            id: item.proposition.id,
            scope: item.surface || item.proposition.scope,
            scopeDetails: {
              ...item.proposition.scopeDetails,
            },
          },
        ],
      },
    },
  };

  if (item.trackingToken && item.isEmbeddedItem) {
    xdmData._experience.decisioning.propositions[0].items = [
      {
        id: item.propositionItem.id,
        trackingToken: item.trackingToken,
      },
    ];
  }

  await Edge.sendEvent(new ExperienceEvent({ xdmData }));
}

export async function trackDecisioningItemInteraction(item: DecisioningItem, interaction: string): Promise<void> {
  if (item.propositionItem && typeof item.propositionItem.track === 'function') {
    if (item.trackingToken && item.isEmbeddedItem) {
      item.propositionItem.track(interaction, MessagingEdgeEventType.INTERACT, [item.trackingToken]);
      return;
    }

    item.propositionItem.track(interaction, MessagingEdgeEventType.INTERACT);
    return;
  }

  const xdmData: any = {
    eventType: 'decisioning.propositionInteract',
    _experience: {
      decisioning: {
        propositions: [
          {
            id: item.proposition.id,
            scope: item.surface || item.proposition.scope,
            scopeDetails: {
              ...item.proposition.scopeDetails,
            },
          },
        ],
      },
    },
  };

  if (item.trackingToken && item.isEmbeddedItem) {
    xdmData._experience.decisioning.propositions[0].items = [
      {
        id: item.propositionItem.id,
        trackingToken: item.trackingToken,
      },
    ];
  }

  if (interaction) {
    xdmData._experience.decisioning.propositionAction = {
      label: interaction,
    };
  }

  await Edge.sendEvent(new ExperienceEvent({ xdmData }));
}

export async function refreshDecisioningSurfaceFromStoredConfig(): Promise<string | null> {
  const savedConfig = await AsyncStorage.getItem(DECISIONING_ITEMS_CONFIG_KEY);

  if (!savedConfig) {
    return null;
  }

  const parsedConfig = JSON.parse(savedConfig) as DecisioningItemsConfig;
  if (!parsedConfig.surface) {
    return null;
  }

  await Messaging.updatePropositionsForSurfaces([parsedConfig.surface]);
  return parsedConfig.surface;
}
