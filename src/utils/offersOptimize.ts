import { Proposition } from '@adobe/react-native-aepoptimize';

export interface ConsumerOffer {
  id: string;
  title: string;
  text: string;
  image: string;
  price: number;
  name: string;
  category: string;
  sku: string;
  proposition: Proposition;
  rawOffer: any;
}

export function parseOfferContent(content: unknown): Record<string, any> {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Error parsing Optimize offer content:', error);
      return {};
    }
  }

  if (content && typeof content === 'object') {
    return content as Record<string, any>;
  }

  return {};
}

export function mapOptimizePropositionToOffers(proposition?: Proposition | null): ConsumerOffer[] {
  if (!proposition?.items?.length) {
    return [];
  }

  return proposition.items.map((item: any, index: number) => {
    const parsedContent = parseOfferContent(item.data?.content ?? item.content);
    const rawPrice = parsedContent.price;
    const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice ?? 0);

    return {
      id: item.id || parsedContent.id || parsedContent.sku || `offer-${index}`,
      title: parsedContent.name || parsedContent.title || 'No Title',
      text: parsedContent.text || parsedContent.description || 'No Text',
      image: typeof parsedContent.image === 'string' ? parsedContent.image.trim() : '',
      price: Number.isFinite(price) ? price : 0,
      name: parsedContent.name || parsedContent.title || 'Unnamed Offer',
      category: parsedContent.category || 'defaultCategory',
      sku: parsedContent.sku || item.id || 'defaultSku',
      proposition,
      rawOffer: item,
    };
  });
}

export function getOffersForScope(
  propositions: Map<string, Proposition> | undefined,
  scopeName: string
): ConsumerOffer[] {
  if (!propositions || !scopeName) {
    return [];
  }

  return mapOptimizePropositionToOffers(propositions.get(scopeName));
}

export function createOptimizePropositionUpdateHandler(
  scopeRef: { current: string },
  setOffers: (offers: ConsumerOffer[]) => void
) {
  return (propositions?: Map<string, Proposition>) => {
    const scopeName = scopeRef.current;

    if (!propositions || !scopeName) {
      setOffers([]);
      return;
    }

    setOffers(getOffersForScope(propositions, scopeName));
  };
}

export function buildOptimizeRequestXdm(ecid: string): Map<string, any> {
  const xdm = new Map<string, any>();
  xdm.set('eventType', 'personalization.request');
  xdm.set('identityMap', {
    ECID: [{ id: ecid, primary: true }],
  });
  return xdm;
}

export function isValidOfferImage(image: string | null | undefined): boolean {
  return typeof image === 'string' && image.trim().length > 0;
}

export function buildOfferTrackingKey(offer: ConsumerOffer): string {
  return `${offer.proposition.id}:${offer.id}`;
}

export function trackOfferDisplay(offer: ConsumerOffer): void {
  if (offer.rawOffer && typeof offer.rawOffer.displayed === 'function') {
    offer.rawOffer.displayed(offer.proposition);
  }
}

export function trackOfferTap(offer: ConsumerOffer): void {
  if (offer.rawOffer && typeof offer.rawOffer.tapped === 'function') {
    offer.rawOffer.tapped(offer.proposition);
  }
}
