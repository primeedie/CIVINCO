import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../server/store.mjs';
import { createCloudPersistence } from '../server/cloud.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.CIVINCO_DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
const cloud = createCloudPersistence({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.SUPABASE_BUCKET || 'civinco-private' });
if (!cloud.enabled) throw new Error('Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env first.');

const mime = name => ({ '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/markdown' })[path.extname(name).toLowerCase()] || 'application/octet-stream';
await cloud.ensureBucket();
const files = await readdir(uploadDir).catch(() => []);
let uploaded = 0;
for (const name of files) {
  await cloud.putAsset(name, await readFile(path.join(uploadDir, name)), mime(name));
  uploaded++;
  if (uploaded % 25 === 0 || uploaded === files.length) console.log(`Uploaded ${uploaded}/${files.length} source assets.`);
}
const store = createStore(dataDir);
const records = store.snapshot();
await cloud.saveRecords(records);
store.close();
console.log(`Migration complete: ${records.length} records and ${files.length} assets are stored in the private Supabase bucket.`);
