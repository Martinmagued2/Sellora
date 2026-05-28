import crypto from 'crypto';

export function verifyMetaSignature(reqText, signatureHeader, appSecret) {
  if (!appSecret) {
    console.warn("WARNING: Webhook signature verification bypassed because APP_SECRET is missing.");
    return true; // Bypass if not configured, though highly discouraged in production
  }
  
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const signature = signatureHeader.substring(7);
  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(reqText)
    .digest('hex');

  return signature === expectedHash;
}
