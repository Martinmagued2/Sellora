import crypto from 'crypto';

const SHOPIFY_TOKEN_SECRET = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || process.env.SHOPIFY_API_SECRET;
const HMAC_SECRET = process.env.SHOPIFY_API_SECRET;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  if (!SHOPIFY_TOKEN_SECRET) {
    throw new Error('Missing SHOPIFY_TOKEN_ENCRYPTION_KEY or SHOPIFY_API_SECRET for token encryption');
  }

  const key = Buffer.from(SHOPIFY_TOKEN_SECRET, 'utf8');
  return crypto.createHash('sha256').update(key).digest();
}

export function verifyShopifyOAuthHmac(urlOrSearchParams, clientSecret = HMAC_SECRET) {
  if (!clientSecret) {
    throw new Error('Missing SHOPIFY_API_SECRET for Shopify HMAC validation');
  }

  const params = typeof urlOrSearchParams === 'string'
    ? new URL(urlOrSearchParams).searchParams
    : urlOrSearchParams instanceof URL
      ? urlOrSearchParams.searchParams
      : urlOrSearchParams;

  const hmac = params.get('hmac') || params.get('signature');
  if (!hmac) return false;

  const message = [...params.entries()]
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const generated = crypto.createHmac('sha256', clientSecret).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(generated, 'hex'), Buffer.from(hmac, 'hex'));
  } catch {
    return false;
  }
}

export function encryptShopifyToken(token) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptShopifyToken(payload) {
  if (!payload) return null;
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split('.');
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted Shopify token format');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
