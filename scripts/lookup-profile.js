'use strict';
require('dotenv').config();

const { getAdobeAccessToken } = require('./adobe-auth');

const PROFILE_BASE = 'https://platform.adobe.io/data/core/ups/access/entities';

function makeHeaders(token, orgId, clientId, sandboxName) {
  return {
    Authorization:     `Bearer ${token}`,
    'x-api-key':       clientId,
    'x-gw-ims-org-id': orgId,
    'x-sandbox-name':  sandboxName,
  };
}

async function lookupProfile({ token, orgId, clientId, sandboxName, entityId, entityIdNS, fields }) {
  const params = new URLSearchParams({
    'schema.name': '_xdm.context.profile',
    entityId,
    entityIdNS,
  });
  if (fields) params.set('fields', fields);

  const res = await fetch(`${PROFILE_BASE}?${params}`, {
    headers: makeHeaders(token, orgId, clientId, sandboxName),
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Profile lookup ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = { lookupProfile };

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const { AEP_ORG_ID, AEP_CLIENT_ID, AEP_SANDBOX_NAME } = process.env;

  if (!AEP_ORG_ID || !AEP_CLIENT_ID) {
    console.error('ERROR: Fill in AEP_ORG_ID and AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  const entityId  = flag('--identity');
  const entityIdNS = flag('--namespace') ?? 'Email';
  const sandbox   = flag('--sandbox')   ?? AEP_SANDBOX_NAME ?? 'prod';
  const fields    = flag('--fields');   // e.g. "person,personalEmail,identityMap"

  if (!entityId) {
    console.error('Usage: node scripts/lookup-profile.js --identity <value> [--namespace <ns>] [--sandbox <name>] [--fields <comma-list>]');
    process.exit(1);
  }

  (async () => {
    try {
      const auth  = await getAdobeAccessToken();
      const token = auth.access_token;

      console.error(`\nLooking up profile:`);
      console.error(`  sandbox:   ${sandbox}`);
      console.error(`  namespace: ${entityIdNS}`);
      console.error(`  identity:  ${entityId}`);
      if (fields) console.error(`  fields:    ${fields}`);

      const profile = await lookupProfile({
        token, orgId: AEP_ORG_ID, clientId: AEP_CLIENT_ID,
        sandboxName: sandbox, entityId, entityIdNS, fields,
      });

      if (!profile) {
        console.error('Profile not found.');
        console.log(JSON.stringify({ found: false, entityId, entityIdNS }, null, 2));
        process.exit(0);
      }

      console.error('✓ Profile found.');
      console.log(JSON.stringify({ found: true, profile }, null, 2));
    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}
