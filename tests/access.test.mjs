import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccess } from '../server/access.mjs';

function request(cookie = '') {
  return { headers: { cookie }, socket: { remoteAddress: '127.0.0.1' }, secure: false };
}

function cookiePair(setCookie) {
  return setCookie.split(';', 1)[0];
}

test('shared access creates a signed device identity and rejects tampering', () => {
  const access = createAccess({ password: 'shared-password', secret: 'test-signing-secret' });
  assert.equal(access.status(request()), null);
  assert.throws(() => access.unlock(request(), 'wrong-password'), /incorrect/);
  const session = access.unlock(request(), 'shared-password');
  const cookie = cookiePair(session.cookie);
  assert.equal(access.status(request(cookie)).deviceId, session.deviceId);
  assert.equal(access.status(request(`${cookie}x`)), null);
});

test('private settings cookies are encrypted and bound to the server secret', () => {
  const access = createAccess({ password: 'shared-password', secret: 'test-encryption-secret' });
  const req = request();
  const setting = { geminiApiKey: 'test-key-never-log', model: 'gemini-test' };
  const cookie = cookiePair(access.privateCookie(req, 'civinco_ai', setting));
  assert.equal(cookie.includes(setting.geminiApiKey), false);
  assert.deepEqual(access.privateValue(request(cookie), 'civinco_ai'), setting);
  const otherServer = createAccess({ password: 'shared-password', secret: 'different-secret' });
  assert.equal(otherServer.privateValue(request(cookie), 'civinco_ai'), null);
});
