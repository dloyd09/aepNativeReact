'use strict';
require('dotenv').config();

const { getAdobeAccessToken } = require('./adobe-auth');

const STREAMING_BASE = 'https://dcs.adobedc.net/collection';
const IMPORT_BASE    = 'https://platform.adobe.io/data/foundation/import';
const CATALOG_BASE   = 'https://platform.adobe.io/data/foundation/catalog';

const DEFAULT_DATASET_ID = '67c75cffc98dac2aee2202aa';
const DEFAULT_SCHEMA_URI = 'https://ns.adobe.com/adobecmteas/schemas/f36a00c278c7b17acc142003ec4ad65e2a4055d1d41ff0d9';

// ---------------------------------------------------------------------------
// Streaming ingestion (default) — lands in seconds
// ---------------------------------------------------------------------------

async function streamRecord({ token, orgId, clientId, inletId, datasetId, schemaUri, record }) {
  const url = `${STREAMING_BASE}/${inletId}?synchronousValidation=true`;

  const payload = {
    header: {
      schemaRef: {
        id:          schemaUri,
        contentType: 'application/vnd.adobe.xed-full+json;version=1',
      },
      imsOrgId:  orgId,
      datasetId,
      source: { name: 'CLI Profile Upsert' },
    },
    body: {
      xdmMeta: {
        schemaRef: {
          id:          schemaUri,
          contentType: 'application/vnd.adobe.xed-full+json;version=1',
        },
      },
      xdmEntity: record,
    },
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'Content-Type':    'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Streaming ingest ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// ---------------------------------------------------------------------------
// Batch ingestion (--batch flag) — use for bulk loads only
// ---------------------------------------------------------------------------

function makeBatchHeaders(token, orgId, clientId, sandboxName, extra = {}) {
  return {
    Authorization:     `Bearer ${token}`,
    'x-api-key':       clientId,
    'x-gw-ims-org-id': orgId,
    'x-sandbox-name':  sandboxName,
    ...extra,
  };
}

async function createBatch(token, orgId, clientId, sandboxName, datasetId) {
  const res = await fetch(`${IMPORT_BASE}/batches`, {
    method:  'POST',
    headers: makeBatchHeaders(token, orgId, clientId, sandboxName, { 'Content-Type': 'application/json' }),
    body:    JSON.stringify({ datasetId, inputFormat: { format: 'json' } }),
  });
  if (!res.ok) throw new Error(`Create batch ${res.status}: ${await res.text()}`);
  return res.json();
}

async function uploadFile(token, orgId, clientId, sandboxName, batchId, datasetId, ndjson) {
  const url = `${IMPORT_BASE}/batches/${batchId}/datasets/${datasetId}/files/profile-upsert.json`;
  const res = await fetch(url, {
    method:  'PUT',
    headers: makeBatchHeaders(token, orgId, clientId, sandboxName, { 'Content-Type': 'application/octet-stream' }),
    body:    Buffer.from(ndjson, 'utf8'),
  });
  if (!res.ok) throw new Error(`Upload file ${res.status}: ${await res.text()}`);
}

async function completeBatch(token, orgId, clientId, sandboxName, batchId) {
  const res = await fetch(`${IMPORT_BASE}/batches/${batchId}?action=COMPLETE`, {
    method:  'POST',
    headers: makeBatchHeaders(token, orgId, clientId, sandboxName),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Complete batch ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function pollBatch(token, orgId, clientId, sandboxName, batchId, maxWaitMs = 300_000) {
  const POLL_MS  = 5_000;
  const deadline = Date.now() + maxWaitMs;
  const terminal = new Set(['success', 'failed', 'aborted']);
  while (Date.now() < deadline) {
    const res    = await fetch(`${CATALOG_BASE}/batches/${batchId}`, { headers: makeBatchHeaders(token, orgId, clientId, sandboxName) });
    if (!res.ok) throw new Error(`Get batch ${res.status}: ${await res.text()}`);
    const body   = await res.json();
    const batch  = body[batchId] ?? Object.values(body)[0] ?? body;
    const status = (batch.status ?? '').toLowerCase();
    process.stderr.write(`  status: ${status}\n`);
    if (terminal.has(status)) return batch;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`Batch ${batchId} did not complete within ${maxWaitMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const { AEP_ORG_ID, AEP_CLIENT_ID, AEP_SANDBOX_NAME, AEP_INLET_ID } = process.env;

  if (!AEP_ORG_ID || AEP_ORG_ID.includes('XXXXXXXX') || !AEP_CLIENT_ID) {
    console.error('ERROR: Fill in AEP_ORG_ID and AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  const useBatch  = args.includes('--batch');
  const sandbox   = flag('--sandbox')   ?? AEP_SANDBOX_NAME ?? 'prod';
  const datasetId = flag('--dataset')   ?? DEFAULT_DATASET_ID;
  const schemaUri = flag('--schema')    ?? DEFAULT_SCHEMA_URI;
  const namespace = flag('--namespace') ?? 'Email';
  const emailValue = flag('--email')?.toLowerCase();
  const firstName  = flag('--firstname');
  const lastName   = flag('--lastname');
  const phone      = flag('--phone');
  const testProfile = !args.includes('--no-test-profile');
  const noWait     = args.includes('--no-wait');
  const inletId    = flag('--inlet') ?? AEP_INLET_ID;

  if (!emailValue) {
    console.error('Usage: node scripts/upsert-profile.js --email <address> [--firstname <name>] [--lastname <name>] [--phone <number>] [--inlet <id>] [--namespace <ns>] [--sandbox <name>] [--dataset <id>] [--batch] [--no-test-profile]');
    process.exit(1);
  }

  if (!useBatch && !inletId) {
    console.error('ERROR: AEP_INLET_ID is required for streaming (default). Add it to .env or pass --inlet <id>.');
    console.error('       Find it: AEP → Sources → HTTP API source → your connection → Streaming endpoint URL (UUID portion).');
    console.error('       To fall back to batch ingestion (slow): add --batch flag.');
    process.exit(1);
  }

  (async () => {
    try {
      const auth  = await getAdobeAccessToken();
      const token = auth.access_token;

      const recordId = `${namespace.toLowerCase()}-${emailValue.replace(/[^a-z0-9]/gi, '-')}`;
      const record = {
        _id: recordId,
        testProfile,
        personalEmail: { address: emailValue },
        ...(firstName || lastName ? { person: { name: { ...(firstName && { firstName }), ...(lastName && { lastName }) } } } : {}),
        ...(phone ? { mobilePhone: { number: phone } } : {}),
      };

      console.error(`\nUpsert target:`);
      console.error(`  mode:        ${useBatch ? 'batch' : 'streaming'}`);
      console.error(`  sandbox:     ${sandbox}`);
      console.error(`  dataset:     ${datasetId}`);
      console.error(`  identity:    ${emailValue}`);
      if (firstName) console.error(`  firstName:   ${firstName}`);
      if (lastName)  console.error(`  lastName:    ${lastName}`);
      if (phone)     console.error(`  phone:       ${phone}`);
      console.error(`  testProfile: ${testProfile}`);
      console.error(`  record._id:  ${recordId}`);

      if (!useBatch) {
        // ── Streaming path ────────────────────────────────────────────────
        console.error('\nStreaming record...');
        const result = await streamRecord({ token, orgId: AEP_ORG_ID, clientId: AEP_CLIENT_ID, inletId, datasetId, schemaUri, record });
        const validation = result.synchronousValidation?.status ?? 'unknown';
        console.error(`✓ Accepted  (validation: ${validation})`);
        console.log(JSON.stringify({ mode: 'streaming', validation, record, response: result }, null, 2));

      } else {
        // ── Batch path (bulk loads only) ───────────────────────────────────
        const ndjson = JSON.stringify(record) + '\n';
        console.error('\nCreating batch...');
        const batch = await createBatch(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId);
        console.error(`  batchId: ${batch.id}`);
        console.error('Uploading record...');
        await uploadFile(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, batch.id, datasetId, ndjson);
        console.error('Completing batch...');
        await completeBatch(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, batch.id);
        if (noWait) {
          console.error('Batch submitted (--no-wait).');
          console.log(JSON.stringify({ mode: 'batch', batchId: batch.id, status: 'submitted', record }, null, 2));
          return;
        }
        console.error('Polling for completion (up to 5 min)...');
        const result = await pollBatch(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, batch.id);
        const status = (result.status ?? '').toLowerCase();
        console.error(`\nBatch ${status === 'success' ? '✓ succeeded' : '✗ ' + status}`);
        if (result.errors?.length) console.error('Errors:', JSON.stringify(result.errors, null, 2));
        console.log(JSON.stringify({ mode: 'batch', batchId: batch.id, status: result.status, record }, null, 2));
      }

    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}
