/**
 * XDM Event Builders for tempMobile Interactions Schema
 * 
 * Provides standardized event builders for the _adobecmteas tenant namespace.
 * All events comply with SchemaUpdateGuide.md requirements.
 * 
 * Event Types:
 * - Page views (mobileApp.navigation.pageViews)
 * - Navigation clicks (mobileApp.navigation.clicks)
 * - Commerce checkouts (commerce.checkouts)
 * - Product list updates (commerce.productListUpdates)
 * - Product list removals (commerce.productListRemovals)
 * - Product views (commerce.productViews)
 * - Product list adds (commerce.productListAdds)
 * - Purchases (commerce.purchases)
 * - Login/logout (authentication events)
 */

import { ExperienceEvent } from '@adobe/react-native-aepedge';
import { buildTenantIdentities, extractECID } from './identityHelpers';
import { Platform, Dimensions } from 'react-native';
import * as Device from 'expo-device';

// ============================================================================
// ENVIRONMENT HELPER
// ============================================================================

/**
 * Builds the environment object for XDM events
 * Captures device type, OS, screen dimensions
 */
export const buildEnvironment = () => {
  const screenInfo = Dimensions.get('window');
  
  return {
    type: 'application', // Native mobile application
    browserDetails: {
      viewportHeight: Math.round(screenInfo.height),
      viewportWidth: Math.round(screenInfo.width),
    },
    operatingSystem: Platform.OS === 'ios' ? 'iOS' : 'Android',
    operatingSystemVersion: Device.osVersion || String(Platform.Version),
    // Device type classification
    _dc: {
      language: 'en-US', // Default, could be enhanced with i18n
    }
  };
};

