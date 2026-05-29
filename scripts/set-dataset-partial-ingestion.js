'use strict';
require('dotenv').config();

const { getAdobeAccessToken } = require('./adobe-auth');
const CATALOG_BASE  = 'https://platform.adobe.io/data/foundation/catalog';
const FLOWSVC_BASE  = 'https://platform.adobe.io/data/foundation/flowservice';

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

async function getDataset(token, orgId, clientId, sandboxName, datasetId) {
  const res = await fetch(`${CATALOG_BASE}/datasets/${datasetId}`, {
    headers: {
      Authorization:      `Bearer ${token}`,
      'x-api-key':        clientId,
      'x-gw-ims-org-id':  orgId,
      'x-sandbox-name':   sandboxName,
    },
  });
  if (!res.ok) throw new Error(`GET dataset ${res.status}: ${await res.text()}`);
  return res.json();
}

async function patchDataset(token, orgId, clientId, sandboxName, datasetId, body) {
  const res = await fetch(`${CATALOG_BASE}/datasets/${datasetId}`, {
    method: 'PATCH',
    headers: {
      Authorization:      `Bearer ${token}`,
      'x-api-key':        clientId,
      'x-gw-ims-org-id':  orgId,
      'x-sandbox-name':   sandboxName,
      'Content-Type':     'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH dataset ${res.status}: ${text}`);
  return text; // Catalog PATCH returns the dataset ID string on success
}

// ---------------------------------------------------------------------------
// Flow Service helpers
// ---------------------------------------------------------------------------

async function getFlow(token, orgId, clientId, sandboxName, flowId) {
  const res = await fetch(`${FLOWSVC_BASE}/flows/${flowId}`, {
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'x-sandbox-name':  sandboxName,
    },
  });
  if (!res.ok) throw new Error(`GET flow ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const flow = data.items?.[0] ?? data;
  return { flow, etag: flow.etag };
}

async function patchFlow(token, orgId, clientId, sandboxName, flowId, etag, ops) {
  const res = await fetch(`${FLOWSVC_BASE}/flows/${flowId}`, {
    method: 'PATCH',
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'x-sandbox-name':  sandboxName,
      'Content-Type':    'application/json',
      'If-Match':        etag,
    },
    body: JSON.stringify(ops),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH flow ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const flowMode   = args.includes('--flow');
  const datasetId  = flag('--dataset') ?? '6a10e771784875326a9c1dc9';
  const flowId     = flag('--flow-id') ?? '884f7519-e137-4799-8e46-b9e7bbdc9c8f';
  const limitArg   = flag('--limit')   ?? '80';
  const rejectLimit = parseInt(limitArg, 10);
  const dryRun     = args.includes('--dry-run');

  if (isNaN(rejectLimit) || rejectLimit < 0 || rejectLimit > 100) {
    console.error('ERROR: --limit must be a number 0–100');
    process.exit(1);
  }

  const {
    AEP_ORG_ID, AEP_CLIENT_ID, AEP_CLIENT_SECRET,
    AEP_ACCESS_TOKEN, AEP_SANDBOX_NAME,
  } = process.env;

  if (!AEP_ORG_ID || AEP_ORG_ID.includes('XXXXXXXX') || !AEP_CLIENT_ID) {
    console.error('ERROR: Fill in AEP_ORG_ID and AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  const sandbox    = AEP_SANDBOX_NAME ?? 'prod';
  const manualToken = flag('--token');

  (async () => {
    try {
      if (manualToken) process.env.AEP_ACCESS_TOKEN = manualToken;
      const auth = await getAdobeAccessToken();
      const token = auth.access_token;

      if (flowMode) {
        // --- Flow Service (streaming dataflow) ---
        console.error(`\nFetching flow ${flowId} (sandbox: ${sandbox})...`);
        const { flow, etag } = await getFlow(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, flowId);
        console.error(`  Name:  ${flow.name}`);
        console.error(`  State: ${flow.state}`);
        console.error(`  partialIngestionEnabled:    ${flow.partialIngestionEnabled ?? '(not set)'}`);
        console.error(`  partialIngestionPercentage: ${flow.partialIngestionPercentage ?? '(not set)'}`);
        console.error(`  errorDiagnosticsEnabled:    ${flow.errorDiagnosticsEnabled ?? '(not set)'}`);

        const ops = [
          { op: 'add', path: '/partialIngestionEnabled',    value: true },
          { op: 'add', path: '/errorDiagnosticsEnabled',    value: true },
          { op: 'add', path: '/partialIngestionPercentage', value: rejectLimit },
        ];

        if (dryRun) {
          console.error('\n[DRY RUN] Would PATCH flow with:');
          console.error(JSON.stringify(ops, null, 2));
          console.error('Re-run without --dry-run to apply.');
          return;
        }

        console.error(`\nPatching flow → partialIngestionPercentage: ${rejectLimit}%...`);
        const result = await patchFlow(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, flowId, etag, ops);
        console.error(`Success. New etag: ${result.etag}`);
        console.log(JSON.stringify({ flowId, partialIngestionPercentage: rejectLimit, errorDiagnosticsEnabled: true }, null, 2));

      } else {
        // --- Catalog Service (dataset / batch ingestion) ---
        console.error(`\nFetching dataset ${datasetId} (sandbox: ${sandbox})...`);
        const current = await getDataset(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId);
        const ds = current[datasetId] ?? Object.values(current)[0];
        console.error(`  Name:              ${ds?.name ?? '(unknown)'}`);
        console.error(`  Current rejectLimit: ${ds?.rejectLimit ?? '(not set)'}`);
        console.error(`  enableErrorDiagnostics: ${ds?.enableErrorDiagnostics ?? '(not set)'}`);

        const existingTags = ds?.tags ?? {};
        const patch = {
          enableErrorDiagnostics: true,
          tags: {
            ...existingTags,
            acp_validationContext: ['enabled'],
            acp_rejectLimit: [String(rejectLimit)],
          },
        };

        if (dryRun) {
          console.error('\n[DRY RUN] Would PATCH dataset with:');
          console.error(JSON.stringify(patch, null, 2));
          console.error('Re-run without --dry-run to apply.');
          return;
        }

        console.error(`\nPatching rejectLimit → ${rejectLimit}%...`);
        const result = await patchDataset(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId, patch);
        console.error(`Success. Response: ${result}`);

        console.error('\nVerifying...');
        const updated = await getDataset(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId);
        const ds2 = updated[datasetId] ?? Object.values(updated)[0];
        const confirmedLimit = ds2?.tags?.acp_rejectLimit?.[0];
        console.error(`  acp_rejectLimit tag:     ${confirmedLimit}`);
        console.error(`  enableErrorDiagnostics:  ${ds2?.enableErrorDiagnostics}`);
        console.log(JSON.stringify({ datasetId, acp_rejectLimit: confirmedLimit, enableErrorDiagnostics: ds2?.enableErrorDiagnostics }, null, 2));
      }
    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}
