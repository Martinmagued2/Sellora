import crypto from 'crypto';

export function verifyMetaSignature(reqText, signatureHeader, appSecret) {
  if (!appSecret) {
    console.error("CRITICAL: Webhook signature verification skipped because APP_SECRET is missing. Rejecting request for security.");
    return false; // Reject if not configured — never bypass in production
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