// Converts a slash-path to a colon-path for web.webPageDetails.name
// e.g. "/products/women/shorts" → "products:women:shorts"
const makePageName = (path: string): string =>
  path.replace(/^\//, '').replace(/\//g, ':');

// ============================================================================
// TYPES
// ============================================================================

interface BaseEventParams {
  identityMap: any;
  profile?: {
    firstName?: string;
    email?: string;
    phone?: string;
  };
}

interface PageViewEventParams extends BaseEventParams {
  pageTitle: string;
  pagePath: string;
  pageType: string;
  previousURL?: string;
  previousPageName?: string;
  previousPagePath?: string;
  siteSection?: string;
  siteSection2?: string;
  siteSection3?: string;
  pageLoadTime?: number;
  productListItems?: any[];
  cartSessionId?: string;
}

interface CheckoutEventParams extends BaseEventParams {
  cartSessionId: string;
  productListItems: any[];
}

interface ProductRemovalParams extends BaseEventParams {
  cartSessionId: string;
  productListItems: any[]; // Items being removed
  pageTitle?: string;
  pagePath?: string;
  pageType?: string;
}

interface PurchaseEventParams extends BaseEventParams {
  purchaseID: string;
  cartSessionId: string;
  productListItems: any[];
  /** Grand total (subtotal + shipping + tax) — maps to commerce.order.priceTotal */
  priceTotal: number;
  currencyCode?: string;
  /** CJA: commerce.shipping.shippingAmount */
  shippingAmount?: number;
  /** CJA: commerce.order.taxAmount */
  taxAmount?: number;
}

interface LoginEventParams extends BaseEventParams {
  success: boolean;
  method?: string;
  registration?: boolean;
}

interface LogoutEventParams extends BaseEventParams {
}

interface ProductViewEventParams extends BaseEventParams {
  product: {
    sku: string;
    name: string;
    price: number;
    category?: string;
    secondaryCategory?: string;
  };
  pageTitle?: string;
  pagePath?: string;
  pageType?: string;
}

interface ProductListAddEventParams extends BaseEventParams {
  product: {
    sku: string;
    name: string;
    price: number;
    category?: string;
    secondaryCategory?: string;
    quantity?: number;
  };
  cartSessionId: string;
  pageTitle?: string;
  pagePath?: string;
  pageType?: string;
}

interface PushTrackingEventParams extends BaseEventParams {
  pushProvider: 'apns' | 'fcm';
  pushProviderMessageID: string;
  interaction: 'opened' | 'customAction';
  actionID?: string;
  correlationID?: string;
}

interface PushRegistrationEventParams extends BaseEventParams {
  pushProvider: 'apns' | 'fcm';
  pushToken: string;
}

interface PropositionTrackingEventParams extends BaseEventParams {
  /** Partial XDM map returned by Optimize Offer.generateDisplayInteractionXdm / generateTapInteractionXdm. Contains eventType + _experience.decisioning. */
  generatedXdm: any;
  /** Interaction label (e.g. 'click'). Only used for interact events; ignored on display. */
  interaction?: string;
  /** When tracking an embedded sub-item (e.g. one entry inside an isJsonContent array), override propositions[0].items so AJO ties the event to the right token. */
  embeddedItem?: { id: string; trackingToken: string };
}

/** Params for product list open (e.g. new cart created). Call when a new cart session is created. */
interface ProductListOpenEventParams extends BaseEventParams {
  cartSessionId?: string;
  pageTitle?: string;
  pagePath?: string;
  pageType?: string;
  productListItems?: any[];
}

// ============================================================================
// PRODUCT HELPERS
// ============================================================================

/**
 * Format product list items with tenant fields
 * 
 * Adds _adobecmteas fields to each product item:
 * - lowerFunnel.cartID - Persistent cart session ID
 * - products.unitPrice - Individual item price
 * 
 * @param items - Array of cart items
 * @param cartSessionId - Persistent cart session ID
 * @returns Formatted product list with tenant fields
 * 
 * @example
 * const formatted = formatProductListItems(cartItems, 'cart-123-abc');
 * // Each item gets _adobecmteas.lowerFunnel.cartID and _adobecmteas.products.unitPrice
 */
export const formatProductListItems = (
  items: any[],
  cartSessionId: string
): any[] => {
  return items.map(item => {
    const categories: { categoryID: string; categoryName: string }[] = [
      { categoryID: 'primaryCategory', categoryName: item.category || 'unknown' },
    ];
    if (item.secondaryCategory) {
      categories.push({ categoryID: 'secondaryCategory', categoryName: item.secondaryCategory });
    }
    return {
      SKU: item.sku || 'unknown',
      name: item.name || item.title || 'Unnamed Product',
      quantity: item.quantity || 1,
      priceTotal: (item.price || 0) * (item.quantity || 1),
      productCategories: categories,
      _adobecmteas: {
        lowerFunnel: {
          cartID: cartSessionId
        },
        products: {
          unitPrice: item.price || 0
        }
      }
    };
  });
};

// ============================================================================
// EVENT BUILDERS
// ============================================================================

/**
 * Build page view event
 * 
 * Creates XDM-compliant page view event with:
 * - Tenant identity fields
 * - Authentication status
 * - Visitor type
 * - Page context
 * - Optional product list
 * 
 * @param params - Page view parameters
 * @returns XDM event object ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildPageViewEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   pageTitle: 'Shopping Cart',
 *   pagePath: '/cart',
 *   pageType: 'cart',
 *   productListItems: cartItems,
 *   cartSessionId: 'cart-123-abc'
 * });
 * await Edge.sendEvent(event);
 */
export const buildPageViewEvent = async (
  params: PageViewEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Only include identities if we have at least ECID
  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };

  // Only add identities if we have data
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'mobileApp.navigation.pageViews',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: tenantData,
    
    environment: buildEnvironment(),  // Device/platform context
    
    web: {
      webPageDetails: {
        pageViews: {
          value: 1  // Required field for mobileApp.navigation.pageViews eventType
        },
        server: 'mobileapp',
        name: makePageName(params.pagePath),
        URL: params.pagePath,
        _adobecmteas: {
          pageTitle: params.pageTitle,
          pagePath: params.pagePath,
          pageType: params.pageType,
          language: 'en-US'
        }
      },
      webInteraction: {
        linkClicks: { value: 0 },
        name: params.pageTitle.toLowerCase(),
        _adobecmteas: {}
      }
    }
  };

  // Add top-level siteSection (outside tenant namespace)
  if (params.siteSection && params.siteSection !== undefined) {
    xdmData.web.webPageDetails.siteSection = params.siteSection;
  }

  // Add optional page context (only if values exist)
  if (params.previousURL) {
    xdmData.web.webPageDetails._adobecmteas.previousURL = params.previousURL;
  }
  if (params.previousPageName) {
    xdmData.web.webPageDetails._adobecmteas.previousPageName = params.previousPageName;
  }
  if (params.previousPagePath) {
    xdmData.web.webPageDetails._adobecmteas.previousPagePath = params.previousPagePath;
  }
  if (params.siteSection2 && params.siteSection2 !== undefined) {
    xdmData.web.webPageDetails._adobecmteas.siteSection2 = params.siteSection2;
  }
  if (params.siteSection3 && params.siteSection3 !== undefined) {
    xdmData.web.webPageDetails._adobecmteas.siteSection3 = params.siteSection3;
  }
  if (params.pageLoadTime !== undefined) {
    xdmData.web.webPageDetails._adobecmteas.pageLoadTime = params.pageLoadTime;
  }

  // Add product list items if provided
  if (params.productListItems && params.productListItems.length > 0 && params.cartSessionId) {
    xdmData.productListItems = formatProductListItems(
      params.productListItems,
      params.cartSessionId
    );
  }

  // Cart Views: include commerce.productListViews so CJA/reports using that metric populate
  if (params.pageType === 'cart') {
    xdmData.commerce = {
      productListViews: {
        value: 1
      }
    };
    xdmData.web.webInteraction._adobecmteas.engagement = { transactionType: 'Upper Funnel' };
  }

  // Category/browse listings: fire commerce.productListViews so AJO journeys that qualify
  // on browse behavior (e.g. "browsed Men's but didn't buy") have a signal to work with (item 6.1).
  if (params.pageType === 'category') {
    xdmData.commerce = {
      productListViews: {
        value: 1
      }
    };
  }

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build checkout event
 * 
 * Creates XDM-compliant checkout event with:
 * - Standard commerce.checkouts field
 * - Lower funnel indicator (reviewOrderPage)
 * - Product list with cart session ID
 * - Interaction engagement tracking
 * 
 * @param params - Checkout parameters
 * @returns XDM event object ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildCheckoutEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   cartSessionId: 'cart-123-abc',
 *   productListItems: cartItems
 * });
 * await Edge.sendEvent(event);
 */
