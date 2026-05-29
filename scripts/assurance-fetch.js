'use strict';
require('dotenv').config();

const ASSURANCE_GQL = 'https://graffias.adobe.io/graffias/graphql';
const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getImsToken(clientId, clientSecret) {
  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid,AdobeID,additional_info.projectedProductContext,assurance_manage_sessions,assurance_read_events,assurance_read_annotations,assurance_read_session_annotations,assurance_read_plugins,assurance_read_clients',
    }).toString(),
  });
  if (!res.ok) throw new Error(`IMS ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Session events (paginated)
// ---------------------------------------------------------------------------

async function fetchPage(token, orgId, clientId, sessionUuid, page, size) {
  const query = `query {
    events(sessionUuid:"${sessionUuid}", _page:${page}, _size:${size}) {
      uuid clientId timestamp vendor type payload
    }
  }`;
  const res = await fetch(ASSURANCE_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gw-ims-org-id': orgId,
      'x-api-key': clientId,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Assurance API ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.errors) throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
  return body.data?.events ?? [];
}

// Fetches the most recent `maxEvents` events. The Assurance API paginates
// NEWEST-first (page 0 = most recent events), so to get the latest events we
// walk pages from the start and stop as soon as we have enough — no need to
// read the entire session. Returned in chronological (oldest-first) order.
async function getSessionEvents(token, orgId, clientId, sessionUuid, maxEvents = 1000) {
  const PAGE_SIZE = 50;
  let collected = [];
  let page = 0;

  while (collected.length < maxEvents) {
    const events = await fetchPage(token, orgId, clientId, sessionUuid, page, PAGE_SIZE);
    collected = collected.concat(events);
    if (events.length < PAGE_SIZE) break; // reached the oldest page
    page++;
  }

  // Keep the newest `maxEvents` (pages are newest-first), then flip to
  // chronological order for natural top-to-bottom reading.
  return collected.slice(0, maxEvents).reverse();
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

function parsePayload(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function filterEdgeEvents(events) {
  return events
    .filter(e => {
      if (e.vendor !== 'com.adobe.griffon.mobile' || e.type !== 'generic') return false;
      const p = parsePayload(e.payload);
      const source = p?.ACPExtensionEventSource ?? '';
      return source.endsWith('requestcontent') && p?.ACPExtensionEventData?.xdm;
    })
    .map(e => {
      const p = parsePayload(e.payload);
      const xdm = p.ACPExtensionEventData.xdm;
      return {
        uuid: e.uuid,
        timestamp: e.timestamp,
        eventName: p.ACPExtensionEventName,
        eventType: xdm.eventType,
        hasTenantData: !!xdm._adobecmteas,
        xdm,
      };
    });
}

// SDK-internal event types that legitimately have no identityMap — not bugs.
const SDK_INTERNAL_EVENT_TYPES = ['personalization.request', 'decisioning.propositionDisplay', 'decisioning.propositionInteract'];

function filterErrorEvents(events) {
  const errors = [];

  for (const e of events) {
    const p = parsePayload(e.payload);
    if (!p) continue;

    const source = (p.ACPExtensionEventSource ?? '').toLowerCase();
    const name   = (p.ACPExtensionEventName   ?? '').toLowerCase();
    const data   = p.ACPExtensionEventData ?? {};
    const ts     = new Date(e.timestamp).toISOString();

    // 1. Edge error-response events (source explicitly signals an error)
    if (source.includes('errorresponsecontent')) {
      errors.push({ ts, category: 'edge-error-response', name: p.ACPExtensionEventName, detail: JSON.stringify(data).slice(0, 300) });
      continue;
    }

    // 2. SDK-level error / warning / failure events by name or source keyword
    if (source.includes('error') || source.includes('warning') ||
        name.includes('error')   || name.includes('warning')   ||
        name.includes('failed')  || name.includes('failure')) {
      errors.push({ ts, category: 'sdk-warning-or-error', name: p.ACPExtensionEventName, source: p.ACPExtensionEventSource, detail: JSON.stringify(data).slice(0, 300) });
      continue;
    }

    // 3. Edge response content — check for errors array or non-2xx status
    if (source.includes('responsecontent')) {
      const status = data.status ?? data.statusCode;
      if (status && Number(status) >= 400) {
        errors.push({ ts, category: 'edge-http-error', name: p.ACPExtensionEventName, status, detail: JSON.stringify(data).slice(0, 300) });
      }
      const responseErrors = data.errors ?? data.Errors;
      if (Array.isArray(responseErrors) && responseErrors.length > 0) {
        errors.push({ ts, category: 'edge-response-errors', name: p.ACPExtensionEventName, errors: responseErrors });
      }
      continue;
    }

    // 4. XDM request events — check for missing ECID and missing tenant block
    if (source.endsWith('requestcontent') && data.xdm) {
      const xdm = data.xdm;
      const eventType = xdm.eventType ?? '';

      const ecid = xdm?.identityMap?.ECID;
      const missingEcid = !ecid || !Array.isArray(ecid) || ecid.length === 0;
      if (missingEcid && !SDK_INTERNAL_EVENT_TYPES.includes(eventType)) {
        errors.push({ ts, category: 'missing-ecid', eventType, detail: 'identityMap.ECID absent on app-fired event' });
      }

      if (!xdm._adobecmteas && !SDK_INTERNAL_EVENT_TYPES.includes(eventType)) {
        errors.push({ ts, category: 'missing-tenant-block', eventType, detail: '_adobecmteas tenant block absent' });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  const sessionUuid = flag('--session');
  const outFile = flag('--out');
  const listSessions = args.includes('--list-sessions');

  const { AEP_ORG_ID, AEP_CLIENT_ID, AEP_CLIENT_SECRET, AEP_ACCESS_TOKEN } = process.env;
  const manualToken = flag('--token');

  if (!AEP_ORG_ID || !AEP_CLIENT_ID ||
      AEP_ORG_ID.includes('XXXXXXXX')) {
    console.error('ERROR: Fill in AEP_ORG_ID, AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  if (!sessionUuid && !listSessions) {
    console.error('Usage:');
    console.error('  node scripts/assurance-fetch.js --session <uuid> [--out events.json]');
    console.error('  node scripts/assurance-fetch.js --list-sessions');
    console.error('  node scripts/assurance-fetch.js --list-sessions --token <user-access-token>');
    console.error('  Set AEP_ACCESS_TOKEN in .env to skip S2S auth (use a user token from Developer Console)');
    process.exit(1);
  }

  (async () => {
    try {
      // User token takes precedence over S2S — Assurance sessions are user-scoped.
      // Generate one at: developer.adobe.com/console → your project → OAuth S2S → Generate access token
      let token = manualToken || AEP_ACCESS_TOKEN;
      if (token) {
        process.stderr.write('Using supplied user access token.\n');
      } else {
        if (!AEP_CLIENT_SECRET || AEP_CLIENT_SECRET.includes('your-')) {
          console.error('ERROR: AEP_CLIENT_SECRET missing. Either set it in .env or supply --token <user-access-token>');
          process.exit(1);
        }
        process.stderr.write('Authenticating with IMS (S2S)...\n');
        token = await getImsToken(AEP_CLIENT_ID, AEP_CLIENT_SECRET);
      }

      if (listSessions) {
        const query = `query { sessions { uuid name link token } }`;
        const res = await fetch(ASSURANCE_GQL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gw-ims-org-id': AEP_ORG_ID,
            'x-api-key': AEP_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query }),
        });
        const body = await res.json();
        process.stdout.write(JSON.stringify(body.data?.sessions ?? [], null, 2));
        return;
      }

      const maxEventsArg = flag('--max-events');
      const maxEvents = maxEventsArg ? parseInt(maxEventsArg, 10) : 1000;
      const fromArg = flag('--from'); // ISO timestamp or epoch ms, e.g. "2026-05-22T17:00:00Z"
      const toArg   = flag('--to');
      const errorsOnly = args.includes('--errors-only');

      process.stderr.write(`Fetching events for session ${sessionUuid}...\n`);
      let allEvents = await getSessionEvents(token, AEP_ORG_ID, AEP_CLIENT_ID, sessionUuid, maxEvents);

      // Apply time window if requested
      if (fromArg || toArg) {
        const fromMs = fromArg ? new Date(fromArg).getTime() : 0;
        const toMs   = toArg   ? new Date(toArg).getTime()   : Infinity;
        allEvents = allEvents.filter(e => e.timestamp >= fromMs && e.timestamp <= toMs);
        process.stderr.write(`Time window: ${fromArg ?? 'start'} → ${toArg ?? 'now'}\n`);
      }

      process.stderr.write(`Total events: ${allEvents.length}\n`);

      if (errorsOnly) {
        const errors = filterErrorEvents(allEvents);
        const timestamps = allEvents.map(e => e.timestamp).sort((a, b) => a - b);
        const firstTs = timestamps.length ? new Date(timestamps[0]).toISOString() : 'n/a';
        const lastTs  = timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : 'n/a';
        process.stderr.write(`Session window: ${firstTs} → ${lastTs}\n`);
        process.stderr.write(`Errors/warnings found: ${errors.length}\n`);
        process.stdout.write(JSON.stringify({ sessionUuid, window: { from: firstTs, to: lastTs }, errorCount: errors.length, errors }, null, 2));
        return;
      }

      const edgeEvents = filterEdgeEvents(allEvents);
      process.stderr.write(`Edge/XDM events: ${edgeEvents.length}\n`);

      const result = {
        sessionUuid,
        totalEvents: allEvents.length,
        edgeEventCount: edgeEvents.length,
        allEvents: allEvents.map(e => ({ ...e, payload: parsePayload(e.payload) })),
        edgeEvents,
      };

      const out = JSON.stringify(result, null, 2);
      if (outFile) {
        require('fs').writeFileSync(outFile, out);
        process.stderr.write(`Written to ${outFile}\n`);
      } else {
        process.stdout.write(out);
      }
    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { getImsToken, getSessionEvents, filterEdgeEvents, filterErrorEvents, parsePayload };
