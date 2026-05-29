'use strict';
require('dotenv').config();

const { getAdobeAccessToken } = require('./adobe-auth');

const SCHEMA_REGISTRY_BASE = 'https://platform.adobe.io/data/foundation/schemaregistry';
const CATALOG_BASE         = 'https://platform.adobe.io/data/foundation/catalog';

const DEFAULT_SCHEMA_URI =
  'https://ns.adobe.com/adobecmteas/schemas/f36a00c278c7b17acc142003ec4ad65e2a4055d1d41ff0d9';

// ---------------------------------------------------------------------------
// Schema Registry
// ---------------------------------------------------------------------------

async function getSchema(token, orgId, clientId, sandboxName, schemaUri) {
  const encoded = encodeURIComponent(schemaUri);
  const res = await fetch(`${SCHEMA_REGISTRY_BASE}/tenant/schemas/${encoded}`, {
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'x-sandbox-name':  sandboxName,
      Accept:            'application/vnd.adobe.xed-full+json; version=1',
    },
  });
  if (!res.ok) throw new Error(`GET schema ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Catalog — datasets using this schema / specific dataset
// ---------------------------------------------------------------------------

async function getDatasetsForSchema(token, orgId, clientId, sandboxName, schemaUri) {
  const encoded = encodeURIComponent(schemaUri);
  const url = `${CATALOG_BASE}/dataSets?schemaRef.id=${encoded}&properties=name,schemaRef,unifiedProfile&limit=20`;
  const res = await fetch(url, {
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'x-sandbox-name':  sandboxName,
    },
  });
  if (!res.ok) throw new Error(`GET datasets ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getDataset(token, orgId, clientId, sandboxName, datasetId) {
  const res = await fetch(`${CATALOG_BASE}/dataSets/${datasetId}`, {
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'x-sandbox-name':  sandboxName,
    },
  });
  if (!res.ok) throw new Error(`GET dataset ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body[datasetId] ?? Object.values(body)[0];
}

async function patchDataset(token, orgId, clientId, sandboxName, datasetId, patch) {
  const res = await fetch(`${CATALOG_BASE}/dataSets/${datasetId}`, {
    method: 'PATCH',
    headers: {
      Authorization:     `Bearer ${token}`,
      'x-api-key':       clientId,
      'x-gw-ims-org-id': orgId,
      'x-sandbox-name':  sandboxName,
      'Content-Type':    'application/json',
    },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH dataset ${res.status}: ${text}`);
  return text;
}