export const buildCheckoutEvent = async (
  params: CheckoutEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Build tenant data
  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };

  // Only add identities if we have data
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'commerce.checkouts',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: tenantData,
    
    environment: buildEnvironment(),  // Device/platform context
    
    commerce: {
      checkouts: {
        value: 1
      },
      _adobecmteas: {
        lowerFunnel: {
          reviewOrderPage: 1
        }
      }
    },
    
    web: {
      webPageDetails: {
        pageViews: { value: 1 },  // For "Checkout Views" metrics in CJA
        server: 'mobileapp',
        name: 'cart',
        URL: '/cart',
        _adobecmteas: {
          pageTitle: 'Shopping Cart',
          pagePath: '/cart',
          pageType: 'cart'
        }
      },
      webInteraction: {
        linkClicks: { value: 0 },
        name: 'shopping cart',
        _adobecmteas: {
          engagement: {
            transactionType: 'Lower Funnel'
          }
        }
      }
    },
    
    productListItems: formatProductListItems(
      params.productListItems,
      params.cartSessionId
    )
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build product list open event (e.g. new shopping cart created).
 * Send when a new cart session is created so "Cart Opens" / productListOpens metrics populate.
 *
 * @param params - Identity and optional cartSessionId
 * @returns ExperienceEvent ready for Edge.sendEvent()
 */
export const buildProductListOpenEvent = async (
  params: ProductListOpenEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const xdmData: any = {
    _id: eventId,
    eventType: 'commerce.productListOpens',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    _adobecmteas: tenantData,
    environment: buildEnvironment(),
    commerce: {
      productListOpens: { value: 1 }
    },
    ...(params.productListItems && params.productListItems.length > 0 && params.cartSessionId
      ? { productListItems: formatProductListItems(params.productListItems, params.cartSessionId) }
      : {}),
    web: {
      webPageDetails: {
        server: 'mobileapp',
        ...(params.pagePath ? { name: makePageName(params.pagePath), URL: params.pagePath } : {}),
        ...(params.pageTitle || params.pagePath || params.pageType
          ? {
              _adobecmteas: {
                ...(params.pageTitle ? { pageTitle: params.pageTitle } : {}),
                ...(params.pagePath ? { pagePath: params.pagePath } : {}),
                ...(params.pageType ? { pageType: params.pageType } : {})
              }
            }
          : {})
      },
      webInteraction: {
        linkClicks: { value: 0 },
        ...(params.pageTitle ? { name: params.pageTitle.toLowerCase() } : {}),
        _adobecmteas: {
          engagement: {
            transactionType: 'Upper Funnel'
          }
        }
      }
    }
  };

  return new ExperienceEvent({ xdmData });
};

