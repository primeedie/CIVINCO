import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createCloudPersistence } from '../server/cloud.mjs';

test('Supabase persistence creates a private bucket and round-trips state and assets', async () => {
  const objects = new Map(); let bucket = false;
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk); const body = Buffer.concat(chunks);
    assert.equal(req.headers.apikey, 'test-secret'); assert.equal(req.headers.authorization, 'Bearer test-secret');
    if (req.url === '/storage/v1/bucket/civinco-private' && req.method === 'GET') { res.writeHead(bucket ? 200 : 404); return res.end(bucket ? '{}' : 'missing'); }
    if (req.url === '/storage/v1/bucket' && req.method === 'POST') { const input = JSON.parse(body); assert.equal(input.public, false); bucket = true; res.writeHead(200); return res.end('{}'); }
    if (req.url === '/storage/v1/object/civinco-private' && req.method === 'DELETE') { for (const name of JSON.parse(body).prefixes) objects.delete(name); res.writeHead(200); return res.end('[]'); }
    const prefix = '/storage/v1/object/civinco-private/';
    if (req.url.startsWith(prefix)) {
      const name = req.url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
      if (req.method === 'POST') { objects.set(name, body); res.writeHead(200); return res.end('{}'); }
      if (req.method === 'GET') { if (!objects.has(name)) { res.writeHead(404); return res.end('missing'); } res.writeHead(200); return res.end(objects.get(name)); }
    }
    res.writeHead(500); res.end('unexpected request');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const cloud = createCloudPersistence({ url: `http://127.0.0.1:${server.address().port}`, secretKey: 'test-secret' });
    assert.equal(await cloud.loadRecords(), null);
    await cloud.putAsset('diagram one.png', Buffer.from('image'), 'image/png');
    assert.equal((await cloud.getAsset('diagram one.png')).toString(), 'image');
    const records = [{ collection: 'documents', value: JSON.stringify({ id: 'one' }) }];
    await cloud.saveRecords(records);
    assert.deepEqual(await cloud.loadRecords(), records);
    await cloud.removeAssets(['diagram one.png']);
    assert.equal(await cloud.getAsset('diagram one.png'), null);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
