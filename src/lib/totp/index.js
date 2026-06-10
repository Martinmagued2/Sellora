/**
 * TOTP (Time-based One-Time Password) utility
 * Implements TOTP verification using Node.js built-in crypto module.
 * No external dependencies required.
 */

import crypto from 'crypto';

/**
 * Base32 decode - converts a base32 string to a Buffer
 * TOTP secrets are typically encoded in Base32
 */
function base32Decode(str) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  str = str.replace(/[\s=-]+/g, "").toUpperCase();
  
  let bits = "";
  for (let i = 0; i < str.length; i++) {
    const val = alphabet.indexOf(str[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  
  return Buffer.from(bytes);
}

/**
 * Base32 encode - converts a Buffer to a base32 string
 */
function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, "0");
  }
  
  let result = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += alphabet[parseInt(bits.substring(i, i + 5), 2)];
  }
  
  // Add padding
  while (result.length % 8 !== 0) {
    result += "=";
  }
  
  return result;
}

/**
 * Generate a random TOTP secret
 * @param {number} length - Number of random bytes (default 20 = 160 bits)
 * @returns {string} Base32-encoded secret
 */
function generateSecret(length = 20) {
  const bytes = crypto.randomBytes(length);
  return base32Encode(bytes);
}

/**
 * Calculate TOTP code for a given secret and time
 * @param {string} secret - Base32-encoded secret
 * @param {number} timeStep - Time step counter (default: current time / 30)
 * @returns {string} 6-digit TOTP code
 */
function calculateTOTP(secret, timeStep) {
  const key = base32Decode(secret);
  
  // Time step as 8-byte big-endian buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
  timeBuffer.writeUInt32BE(timeStep & 0xffffffff, 4);
  
  // HMAC-SHA1
  const hmac = crypto.createHmac("sha1", key);
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, "0");
}

/**
 * Verify a TOTP code against a secret
 * Allows ±1 time window (±30 seconds) for clock skew
 * @param {string} secret - Base32-encoded secret
 * @param {string} code - 6-digit code to verify
 * @param {number} window - Number of time windows to check (default 1 = ±30 seconds)
 * @returns {boolean} Whether the code is valid
 */
function verifyTOTP(secret, code, window = 1) {
  if (!secret || !code) return false;
  
  const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
  
  for (let i = -window; i <= window; i++) {
    const testStep = currentTimeStep + i;
    const testCode = calculateTOTP(secret, testStep);
    if (testCode === code) return true;
  }
  
  return false;
}

/**
 * Generate backup codes for 2FA recovery
 * @param {number} count - Number of codes to generate (default 8)
 * @returns {string[]} Array of backup codes
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    // Format as XXXX-XXXX
    codes.push(code.slice(0, 4) + "-" + code.slice(4));
  }
  return codes;
}

/**
 * Build the otpauth:// URL for QR code generation
 * @param {string} secret - Base32-encoded secret
 * @param {string} email - User email for display
 * @param {string} issuer - Issuer name (default "Sellora")
 * @returns {string} otpauth:// URL
 */
function buildOtpauthUrl(secret, email, issuer = "Sellora") {
  const params = new URLSearchParams({
    secret: secret,
    issuer: issuer,
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params.toString()}`;
}

export {
  generateSecret,
  verifyTOTP,
  calculateTOTP,
  generateBackupCodes,
  buildOtpauthUrl,
  base32Encode,
  base32Decode,
};
