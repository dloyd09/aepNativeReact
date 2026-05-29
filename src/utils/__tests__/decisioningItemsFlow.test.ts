import AsyncStorage from '@react-native-async-storage/async-storage';
import { Edge, ExperienceEvent } from '@adobe/react-native-aepedge';
import { Messaging } from '@adobe/react-native-aepmessaging';
import {
  buildDecisioningItemTrackingKey,
  buildSurfaceUri,
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

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      ios: { bundleIdentifier: 'com.cmtBootCamp.AEPSampleAppNewArchEnabled' },
      android: { package: 'com.cmtBootCamp.AEPSampleAppNewArchEnabled' },
    },
  },
}));

jest.mock('@adobe/react-native-aepmessaging', () => ({
  Messaging: {
    updatePropositionsForSurfaces: jest.fn(),
    getPropositionsForSurfaces: jest.fn(() => Promise.resolve({})),
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
      proposition: {} as any,
      propositionItem: {} as any,
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
    const arrayInput = [{ id: 'prop-1' } as any];
    expect(normalizePropositionsResult(arrayInput)).toEqual([{ id: 'prop-1' }]);

    const mapInput = new Map<string, any>([['edge-offers', { id: 'prop-1' }]]);
    expect(normalizePropositionsResult(mapInput)).toEqual([{ id: 'prop-1' }]);

    expect(buildDecisioningItemTrackingKey({
      id: 'item-1',
      content: {},
      proposition: { id: 'prop-1' } as any,
      propositionItem: {} as any,
      surface: 'edge-offers',
    })).toBe('prop-1:item-1');
  });

  it('expands a partial surface name to the full mobileapp:// URI', () => {
    expect(buildSurfaceUri('edge-offers')).toBe(
      'mobileapp://com.cmtBootCamp.AEPSampleAppNewArchEnabled/edge-offers'
    );
    expect(buildSurfaceUri('mobileapp://other/already-full')).toBe(
      'mobileapp://other/already-full'
    );
  });

  it('sends display + interact events through Edge with the custom tenant envelope', async () => {
    const generateDisplayInteractionXdm = jest.fn(() =>
      Promise.resolve({
        eventType: 'decisioning.propositionDisplay',
        _experience: {
          decisioning: {
            propositions: [
              { id: 'prop-1', scope: 'edge-offers', scopeDetails: { foo: 'bar' }, items: [{ id: 'offer-1' }] },
            ],
          },
        },
      })
    );
    const generateTapInteractionXdm = jest.fn(() =>
      Promise.resolve({
        eventType: 'decisioning.propositionInteract',
        _experience: {
          decisioning: {
            propositions: [
              { id: 'prop-1', scope: 'edge-offers', scopeDetails: { foo: 'bar' }, items: [{ id: 'offer-1' }] },
            ],
          },
        },
      })
    );

    const item = {
      id: 'item-1',
      content: { name: 'Offer A' },
      proposition: { id: 'prop-1', scope: 'edge-offers', scopeDetails: { foo: 'bar' } } as any,
      propositionItem: {
        id: 'offer-1',
        generateDisplayInteractionXdm,
        generateTapInteractionXdm,
      } as any,
      surface: 'edge-offers',
      trackingToken: 'token-a',
      isEmbeddedItem: true,
    };

    const identityMap = { ECID: [{ id: 'ecid-123', authenticatedState: 'ambiguous', primary: true }] };
    const profile = { firstName: 'Alex', email: 'alex@example.com' };

    await trackDecisioningItemDisplay(item, identityMap, profile);
    await trackDecisioningItemInteraction(item, 'click', identityMap, profile);

    expect(generateDisplayInteractionXdm).toHaveBeenCalledWith(item.proposition);
    expect(generateTapInteractionXdm).toHaveBeenCalledWith(item.proposition);
    expect(Edge.sendEvent).toHaveBeenCalledTimes(2);

    const [displayCall, interactCall] = (Edge.sendEvent as jest.Mock).mock.calls;

    expect(displayCall[0].xdmData).toMatchObject({
      eventType: 'decisioning.propositionDisplay',
      identityMap,
      _adobecmteas: expect.objectContaining({
        identities: expect.objectContaining({ ecid: 'ecid-123' }),
        authentication: expect.objectContaining({ loginStatus: 'logged-in' }),
        visitorDetails: expect.objectContaining({ visitorType: 'Customer' }),
      }),
    });

    expect(interactCall[0].xdmData._experience.decisioning.propositionAction).toEqual({
      label: 'click',
    });
    expect(interactCall[0].xdmData._experience.decisioning.propositions[0].items).toEqual([
      { id: 'item-1', trackingToken: 'token-a' },
    ]);
    expect(interactCall[0].xdmData._adobecmteas.identities.ecid).toBe('ecid-123');
  });

  it('synthesizes a partial XDM when the proposition item has no generateXxxInteractionXdm', async () => {
    const item = {
      id: 'item-1',
      content: { name: 'Offer A' },
      proposition: { id: 'prop-1', scope: 'edge-offers', scopeDetails: { foo: 'bar' } } as any,
      propositionItem: { id: 'offer-1' } as any,
      surface: 'edge-offers',
    };

    const identityMap = { ECID: [{ id: 'ecid-456' }] };

    await trackDecisioningItemDisplay(item, identityMap);

    expect(Edge.sendEvent).toHaveBeenCalledTimes(1);
    const sent = (Edge.sendEvent as jest.Mock).mock.calls[0][0].xdmData;
    expect(sent.eventType).toBe('decisioning.propositionDisplay');
    expect(sent._adobecmteas.identities.ecid).toBe('ecid-456');
    expect(sent._experience.decisioning.propositions[0].id).toBe('prop-1');
  });

  it('refreshes the configured decisioning surface from stored config', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      surface: 'edge-offers',
      previewUrl: 'app://decisioning-items',
    }));

    const refreshedSurface = await refreshDecisioningSurfaceFromStoredConfig();

    expect(refreshedSurface).toBe('edge-offers');
    expect(Messaging.updatePropositionsForSurfaces).toHaveBeenCalledTimes(1);
    expect(Messaging.updatePropositionsForSurfaces).toHaveBeenCalledWith(['edge-offers']);
  });

  it('returns null when no stored decisioning surface is configured', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const refreshedSurface = await refreshDecisioningSurfaceFromStoredConfig();

    expect(refreshedSurface).toBeNull();
    expect(Messaging.updatePropositionsForSurfaces).not.toHaveBeenCalled();
  });

  it('exists check: ExperienceEvent constructor is reachable from the test harness', () => {
    expect(new (ExperienceEvent as any)({ xdmData: { a: 1 } })).toEqual({ xdmData: { a: 1 } });
  });
});
