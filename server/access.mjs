import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const COOKIE = 'civinco_device';
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function cookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const separator = part.indexOf('=');
    return separator < 0 ? [part, ''] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function constantEqual(left, right) {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAccess({ password, secret, production = false }) {
  const enabled = Boolean(password);
  const signingSecret = secret || randomUUID();
  const encryptionKey = createHash('sha256').update(signingSecret).digest();
  const attempts = new Map();
  const sign = value => createHmac('sha256', signingSecret).update(value).digest('base64url');
  const tokenFor = deviceId => {
    const expires = Math.floor(Date.now() / 1000) + THIRTY_DAYS;
    const value = `${deviceId}.${expires}`;
    return `${value}.${sign(value)}`;
  };
  const read = req => {
    if (!enabled) return { deviceId: 'local-owner', expires: Number.MAX_SAFE_INTEGER };
    const token = cookies(req.headers.cookie)[COOKIE];
    if (!token) return null;
    const [deviceId, expiresText, signature] = token.split('.');
    const value = `${deviceId}.${expiresText}`, expires = Number(expiresText);
    if (!deviceId || !signature || !Number.isFinite(expires) || expires < Date.now() / 1000 || !constantEqual(signature, sign(value))) return null;
    return { deviceId, expires };
  };
  const cookie = (req, value, maxAge = THIRTY_DAYS) => {
    const secure = production || req.secure || req.headers['x-forwarded-proto'] === 'https';
    return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  };
  const namedCookie = (req, name, value, maxAge = THIRTY_DAYS) => cookie(req, value, maxAge).replace(`${COOKIE}=`, `${name}=`);
  const seal = value => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  };
  const unseal = value => {
    try {
      const [iv, tag, encrypted] = String(value || '').split('.').map(part => Buffer.from(part, 'base64url'));
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv); decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
    } catch { return null; }
  };
  const clientKey = req => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const blocked = req => {
    const key = clientKey(req), now = Date.now(), entry = attempts.get(key);
    if (!entry || entry.until < now) { attempts.delete(key); return false; }
    return entry.count >= 8;
  };
  const fail = req => {
    const key = clientKey(req), now = Date.now(), current = attempts.get(key);
    attempts.set(key, !current || current.until < now ? { count: 1, until: now + 10 * 60_000 } : { ...current, count: current.count + 1 });
  };
  return {
    enabled,
    status(req) { return read(req); },
    unlock(req, suppliedPassword) {
      if (!enabled) return { deviceId: 'local-owner', cookie: null };
      if (blocked(req)) throw Object.assign(new Error('Too many attempts. Wait ten minutes and try again.'), { status: 429 });
      if (!constantEqual(suppliedPassword, password)) { fail(req); throw Object.assign(new Error('That access password is incorrect.'), { status: 401 }); }
      attempts.delete(clientKey(req));
      const existing = read(req), deviceId = existing?.deviceId || randomUUID();
      return { deviceId, cookie: cookie(req, tokenFor(deviceId)) };
    },
    clearCookie(req) { return cookie(req, '', 0); },
    privateValue(req, name) { return unseal(cookies(req.headers.cookie)[name]); },
    privateCookie(req, name, value, maxAge = THIRTY_DAYS) { return namedCookie(req, name, seal(value), maxAge); },
    clearPrivateCookie(req, name) { return namedCookie(req, name, '', 0); },
    middleware(req, res, next) {
      const session = read(req);
      if (!session) return res.status(401).json({ error: 'Enter the CIVINCO access password to continue.', locked: true });
      req.deviceId = session.deviceId;
      next();
    },
  };
}
