import {
  buildOfferTrackingKey,
  buildOptimizeRequestXdm,
  createOptimizePropositionUpdateHandler,
  getOffersForScope,
  isValidOfferImage,
  mapOptimizePropositionToOffers,
  trackOfferDisplay,
  trackOfferTap,
} from '../offersOptimize';

function createMockOffer(id: string, content: Record<string, any>) {
  return {
    id,
    data: {
      content: JSON.stringify(content),
    },
    displayed: jest.fn(),
    tapped: jest.fn(),
  };
}

function createMockProposition(scope: string, items: any[]) {
  return {
    id: `prop-${scope}`,
    scope,
    items,
  } as any;
}

describe('Offers Optimize flow contract', () => {
  it('maps proposition items into consumer offers', () => {
    const proposition = createMockProposition('scope-a', [
      createMockOffer('offer-1', {
        name: 'Spring Promo',
        text: 'Discount text',
        image: 'https://example.com/img.png',
        price: '19.99',
        category: 'promotions',
        sku: 'SPRING-1',
      }),
    ]);

    const offers = mapOptimizePropositionToOffers(proposition);

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      id: 'offer-1',
      title: 'Spring Promo',
      text: 'Discount text',
      image: 'https://example.com/img.png',
      price: 19.99,
      category: 'promotions',
      sku: 'SPRING-1',
    });
  });

  it('uses the latest decision scope inside the proposition update handler', () => {
    const first = createMockProposition('scope-a', [
      createMockOffer('offer-a', { title: 'Offer A' }),
    ]);
    const second = createMockProposition('scope-b', [
      createMockOffer('offer-b', { title: 'Offer B' }),
    ]);
    const propositions = new Map<string, any>([
      ['scope-a', first],
      ['scope-b', second],
    ]);
    const scopeRef = { current: 'scope-a' };
    const setOffers = jest.fn();
    const handler = createOptimizePropositionUpdateHandler(scopeRef, setOffers);

    handler(propositions);
    scopeRef.current = 'scope-b';
    handler(propositions);

    expect(setOffers).toHaveBeenNthCalledWith(1, getOffersForScope(propositions, 'scope-a'));
    expect(setOffers).toHaveBeenNthCalledWith(2, getOffersForScope(propositions, 'scope-b'));
  });

  it('builds the expected Optimize request XDM payload', () => {
    const xdm = buildOptimizeRequestXdm('mock-ecid-123');

    expect(xdm.get('eventType')).toBe('personalization.request');
    expect(xdm.get('identityMap')).toEqual({
      ECID: [{ id: 'mock-ecid-123', primary: true }],
    });
  });

  it('tracks display and tap against the underlying Optimize offer', () => {
    const rawOffer = createMockOffer('offer-1', { title: 'Tracked Offer' });
    const proposition = createMockProposition('scope-a', [rawOffer]);
    const consumerOffer = mapOptimizePropositionToOffers(proposition)[0];

    trackOfferDisplay(consumerOffer);
    trackOfferTap(consumerOffer);

    expect(rawOffer.displayed).toHaveBeenCalledWith(proposition);
    expect(rawOffer.tapped).toHaveBeenCalledWith(proposition);
  });

  it('treats empty image values as invalid and builds stable tracking keys', () => {
    const proposition = createMockProposition('scope-a', [
      createMockOffer('offer-1', { title: 'Offer A', image: '   ' }),
    ]);
    const consumerOffer = mapOptimizePropositionToOffers(proposition)[0];

    expect(isValidOfferImage(consumerOffer.image)).toBe(false);
    expect(buildOfferTrackingKey(consumerOffer)).toBe('prop-scope-a:offer-1');
  });
});