/**
 * Build product removal event
 * 
 * Creates XDM-compliant event when user removes items from cart.
 * Tracks which products are removed for abandonment analysis.
 * 
 * @param params - Product removal parameters
 * @returns ExperienceEvent instance ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildProductRemovalEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   cartSessionId: 'cart-123-abc',
 *   productListItems: [removedItem]
 * });
 * await Edge.sendEvent(event);
 */
export const buildProductRemovalEvent = async (
  params: ProductRemovalParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Build tenant data
  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };

  // Only add identities if we have data
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'commerce.productListRemovals',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: tenantData,
    
    environment: buildEnvironment(),  // Device/platform context
    
    commerce: {
      productListRemovals: {
        value: 1  // Required field
      }
    },

    web: {
      webPageDetails: {
        server: 'mobileapp',
        ...(params.pagePath ? { name: makePageName(params.pagePath), URL: params.pagePath } : {}),
        ...(params.pageTitle || params.pagePath || params.pageType
          ? {
              _adobecmteas: {
                ...(params.pageTitle ? { pageTitle: params.pageTitle } : {}),
                ...(params.pagePath ? { pagePath: params.pagePath } : {}),
                ...(params.pageType ? { pageType: params.pageType } : {})
              }
            }
          : {})
      },
      webInteraction: {
        linkClicks: { value: 0 },
        ...(params.pageTitle ? { name: params.pageTitle.toLowerCase() } : {}),
        _adobecmteas: {
          engagement: {
            transactionType: 'Upper Funnel'
          }
        }
      }
    },

    productListItems: formatProductListItems(
      params.productListItems,
      params.cartSessionId
    )
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build purchase event
 * 
 * Creates XDM-compliant event when user completes a purchase.
 * Tracks the final conversion with order details and products purchased.
 * 
 * @param params - Purchase event parameters
 * @returns ExperienceEvent instance ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildPurchaseEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   purchaseID: 'order-12345-abc',
 *   cartSessionId: 'cart-123-abc',
 *   productListItems: cartItems,
 *   priceTotal: 105.00,
 *   currencyCode: 'USD'
 * });
 * await Edge.sendEvent(event);
 */
export const buildPurchaseEvent = async (
  params: PurchaseEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Build tenant data
  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };

  // Only add identities if we have data
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'commerce.purchases',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: tenantData,
    
    environment: buildEnvironment(),  // Device/platform context
    
    commerce: {
      purchases: {
        value: 1  // Required field
      },
      _adobecmteas: {
        lowerFunnel: {
          reviewOrderPage: 1
        }
      },
      order: {
        purchaseID: params.purchaseID,
        priceTotal: params.priceTotal,
        currencyCode: params.currencyCode || 'USD',
        payments: [{ paymentType: 'credit_card' }],
        ...(params.taxAmount !== undefined && params.taxAmount !== null
          ? { taxAmount: params.taxAmount }
          : {})
      },
      ...(params.shippingAmount !== undefined && params.shippingAmount !== null
        ? {
            shipping: {
              shippingAmount: params.shippingAmount
            }
          }
        : {})
    },
    
    web: {
      webPageDetails: {
        server: 'mobileapp',
        name: 'checkout',
        URL: '/checkout',
        _adobecmteas: {
          pageTitle: 'Checkout',
          pagePath: '/checkout',
          pageType: 'checkout'
        }
      },
      webInteraction: {
        linkClicks: { value: 0 },
        name: 'purchase',
        _adobecmteas: {
          engagement: {
            transactionType: 'Lower Funnel'
          }
        }
      }
    },

    productListItems: formatProductListItems(
      params.productListItems,
      params.cartSessionId
    )
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build login event
 * 
 * Creates XDM-compliant login event with:
 * - Authentication status (signInSuccess or signInFailure)
 * - Updated identity fields
 * - Visitor type change (Prospect → Customer)
 * 
 * @param params - Login parameters
 * @returns XDM event object ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildLoginEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   success: true,
 *   method: 'basic'
 * });
 * await Edge.sendEvent(event);
 */