// Read the tags-array style unifiedProfile (e.g. ["enabled:true", "enabledAt:..."])
// and report whether isUpsert is present.
function parseTagsProfile(ds) {
  const tagArr = ds?.tags?.unifiedProfile ?? [];
  return {
    enabled:   tagArr.some(t => t.startsWith('enabled:true')),
    isUpsert:  tagArr.some(t => t.startsWith('isUpsert:true')),
    raw:       tagArr,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args  = process.argv.slice(2);
  const flag  = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

  const { AEP_ORG_ID, AEP_CLIENT_ID, AEP_SANDBOX_NAME } = process.env;

  if (!AEP_ORG_ID || AEP_ORG_ID.includes('XXXXXXXX') || !AEP_CLIENT_ID) {
    console.error('ERROR: Fill in AEP_ORG_ID and AEP_CLIENT_ID in .env');
    process.exit(1);
  }

  const sandbox      = flag('--sandbox')  ?? AEP_SANDBOX_NAME ?? 'prod';
  const schemaUri    = flag('--schema')   ?? DEFAULT_SCHEMA_URI;
  const datasetId    = flag('--dataset');
  const enableUpsert = args.includes('--enable-upsert');
  const dryRun       = args.includes('--dry-run');
  const manualToken  = flag('--token');

  (async () => {
    try {
      if (manualToken) process.env.AEP_ACCESS_TOKEN = manualToken;
      const auth  = await getAdobeAccessToken();
      const token = auth.access_token;

      // ── Mode: --dataset  (targeted single-dataset check / upsert enable) ──
      if (datasetId) {
        console.error(`\nFetching dataset ${datasetId} (sandbox: ${sandbox})...`);
        const ds     = await getDataset(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId);
        const profile = parseTagsProfile(ds);

        console.error(`\n── Dataset ───────────────────────────────────────────`);
        console.error(`  name:                    ${ds.name}`);
        console.error(`  unifiedProfile.enabled:  ${profile.enabled}`);
        console.error(`  unifiedProfile.isUpsert: ${profile.isUpsert}`);
        console.error(`  raw tags:                [${profile.raw.join(', ')}]`);

        if (enableUpsert) {
          if (profile.isUpsert) {
            console.error('\nisUpsert:true is already set — nothing to do.');
            process.exit(0);
          }

          const updatedTags = [...profile.raw.filter(t => !t.startsWith('isUpsert:')), 'isUpsert:true'];
          const patch = { tags: { ...ds.tags, unifiedProfile: updatedTags } };

          if (dryRun) {
            console.error('\n[DRY RUN] Would PATCH dataset with:');
            console.error(JSON.stringify(patch, null, 2));
            console.error('Re-run without --dry-run to apply.');
            process.exit(0);
          }

          console.error(`\nPatching dataset → isUpsert:true...`);
          await patchDataset(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId, patch);

          console.error('Verifying...');
          const updated  = await getDataset(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, datasetId);
          const verified = parseTagsProfile(updated);
          console.error(`  isUpsert after patch: ${verified.isUpsert}`);

          console.log(JSON.stringify({ datasetId, name: updated.name, isUpsert: verified.isUpsert, tags: verified.raw }, null, 2));
        } else {
          console.log(JSON.stringify({ datasetId, name: ds.name, profileEnabled: profile.enabled, isUpsert: profile.isUpsert, tags: profile.raw }, null, 2));
        }
        return;
      }

      // ── Mode: schema-wide scan ─────────────────────────────────────────────
      console.error(`\nFetching schema (sandbox: ${sandbox})...`);
      console.error(`  URI: ${schemaUri}`);

      const schema         = await getSchema(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, schemaUri);
      const immutableTags  = schema['meta:immutableTags'] ?? [];
      const profileEnabled = immutableTags.includes('union');

      console.error(`\n── Schema ────────────────────────────────────────────`);
      console.error(`  title:               ${schema.title ?? '(none)'}`);
      console.error(`  meta:immutableTags:  [${immutableTags.join(', ')}]`);
      console.error(`  Profile enabled:     ${profileEnabled}`);

      console.error(`\nFetching datasets for this schema...`);
      const datasets = await getDatasetsForSchema(token, AEP_ORG_ID, AEP_CLIENT_ID, sandbox, schemaUri);
      const entries  = Object.entries(datasets);

      console.error(`\n── Datasets (${entries.length} found) ────────────────────────────`);

      const datasetResults = entries.map(([id, ds]) => {
        const profile = parseTagsProfile(ds);
        console.error(`  ${ds.name ?? id}`);
        console.error(`    id:                       ${id}`);
        console.error(`    unifiedProfile.enabled:   ${profile.enabled}`);
        console.error(`    unifiedProfile.isUpsert:  ${profile.isUpsert}`);
        return { id, name: ds.name, profileEnabled: profile.enabled, isUpsert: profile.isUpsert };
      });

      if (entries.length === 0) console.error('  (no datasets found — check sandbox name)');

      console.error('\n── Summary ───────────────────────────────────────────');
      console.error(`  Schema profile (union): ${profileEnabled ? 'YES' : 'NO'}`);
      const upsertDatasets = datasetResults.filter(d => d.isUpsert);
      if (upsertDatasets.length) {
        console.error(`  Upsert-enabled datasets: ${upsertDatasets.map(d => d.name ?? d.id).join(', ')}`);
      } else {
        console.error('  Upsert-enabled datasets: NONE');
      }

      console.log(JSON.stringify({ schemaUri, sandbox, schemaTitle: schema.title, profileEnabled, immutableTags, datasets: datasetResults }, null, 2));

    } catch (err) {
      console.error('ERROR:', err.message);
      process.exit(1);
    }
  })();
}
