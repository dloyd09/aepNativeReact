'use strict';
require('dotenv').config();

const crypto = require('crypto');
const { getAdobeAccessToken } = require('./adobe-auth');

const EDGE_BASE = 'https://server.adobedc.net/ee/v2/interact';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function makeHeaders(token, orgId, clientId) {
  return {
    Authorization:     `Bearer ${token}`,
    'x-api-key':       clientId,
    'x-gw-ims-org-id': orgId,
    'Content-Type':    'application/json',
  };
}

function buildIdentityMap({ email, ecid }) {
  const map = {};
  if (email) {
    map.Email = [{ id: email, authenticatedState: 'authenticated', primary: false }];
  }
  if (ecid) {
    map.ECID = [{ id: ecid, authenticatedState: 'ambiguous', primary: true }];
  }
  return map;
}

function buildTenantIdentities({ ecid, email }) {
  const identities = {};
  if (ecid)  identities.ecid         = ecid;
  if (email) identities.emailAddress = email;
  if (email) identities.hashedEmail  = hashEmail(email);
  return identities;
}

// ---------------------------------------------------------------------------
// Event builders — mirror the XDM shapes in src/utils/xdmEventBuilders.ts
// ---------------------------------------------------------------------------

function buildLoginXdm({ firstName, email, ecid, success = true }) {
  const identityMap = buildIdentityMap({ email, ecid });
  const identities  = buildTenantIdentities({ ecid, email });
  const eventId     = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  return {
    _id:         eventId,
    eventType:   'mobileApp.navigation.clicks',
    timestamp:   new Date().toISOString(),
    identityMap,
    _adobecmteas: {
      identities,
      authentication: {
        ...(success ? { signInSuccess: 1 } : { signInFailure: 1 }),
        loginStatus: success ? 'logged-in' : 'login-failed',
      },
      visitorDetails: {
        visitorType: success ? 'Customer' : 'Prospect',
      },
      channelInfo: {
        channel:         'Mobile App',
        participantName: (firstName || 'prospect').toLowerCase(),
      },
    },
    web: {
      webPageDetails: {
        server: 'mobileapp',
        name:   'profile',
        URL:    '/profile',
        _adobecmteas: { pageTitle: 'Profile', pagePath: '/profile', pageType: 'profile' },
      },
      webInteraction: {
        linkClicks: { value: 1 },
        name:       'profile',
        _adobecmteas: { engagement: { transactionType: 'Authentication' } },
      },
    },
  };
}

function buildPageViewXdm({ firstName, email, ecid, pageTitle = 'Home', pagePath = '/home', pageType = 'home' }) {
  const identityMap = buildIdentityMap({ email, ecid });
  const identities  = buildTenantIdentities({ ecid, email });
  const eventId     = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const pageName    = pagePath.replace(/^\//, '').replace(/\//g, ':');

  return {
    _id:         eventId,
    eventType:   'mobileApp.navigation.pageViews',
    timestamp:   new Date().toISOString(),
    identityMap,
    _adobecmteas: {
      identities,
      authentication: {
        loginStatus: firstName ? 'logged-in' : 'not-logged-in',
      },
      visitorDetails: {
        visitorType: firstName ? 'Customer' : 'Prospect',
      },
      channelInfo: {
        channel:         'Mobile App',
        participantName: (firstName || 'prospect').toLowerCase(),
      },
    },
    web: {
      webPageDetails: {
        pageViews: { value: 1 },
        server:    'mobileapp',
        name:      pageName,
        URL:       pagePath,
        _adobecmteas: { pageTitle, pagePath, pageType },
      },
      webInteraction: {
        linkClicks: { value: 0 },
        name:       pageTitle.toLowerCase(),
        _adobecmteas: {},
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Send to Edge Server API
// ---------------------------------------------------------------------------

async function sendEdgeEvent({ token, orgId, clientId, datastreamId, xdm }) {
  const url = `${EDGE_BASE}?dataStreamId=${datastreamId}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: makeHeaders(token, orgId, clientId),
    body:    JSON.stringify({ events: [{ xdm }] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Edge ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const { AEP_ORG_ID, AEP_CLIENT_ID, AEP_DATASTREAM_ID } = process.env;

  if (!AEP_ORG_ID || !AEP_CLIENT_ID) {
    console.error('ERROR: Fill in AEP_ORG_ID and AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  const eventType    = flag('--event')      ?? 'login';
  const email        = flag('--email');
  const firstName    = flag('--firstname');
  const ecid         = flag('--ecid');
  const datastreamId = flag('--datastream') ?? AEP_DATASTREAM_ID;
  const pageTitle    = flag('--page-title') ?? 'Home';
  const pagePath     = flag('--page-path')  ?? '/home';
  const pageType     = flag('--page-type')  ?? 'home';
  const success      = !args.includes('--failure');

  const SUPPORTED = ['login', 'pageview'];

  if (!datastreamId) {
    console.error('ERROR: Provide AEP_DATASTREAM_ID in .env or --datastream <id>');
    process.exit(1);
  }
  if (!SUPPORTED.includes(eventType)) {
    console.error(`ERROR: --event must be one of: ${SUPPORTED.join(', ')}`);
    process.exit(1);
  }
  if (eventType === 'login' && !email) {
    console.error('Usage: node scripts/send-edge-event.js --event login --email <addr> [--firstname <name>] [--ecid <id>] [--datastream <id>] [--failure]');
    process.exit(1);
  }

  (async () => {
    try {
      const auth  = await getAdobeAccessToken();
      const token = auth.access_token;

      let xdm;
      if (eventType === 'login') {
        xdm = buildLoginXdm({ firstName, email, ecid, success });
      } else {
        xdm = buildPageViewXdm({ firstName, email, ecid, pageTitle, pagePath, pageType });
      }

      console.error(`\nSending Edge event:`);
      console.error(`  event:      ${eventType}`);
      console.error(`  email:      ${email ?? '(none)'}`);
      console.error(`  firstName:  ${firstName ?? '(none)'}`);
      console.error(`  ecid:       ${ecid ?? '(none)'}`);
      console.error(`  datastream: ${datastreamId}`);
      if (eventType === 'login') console.error(`  success:    ${success}`);

      const response = await sendEdgeEvent({ token, orgId: AEP_ORG_ID, clientId: AEP_CLIENT_ID, datastreamId, xdm });

      console.error('✓ Event accepted by Edge Network.');
      console.log(JSON.stringify({ sent: xdm, response }, null, 2));
    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}
