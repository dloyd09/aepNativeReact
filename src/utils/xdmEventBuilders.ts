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
}

interface PurchaseEventParams extends BaseEventParams {
  purchaseID: string;
  cartSessionId: string;
  productListItems: any[];
  priceTotal: number;
  currencyCode?: string;
}

interface ProductInteractionParams extends BaseEventParams {
  transactionType: 'add_to_cart' | 'remove_from_cart' | 'update_cart_quantity_increase' | 'update_cart_quantity_decrease';
  productListItems: any[];
  cartSessionId?: string;
}

interface LoginEventParams extends BaseEventParams {
  success: boolean;
  method?: string;
}

interface LogoutEventParams extends BaseEventParams {
}

interface ProductViewEventParams extends BaseEventParams {
  product: {
    sku: string;
    name: string;
    price: number;
    category?: string;
  };
}

interface ProductListAddEventParams extends BaseEventParams {
  product: {
    sku: string;
    name: string;
    price: number;
    category?: string;
    quantity?: number;
  };
  cartSessionId: string;
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
  return items.map(item => ({
    SKU: item.sku || 'unknown',
    name: item.name || item.title || 'Unnamed Product',
    quantity: item.quantity || 1,
    priceTotal: (item.price || 0) * (item.quantity || 1),
    _adobecmteas: {
      lowerFunnel: {
        cartID: cartSessionId
      },
      products: {
        unitPrice: item.price || 0
      }
    }
  }));
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
      loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Guest'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'guest user').toLowerCase()
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
        _adobecmteas: {
          pageTitle: params.pageTitle,
          pagePath: params.pagePath,
          pageType: params.pageType,
          language: 'en-US'
        }
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

  // Add product list items if provided
  if (params.productListItems && params.productListItems.length > 0 && params.cartSessionId) {
    xdmData.productListItems = formatProductListItems(
      params.productListItems,
      params.cartSessionId
    );
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
      loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'guest user').toLowerCase()
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
        _adobecmteas: {
          pageTitle: 'Shopping Cart',
          pagePath: '/cart',
          pageType: 'cart'
        }
      },
      webInteraction: {
        _adobecmteas: {
          engagement: {
            transactionType: 'checkout'
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
      loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Guest'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'guest user').toLowerCase()
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
      loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Guest'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'guest user').toLowerCase()
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
      order: {
        purchaseID: params.purchaseID,
        priceTotal: params.priceTotal,
        currencyCode: params.currencyCode || 'USD'
      }
    },
    
    web: {
      webInteraction: {
        _adobecmteas: {
          engagement: {
            transactionType: 'purchase'
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
 * Build product interaction event
 * 
 * Creates XDM-compliant event for cart interactions:
 * - Add to cart
 * - Remove from cart
 * - Update quantity (increase/decrease)
 * 
 * @param params - Product interaction parameters
 * @returns XDM event object ready for Edge.sendEvent()
 * 
 * @example
 * const event = await buildProductInteractionEvent({
 *   identityMap: await Identity.getIdentities(),
 *   profile: { firstName: 'John' },
 *   transactionType: 'remove_from_cart',
 *   productListItems: [removedItem],
 *   cartSessionId: 'cart-123-abc'
 * });
 * await Edge.sendEvent(event);
 */
export const buildProductInteractionEvent = async (
  params: ProductInteractionParams
): Promise<any> => {
  const ecid = extractECID(params.identityMap);
  const identities = await buildTenantIdentities({
    ecid,
    email: params.profile?.email,
    phone: params.profile?.phone
  });

  // Determine eventType based on transaction type
  let eventType = 'commerce.productListUpdates';
  const commerceField: any = {};
  
  if (params.transactionType === 'remove_from_cart') {
    eventType = 'commerce.productListRemovals';
    commerceField.productListRemovals = { value: 1 };
  } else {
    commerceField.productListUpdates = { value: 1 };
  }

  const event: any = {
    xdm: {
      eventType,
      timestamp: new Date().toISOString(),
      identityMap: params.identityMap,
      
      _adobecmteas: {
        identities,
        authentication: {
          loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
        },
        channelInfo: {
          channel: 'Mobile App'
        }
      },
      
      commerce: commerceField,
      
      web: {
        webInteraction: {
          _adobecmteas: {
            engagement: {
              transactionType: params.transactionType
            }
          }
        }
      },
      
      productListItems: params.cartSessionId 
        ? formatProductListItems(params.productListItems, params.cartSessionId)
        : params.productListItems
    }
  };

  return event;
};

/**
 * Build login event
 * 
 * Creates XDM-compliant login event with:
 * - Authentication status (signInSuccess or signInFailure)
 * - Updated identity fields
 * - Visitor type change (Guest → Customer)
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
        ...(params.success && { signInSuccess: 1 }),
        ...(!params.success && { signInFailure: 1 }),
        loginStatus: params.success ? 'logged-in' : 'login-failed'
      },
      visitorDetails: {
        visitorType: params.success ? 'Customer' : 'Guest'
      },
      channelInfo: {
        channel: 'Mobile App',
        participantName: (params.profile?.firstName || 'guest user').toLowerCase()
      }
    },
    
    environment: buildEnvironment(),  // Device/platform context
    
    web: {
      webPageDetails: {
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
        _adobecmteas: {
          engagement: {
            transactionType: params.success ? 'login_success' : 'login_failure'
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
 * - Visitor type change (Customer → Guest)
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
        visitorType: 'Guest'
      },
      channelInfo: {
        channel: 'Mobile App',
        participantName: 'guest user'
      }
    },
    
    environment: buildEnvironment(),  // Device/platform context
    
    web: {
      webPageDetails: {
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
        _adobecmteas: {
          engagement: {
            transactionType: 'logout'
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
      loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Guest'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'guest user').toLowerCase()
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
    
    productListItems: [
      {
        SKU: params.product.sku,
        name: params.product.name,
        priceTotal: params.product.price,
        quantity: 1,
        _adobecmteas: {
          products: {
            unitPrice: params.product.price
          }
        }
      }
    ]
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
      loginStatus: params.profile?.firstName ? 'logged-in' : 'guest'
    },
    visitorDetails: {
      visitorType: params.profile?.firstName ? 'Customer' : 'Guest'
    },
    channelInfo: {
      channel: 'Mobile App',
      participantName: (params.profile?.firstName || 'guest user').toLowerCase()
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
      webInteraction: {
        _adobecmteas: {
          engagement: {
            transactionType: 'add_to_cart'
          }
        }
      }
    },
    
    productListItems: [
      {
        SKU: params.product.sku,
        name: params.product.name,
        priceTotal: params.product.price,
        quantity: params.product.quantity || 1,
        _adobecmteas: {
          lowerFunnel: {
            cartID: params.cartSessionId
          },
          products: {
            unitPrice: params.product.price
          }
        }
      }
    ]
  };

  // Return ExperienceEvent instance (required by Adobe SDK)
  return new ExperienceEvent({ xdmData });
};