export const buildLoginEvent = async (
  params: LoginEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'mobileApp.navigation.clicks',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: {
      identities,
      authentication: {
        ...(params.registration && params.success && { registrationSuccess: 1 }),
        ...(params.success && !params.registration && { signInSuccess: 1 }),
        ...(!params.success && { signInFailure: 1 }),
        loginStatus: params.success ? 'logged-in' : 'login-failed'
      },
      visitorDetails: {
        visitorType: params.success ? 'Customer' : 'Prospect'
      },
      channelInfo: {
        channel: 'Mobile App',
        participantName: (params.profile?.firstName || 'prospect').toLowerCase()
      }
    },
    
    environment: buildEnvironment(),  // Device/platform context
    
    web: {
      webPageDetails: {
        server: 'mobileapp',
        name: 'profile',
        URL: '/profile',
        _adobecmteas: {
          pageTitle: 'Profile',
          pagePath: '/profile',
          pageType: 'profile'
        }
      },
      webInteraction: {
        linkClicks: {
          value: 1  // Required field for mobileApp.navigation.clicks eventType
        },
        name: 'profile',
        _adobecmteas: {
          engagement: {
            transactionType: 'Authentication'
          }
        }
      }
    }
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build logout event
 * 
 * Creates XDM-compliant logout event with:
 * - Authentication status (loggoffSuccess)
 * - Updated login status (logged_out)
 * - Visitor type change (Customer → Prospect)
 * 
 * @param params - Logout parameters
 * @returns XDM event object ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildLogoutEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John' }
 * });
 * await Edge.sendEvent(event);
 */
export const buildLogoutEvent = async (
  params: LogoutEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'mobileApp.navigation.clicks',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: {
      identities,
      authentication: {
        loggoffSuccess: 1,
        loginStatus: 'logged-out'
      },
      visitorDetails: {
        visitorType: 'Prospect'
      },
      channelInfo: {
        channel: 'Mobile App',
        participantName: params.profile?.firstName || 'prospect'
      }
    },

    environment: buildEnvironment(),  // Device/platform context
    
    web: {
      webPageDetails: {
        server: 'mobileapp',
        name: 'profile',
        URL: '/profile',
        _adobecmteas: {
          pageTitle: 'Profile',
          pagePath: '/profile',
          pageType: 'profile'
        }
      },
      webInteraction: {
        linkClicks: {
          value: 1  // Required field for mobileApp.navigation.clicks eventType
        },
        name: 'profile',
        _adobecmteas: {
          engagement: {
            transactionType: 'Authentication'
          }
        }
      }
    }
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build product view event
 * 
 * Creates XDM-compliant event when user views a product detail page.
 * Tracks product browsing behavior for merchandising analytics.
 * 
 * @param params - Product view parameters
 * @returns ExperienceEvent instance ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildProductViewEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   product: { sku: 'SKU123', name: 'Product Name', price: 99.99, category: 'Men' }
 * });
 * await Edge.sendEvent(event);
 */
export const buildProductViewEvent = async (
  params: ProductViewEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Build tenant data
  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };

  // Only add identities if we have data
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'commerce.productViews',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: tenantData,
    
    environment: buildEnvironment(),  // Device/platform context
    
    commerce: {
      productViews: {
        value: 1  // Required field
      }
    },

    web: {
      webPageDetails: {
        server: 'mobileapp',
        ...(params.pagePath ? { name: makePageName(params.pagePath), URL: params.pagePath } : {}),
        ...(params.pageTitle || params.pagePath || params.pageType
          ? {
              _adobecmteas: {
                ...(params.pageTitle ? { pageTitle: params.pageTitle } : {}),
                ...(params.pagePath ? { pagePath: params.pagePath } : {}),
                ...(params.pageType ? { pageType: params.pageType } : {})
              }
            }
          : {})
      },
      webInteraction: {
        linkClicks: { value: 0 },
        name: params.product.name.toLowerCase(),
        _adobecmteas: {
          engagement: {
            transactionType: 'Upper Funnel'
          }
        }
      }
    },

    productListItems: (() => {
      const categories: { categoryID: string; categoryName: string }[] = [
        { categoryID: 'primaryCategory', categoryName: params.product.category || 'unknown' },
      ];
      if (params.product.secondaryCategory) {
        categories.push({ categoryID: 'secondaryCategory', categoryName: params.product.secondaryCategory });
      }
      return [{
        SKU: params.product.sku,
        name: params.product.name,
        priceTotal: params.product.price,
        quantity: 1,
        productCategories: categories,
        _adobecmteas: {
          products: {
            unitPrice: params.product.price
          }
        }
      }];
    })()
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build product list add event
 * 
 * Creates XDM-compliant event when user adds a product to cart.
 * Tracks add-to-cart actions for conversion funnel analytics.
 * 
 * @param params - Product list add parameters
 * @returns ExperienceEvent instance ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildProductListAddEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John', email: 'john@example.com' },
 *   product: { sku: 'SKU123', name: 'Product Name', price: 99.99, category: 'Men', quantity: 1 },
 *   cartSessionId: 'cart-123-abc'
 * });
 * await Edge.sendEvent(event);
 */
