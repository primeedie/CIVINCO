const trimSlash = value => String(value || '').replace(/\/+$/, '');

export function createCloudPersistence({ url = '', secretKey = '', bucket = 'civinco-private' } = {}) {
  const base = trimSlash(url), key = secretKey.trim();
  const enabled = Boolean(base && key);
  const headers = extra => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });
  const objectUrl = name => `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`;
  let snapshot = null, timer = null, saving = Promise.resolve(), dirty = false;

  async function request(url, options = {}, allowed = []) {
    const response = await fetch(url, { ...options, headers: headers(options.headers || {}) });
    if (!response.ok && !allowed.includes(response.status)) throw new Error(`Supabase storage request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    return response;
  }
  async function ensureBucket() {
    if (!enabled) return;
    const existing = await request(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {}, [404]);
    if (existing.status !== 404) return;
    await request(`${base}/storage/v1/bucket`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 104857600 }) });
  }
  async function put(name, bytes, contentType = 'application/octet-stream') {
    if (!enabled) return;
    await request(objectUrl(name), { method: 'POST', headers: { 'Content-Type': contentType, 'x-upsert': 'true' }, body: bytes });
  }
  async function get(name) {
    if (!enabled) return null;
    const response = await request(objectUrl(name), {}, [404]);
    return response.status === 404 ? null : Buffer.from(await response.arrayBuffer());
  }
  async function remove(names) {
    if (!enabled || !names.length) return;
    await request(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: names }) });
  }
  async function loadRecords() {
    if (!enabled) return null;
    await ensureBucket();
    const bytes = await get('_system/records.json');
    if (!bytes) return null;
    const parsed = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(parsed)) throw new Error('The Supabase CIVINCO state file is invalid.');
    return parsed;
  }
  async function saveRecords(records) {
    if (!enabled) return;
    await put('_system/records.json', Buffer.from(JSON.stringify(records)), 'application/json');
  }
  function connect(getSnapshot) { snapshot = getSnapshot; }
  function schedule() {
    if (!enabled || !snapshot) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => { void flush().catch(error => console.error(`Supabase persistence failed: ${error.message}`)); }, 120);
  }
  async function flush() {
    if (!enabled || !snapshot) return;
    clearTimeout(timer); timer = null;
    if (!dirty) return saving;
    dirty = false;
    const records = snapshot();
    saving = saving.catch(() => {}).then(() => saveRecords(records));
    await saving;
    if (dirty) return flush();
  }
  return { enabled, bucket, ensureBucket, putAsset: (name, bytes, type) => put(`assets/${name}`, bytes, type), getAsset: name => get(`assets/${name}`), removeAssets: names => remove(names.map(name => `assets/${name}`)), loadRecords, saveRecords, connect, schedule, flush };
}
