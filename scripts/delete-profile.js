'use strict';
require('dotenv').config();

const { getAdobeAccessToken } = require('./adobe-auth');

const PROFILE_BASE = 'https://platform.adobe.io/data/core/ups/access/entities';
const JOBS_BASE    = 'https://platform.adobe.io/data/core/ups/system/jobs';

function makeHeaders(token, orgId, clientId, sandboxName, extra = {}) {
  return {
    Authorization:     `Bearer ${token}`,
    'x-api-key':       clientId,
    'x-gw-ims-org-id': orgId,
    'x-sandbox-name':  sandboxName,
    ...extra,
  };
}

async function deleteProfile({ token, orgId, clientId, sandboxName, entityId, entityIdNS, maxRetries = 5 }) {
  const params = new URLSearchParams({
    'schema.name': '_xdm.context.profile',
    entityId,
    entityIdNS,
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${PROFILE_BASE}?${params}`, {
      method: 'DELETE',
      headers: makeHeaders(token, orgId, clientId, sandboxName),
    });

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const fromBody   = body?.[0]?.error?.retryAfterMs;
      const fromHeader = Number(res.headers.get('retry-after-millis')) || Number(res.headers.get('retry-after')) * 1000;
      const retryMs    = fromBody || fromHeader || 1000;
      const waitMs = retryMs + 200;
      process.stderr.write(`  429 rate limited — retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...\n`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) throw new Error(`Profile delete ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : { submitted: true };
  }

  throw new Error(`Profile delete still rate-limited after ${maxRetries} retries`);
}

async function getJobStatus({ token, orgId, clientId, sandboxName, jobId }) {
  const res = await fetch(`${JOBS_BASE}/${jobId}`, {
    headers: makeHeaders(token, orgId, clientId, sandboxName),
  });
  if (!res.ok) throw new Error(`Job status ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pollJob({ token, orgId, clientId, sandboxName, jobId, maxWaitMs = 120_000 }) {
  const POLL_MS  = 5_000;
  const deadline = Date.now() + maxWaitMs;
  const terminal = new Set(['succeeded', 'failed', 'aborted', 'error']);

  while (Date.now() < deadline) {
    const job    = await getJobStatus({ token, orgId, clientId, sandboxName, jobId });
    const status = (job.status ?? '').toLowerCase();
    process.stderr.write(`  job status: ${status}\n`);
    if (terminal.has(status)) return job;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`Delete job ${jobId} did not complete within ${maxWaitMs / 1000}s`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const { AEP_ORG_ID, AEP_CLIENT_ID, AEP_SANDBOX_NAME } = process.env;

  if (!AEP_ORG_ID || !AEP_CLIENT_ID) {
    console.error('ERROR: Fill in AEP_ORG_ID and AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  const entityId   = flag('--identity');
  const entityIdNS = flag('--namespace') ?? 'Email';
  const sandbox    = flag('--sandbox')   ?? AEP_SANDBOX_NAME ?? 'prod';
  const noWait     = args.includes('--no-wait');

  if (!entityId) {
    console.error('Usage: node scripts/delete-profile.js --identity <value> [--namespace <ns>] [--sandbox <name>] [--no-wait]');
    process.exit(1);
  }

  (async () => {
    try {
      const auth  = await getAdobeAccessToken();
      const token = auth.access_token;

      console.error(`\nDeleting profile:`);
      console.error(`  sandbox:   ${sandbox}`);
      console.error(`  namespace: ${entityIdNS}`);
      console.error(`  identity:  ${entityId}`);

      const result = await deleteProfile({
        token, orgId: AEP_ORG_ID, clientId: AEP_CLIENT_ID,
        sandboxName: sandbox, entityId, entityIdNS,
      });

      const jobId = result.jobId ?? result.id;

      if (!jobId || noWait) {
        console.error('✓ Delete request submitted.');
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.error(`  jobId: ${jobId}`);
      console.error('Polling for completion (up to 2 min)...');
      const job    = await pollJob({ token, orgId: AEP_ORG_ID, clientId: AEP_CLIENT_ID, sandboxName: sandbox, jobId });
      const status = (job.status ?? '').toLowerCase();
      console.error(`\nDelete job ${status === 'succeeded' ? '✓ succeeded' : '✗ ' + status}`);

      console.log(JSON.stringify({ jobId, status: job.status, entityId, entityIdNS }, null, 2));
    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}