export const buildProductListAddEvent = async (
  params: ProductListAddEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Build tenant data
  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };

  // Only add identities if we have data
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Generate unique event ID (required by ExperienceEvent schema)
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,  // Required field
    eventType: 'commerce.productListAdds',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    
    _adobecmteas: tenantData,
    
    environment: buildEnvironment(),  // Device/platform context
    
    commerce: {
      productListAdds: {
        value: 1  // Required field
      }
    },

    web: {
      webPageDetails: {
        server: 'mobileapp',
        ...(params.pagePath ? { name: makePageName(params.pagePath), URL: params.pagePath } : {}),
        ...(params.pageTitle || params.pagePath || params.pageType
          ? {
              _adobecmteas: {
                ...(params.pageTitle ? { pageTitle: params.pageTitle } : {}),
                ...(params.pagePath ? { pagePath: params.pagePath } : {}),
                ...(params.pageType ? { pageType: params.pageType } : {})
              }
            }
          : {})
      },
      webInteraction: {
        linkClicks: { value: 0 },
        name: params.product.name.toLowerCase(),
        _adobecmteas: {
          engagement: {
            transactionType: 'Upper Funnel'
          }
        }
      }
    },

    productListItems: (() => {
      const categories: { categoryID: string; categoryName: string }[] = [
        { categoryID: 'primaryCategory', categoryName: params.product.category || 'unknown' },
      ];
      if (params.product.secondaryCategory) {
        categories.push({ categoryID: 'secondaryCategory', categoryName: params.product.secondaryCategory });
      }
      return [{
        SKU: params.product.sku,
        name: params.product.name,
        priceTotal: params.product.price,
        quantity: params.product.quantity || 1,
        productCategories: categories,
        _adobecmteas: {
          lowerFunnel: {
            cartID: params.cartSessionId
          },
          products: {
            unitPrice: params.product.price
          }
        }
      }];
    })()
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

/**
 * Build push tracking event
 *
 * Creates a fully-compliant XDM push tracking event that includes
 * the required _adobecmteas tenant block. Replaces the previous
 * inline hand-rolled payload in _layout.tsx which omitted the tenant block.
 */
export const buildPushTrackingEvent = async (
  params: PushTrackingEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,
    eventType: params.interaction === 'opened'
      ? 'pushTracking.applicationOpened'
      : 'pushTracking.customAction',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    _adobecmteas: tenantData,
    environment: buildEnvironment(),
    pushNotificationTracking: {
      pushProvider: params.pushProvider,
      pushProviderMessageID: params.pushProviderMessageID,
      ...(params.interaction === 'customAction' && params.actionID
        ? { customAction: { actionID: params.actionID } }
        : {})
    }
  };

  if (params.correlationID) {
    xdmData._experience = {
      decisioning: {
        propositions: [{
          scopeDetails: {
            correlationID: params.correlationID
          }
        }]
      }
    };
  }

  return new ExperienceEvent({ xdmData });
};

/**
 * Build push registration event.
 *
 * Companion to MobileCore.setPushIdentifier(). setPushIdentifier targets the
 * AJO Push Profile Dataset using Adobe's OOTB push profile schema, which carries
 * only identityMap.ECID — it does NOT include the _adobecmteas tenant block.
 * The davidMobileInteractions schema declares _adobecmteas.identities.ecid as
 * the primary identity descriptor, so without this companion event the
 * registration is invisible to any tenant-scoped journey qualification or
 * profile stitching that depends on the tenant ECID.
 *
 * Fire this from registerTokenWithAdobe immediately after setPushIdentifier
 * succeeds. The token value itself is not echoed into the payload — token
 * storage is owned by AJO via setPushIdentifier; this event exists purely to
 * stamp the registration moment in the tenant dataset with the required
 * identity descriptor satisfied.
 */
