import {
  buildOfferTrackingKey,
  isValidOfferImage,
  mapPropositionsToOffers,
} from '../offersOptimize';

function createMockItem(id: string, content: Record<string, any>) {
  return {
    id,
    data: {
      content: JSON.stringify(content),
    },
  };
}

function createMockProposition(scope: string, items: any[]) {
  return {
    id: `prop-${scope}`,
    scope,
    scopeDetails: { activity: { id: scope } },
    items,
  } as any;
}

describe('Offers proposition mapping (Messaging surface delivery)', () => {
  it('flattens proposition items into consumer offers', () => {
    const proposition = createMockProposition('edge-offers', [
      createMockItem('offer-1', {
        name: 'Spring Promo',
        text: 'Discount text',
        image: 'https://example.com/img.png',
        price: '19.99',
        category: 'promotions',
        sku: 'SPRING-1',
      }),
    ]);

    const offers = mapPropositionsToOffers([proposition], 'edge-offers');

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      id: 'offer-1',
      title: 'Spring Promo',
      text: 'Discount text',
      image: 'https://example.com/img.png',
      price: 19.99,
      category: 'promotions',
      sku: 'SPRING-1',
      surface: 'edge-offers',
    });
  });

  it('flattens items across multiple propositions for the same surface', () => {
    const propositions = [
      createMockProposition('edge-offers', [
        createMockItem('offer-a', { name: 'Offer A', price: 1 }),
      ]),
      createMockProposition('edge-offers', [
        createMockItem('offer-b', { name: 'Offer B', price: 2 }),
      ]),
    ];

    const offers = mapPropositionsToOffers(propositions, 'edge-offers');

    expect(offers.map((o) => o.id)).toEqual(['offer-a', 'offer-b']);
    expect(offers.every((o) => o.surface === 'edge-offers')).toBe(true);
  });

  it('returns [] for missing or empty inputs', () => {
    expect(mapPropositionsToOffers([], 'edge-offers')).toEqual([]);
    expect(mapPropositionsToOffers(null, 'edge-offers')).toEqual([]);
    expect(mapPropositionsToOffers(undefined, 'edge-offers')).toEqual([]);
  });

  it('treats empty image values as invalid and builds stable tracking keys', () => {
    const proposition = createMockProposition('edge-offers', [
      createMockItem('offer-1', { name: 'Offer A', image: '   ' }),
    ]);
    const consumerOffer = mapPropositionsToOffers([proposition], 'edge-offers')[0];

    expect(isValidOfferImage(consumerOffer.image)).toBe(false);
    expect(buildOfferTrackingKey(consumerOffer)).toBe('prop-edge-offers:offer-1');
  });

  it('falls back to proposition.uniqueId, then surface, when building tracking keys', () => {
    const propositionWithUniqueId = {
      uniqueId: 'unique-123',
      scope: 'edge-offers',
      items: [createMockItem('offer-1', { name: 'A' })],
    };
    const offers = mapPropositionsToOffers([propositionWithUniqueId], 'edge-offers');
    expect(buildOfferTrackingKey(offers[0])).toBe('unique-123:offer-1');

    const propositionWithNoIds = {
      scope: 'edge-offers',
      items: [createMockItem('offer-1', { name: 'A' })],
    };
    const offersNoIds = mapPropositionsToOffers([propositionWithNoIds], 'edge-offers');
    expect(buildOfferTrackingKey(offersNoIds[0])).toBe('edge-offers:offer-1');
  });
});
