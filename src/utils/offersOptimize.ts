export interface ConsumerOffer {
  id: string;
  title: string;
  text: string;
  image: string;
  price: number;
  name: string;
  category: string;
  sku: string;
  /** Surface name the proposition was fetched for. Used in tracking. */
  surface: string;
  /** Raw proposition object from the Messaging bridge (id/uniqueId, scope, scopeDetails). */
  proposition: any;
  /** Raw proposition item / offer object from the Messaging bridge. */
  rawOffer: any;
}

export function parseOfferContent(content: unknown): Record<string, any> {
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Error parsing proposition item content:', error);
      return {};
    }
  }

  if (content && typeof content === 'object') {
    return content as Record<string, any>;
  }

  return {};
}

function mapItemToOffer(
  item: any,
  proposition: any,
  surface: string,
  index: number
): ConsumerOffer {
  const parsedContent = parseOfferContent(item?.data?.content ?? item?.content);
  const rawPrice = parsedContent.price;
  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice ?? 0);

  return {
    id: item?.id || parsedContent.id || parsedContent.sku || `offer-${index}`,
    title: parsedContent.name || parsedContent.title || 'No Title',
    text: parsedContent.text || parsedContent.description || 'No Text',
    image: typeof parsedContent.image === 'string' ? parsedContent.image.trim() : '',
    price: Number.isFinite(price) ? price : 0,
    name: parsedContent.name || parsedContent.title || 'Unnamed Offer',
    category: parsedContent.category || 'defaultCategory',
    sku: parsedContent.sku || item?.id || 'defaultSku',
    surface,
    proposition,
    rawOffer: item,
  };
}

/**
 * Flatten the array of propositions returned by
 * `normalizePropositionsResult(Messaging.getPropositionsForSurfaces(...))`
 * into a list of `ConsumerOffer`s ready for FlatList rendering.
 */
export function mapPropositionsToOffers(
  propositions: any[] | null | undefined,
  surface: string
): ConsumerOffer[] {
  if (!propositions?.length) return [];
  return propositions.flatMap((proposition) =>
    (proposition?.items ?? []).map((item: any, idx: number) =>
      mapItemToOffer(item, proposition, surface, idx)
    )
  );
}

export function isValidOfferImage(image: string | null | undefined): boolean {
  return typeof image === 'string' && image.trim().length > 0;
}

export function buildOfferTrackingKey(offer: ConsumerOffer): string {
  const propId =
    offer.proposition?.id ?? offer.proposition?.uniqueId ?? offer.surface;
  return `${propId}:${offer.id}`;
}
