import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../server/store.mjs';
import { createCloudPersistence } from '../server/cloud.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.CIVINCO_DATA_DIR || path.join(root, 'data'));
const cloud = createCloudPersistence({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.SUPABASE_BUCKET || 'civinco-private' });
if (!cloud.enabled) throw new Error('Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env first.');

const localStore = createStore(dataDir);
const local = localStore.snapshot();
localStore.close();
const remote = await cloud.loadRecords();
if (!remote) throw new Error('The configured Supabase project has no CIVINCO records snapshot.');

const parsed = record => typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
const psadDocumentIds = records => new Set(records.filter(record => record.collection === 'documents').map(record => parsed(record)).filter(value => value.spex === 'A' && !value.ownerId).map(value => value.id));
const localDocIds = psadDocumentIds(local), remoteDocIds = psadDocumentIds(remote);
const isGlobalPsad = (record, documentIds) => {
  const value = parsed(record);
  if (record.collection === 'pages') return documentIds.has(value.docId);
  return ['documents', 'items', 'questions'].includes(record.collection) && value.spex === 'A' && !value.ownerId;
};
const psad = local.filter(record => isGlobalPsad(record, localDocIds));
const preserved = remote.filter(record => !isGlobalPsad(record, remoteDocIds));
const merged = [...preserved, ...psad].sort((a, b) => a.collection.localeCompare(b.collection) || parsed(a).id.localeCompare(parsed(b).id));
await cloud.saveRecords(merged);
console.log(`Synced ${psad.length} public PSAD records to Supabase while preserving ${preserved.length} non-PSAD and device-private records. No source assets were uploaded.`);
