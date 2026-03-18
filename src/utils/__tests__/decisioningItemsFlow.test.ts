import AsyncStorage from '@react-native-async-storage/async-storage';
import { Edge, ExperienceEvent } from '@adobe/react-native-aepedge';
import { Messaging } from '@adobe/react-native-aepmessaging';
import {
  buildDecisioningItemTrackingKey,
  normalizePropositionsResult,
  parseDecisioningItemContent,
  processDecisioningPropositions,
  refreshDecisioningSurfaceFromStoredConfig,
  trackDecisioningItemDisplay,
  trackDecisioningItemInteraction,
} from '../decisioningItems';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('@adobe/react-native-aepmessaging', () => ({
  Messaging: {
    updatePropositionsForSurfaces: jest.fn(),
  },
  MessagingEdgeEventType: {
    DISPLAY: 'display',
    INTERACT: 'interact',
  },
}));

jest.mock('@adobe/react-native-aepedge', () => ({
  Edge: {
    sendEvent: jest.fn(),
  },
  ExperienceEvent: function (opts: { xdmData?: any }) {
    return { xdmData: opts?.xdmData ?? {} };
  },
}));

describe('Decisioning Items flow contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses common decisioning fields from content', () => {
    const parsed = parseDecisioningItemContent({
      id: 'item-1',
      content: JSON.stringify({
        name: 'Promo',
        description: 'Body',
        image: 'https://example.com/image.png',
        ctaText: 'Shop',
        ctaUrl: '/shop',
        price: '12.50',
        category: 'promo',
      }),
      proposition: {},
      propositionItem: {},
      surface: 'edge-offers',
    });

    expect(parsed).toMatchObject({
      title: 'Promo',
      description: 'Body',
      image: 'https://example.com/image.png',
      ctaText: 'Shop',
      ctaUrl: '/shop',
      price: '12.50',
      badge: 'promo',
    });
  });

  it('unpacks embedded isJsonContent items and preserves tracking tokens', () => {
    const items = processDecisioningPropositions([
      {
        id: 'prop-1',
        scope: 'edge-offers',
        items: [
          {
            id: 'parent-item',
            schema: 'https://ns.adobe.com/personalization/json-content-item',
            data: {
              content: JSON.stringify({
                isJsonContent: [
                  {
                    id: 'child-1',
                    name: 'Offer A',
                    'data-item-token': 'token-a',
                  },
                  {
                    itemID: 'child-2',
                    name: 'Offer B',
                    trackingToken: 'token-b',
                  },
                ],
              }),
            },
          },
        ],
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'child-1',
      trackingToken: 'token-a',
      isEmbeddedItem: true,
    });
    expect(items[1]).toMatchObject({
      id: 'child-2',
      trackingToken: 'token-b',
      isEmbeddedItem: true,
    });
  });

  it('normalizes proposition responses and builds stable tracking keys', () => {
    const normalized = normalizePropositionsResult({
      'edge-offers': [{ id: 'prop-1' }],
    });

    expect(normalized).toEqual([{ id: 'prop-1' }]);
    expect(buildDecisioningItemTrackingKey({
      id: 'item-1',
      content: {},
      proposition: { id: 'prop-1' },
      propositionItem: {},
      surface: 'edge-offers',
    })).toBe('prop-1:item-1');
  });

  it('tracks display and interaction with native proposition item methods when available', async () => {
    const track = jest.fn();
    const item = {
      id: 'item-1',
      content: { name: 'Offer A' },
      proposition: { id: 'prop-1', scope: 'edge-offers', scopeDetails: {} },
      propositionItem: { id: 'parent', track },
      surface: 'edge-offers',
      trackingToken: 'token-a',
      isEmbeddedItem: true,
    };

    await trackDecisioningItemDisplay(item as any);
    await trackDecisioningItemInteraction(item as any, 'click');

    expect(track).toHaveBeenNthCalledWith(1, null, 'display', ['token-a']);
    expect(track).toHaveBeenNthCalledWith(2, 'click', 'interact', ['token-a']);
  });

  it('falls back to Edge interaction events when native track is unavailable', async () => {
    const item = {
      id: 'item-1',
      content: { name: 'Offer A' },
      proposition: { id: 'prop-1', scope: 'edge-offers', scopeDetails: { foo: 'bar' } },
      propositionItem: { id: 'parent' },
      surface: 'edge-offers',
      trackingToken: 'token-a',
      isEmbeddedItem: true,
    };

    await trackDecisioningItemDisplay(item as any);
    await trackDecisioningItemInteraction(item as any, 'click');

    expect(Edge.sendEvent).toHaveBeenCalledTimes(2);
    expect((Edge.sendEvent as jest.Mock).mock.calls[0][0]).toEqual(
      new (ExperienceEvent as any)({
        xdmData: expect.objectContaining({
          eventType: 'decisioning.propositionDisplay',
        }),
      })
    );
  });

  it('refreshes the configured decisioning surface from stored config', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      surface: 'edge-offers',
      previewUrl: 'app://decisioning-items',
    }));

    const refreshedSurface = await refreshDecisioningSurfaceFromStoredConfig();

    expect(refreshedSurface).toBe('edge-offers');
    expect(Messaging.updatePropositionsForSurfaces).toHaveBeenCalledWith(['edge-offers']);
  });

  it('returns null when no stored decisioning surface is configured', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const refreshedSurface = await refreshDecisioningSurfaceFromStoredConfig();

    expect(refreshedSurface).toBeNull();
    expect(Messaging.updatePropositionsForSurfaces).not.toHaveBeenCalled();
  });
});