export const buildPushRegistrationEvent = async (
  params: PushRegistrationEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,
    eventType: 'pushNotificationDetails',
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    _adobecmteas: tenantData,
    environment: buildEnvironment(),
    pushNotificationTracking: {
      pushProvider: params.pushProvider
    }
  };

  return new ExperienceEvent({ xdmData });
};

// ============================================================================
// PROPOSITION TRACKING (AJO Code-Based Experiences)
// ============================================================================

/**
 * Shared internal builder for both display and interact proposition events.
 *
 * Wraps the partial XDM map returned by Optimize's generateDisplayInteractionXdm
 * / generateTapInteractionXdm (which contains eventType + _experience.decisioning)
 * with the envelope required by the davidMobileInteractions schema: _adobecmteas
 * tenant block (with identities.ecid — the schema's primary identity descriptor),
 * identityMap, timestamp, environment, _id.
 *
 * Without this envelope the streaming validator rejects the event with
 * DCVS-1106-400: required key [_adobecmteas] not found.
 */
const buildPropositionEvent = async (
  params: PropositionTrackingEventParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  const tenantData: any = {
    authentication: {
      loginStatus: params.profile?.firstName ? 'logged-in' : 'not-logged-in'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Prospect'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'prospect').toLowerCase()
    }
  };
  if (identities && Object.keys(identities).length > 0) {
    tenantData.identities = identities;
  }

  // Optimize returns a Map on iOS and a plain object on Android; normalize.
  const partial: any =
    params.generatedXdm && typeof (params.generatedXdm as any).get === 'function'
      ? Object.fromEntries((params.generatedXdm as Map<string, any>).entries())
      : params.generatedXdm || {};

  // Deep-clone the _experience block so we can safely overlay embedded-item tokens
  // and propositionAction.label without mutating the SDK's returned map.
  const experience = partial._experience
    ? JSON.parse(JSON.stringify(partial._experience))
    : { decisioning: { propositions: [] } };

  if (params.embeddedItem && experience?.decisioning?.propositions?.[0]) {
    experience.decisioning.propositions[0].items = [
      { id: params.embeddedItem.id, trackingToken: params.embeddedItem.trackingToken }
    ];
  }

  if (params.interaction && experience?.decisioning) {
    experience.decisioning.propositionAction = { label: params.interaction };
  }

  const eventId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const xdmData: any = {
    _id: eventId,
    eventType: partial.eventType,
    timestamp: new Date().toISOString(),
    identityMap: params.identityMap,
    _adobecmteas: tenantData,
    environment: buildEnvironment(),
    _experience: experience
  };

  return new ExperienceEvent({ xdmData });
};

/**
 * Build proposition display event (decisioning.propositionDisplay).
 *
 * @param params - Partial XDM from offer.generateDisplayInteractionXdm + identity/profile
 * @returns ExperienceEvent ready for Edge.sendEvent()
 *
 * @example
 * const partial = await offer.generateDisplayInteractionXdm(proposition);
 * const event = await buildPropositionDisplayEvent({
 *   generatedXdm: partial,
 *   identityMap: await Identity.getIdentities(),
 *   profile: getProfile(),
 * });
 * await Edge.sendEvent(event);
 */
export const buildPropositionDisplayEvent = async (
  params: PropositionTrackingEventParams
): Promise<any> => {
  return buildPropositionEvent({ ...params, interaction: undefined });
};

/**
 * Build proposition interact event (decisioning.propositionInteract).
 *
 * @param params - Partial XDM from offer.generateTapInteractionXdm + identity/profile + interaction label
 * @returns ExperienceEvent ready for Edge.sendEvent()
 *
 * @example
 * const partial = await offer.generateTapInteractionXdm(proposition);
 * const event = await buildPropositionInteractEvent({
 *   generatedXdm: partial,
 *   identityMap: await Identity.getIdentities(),
 *   profile: getProfile(),
 *   interaction: 'click',
 * });
 * await Edge.sendEvent(event);
 */
export const buildPropositionInteractEvent = async (
  params: PropositionTrackingEventParams
): Promise<any> => {
  return buildPropositionEvent(params);
};

