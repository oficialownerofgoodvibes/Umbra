// Base32 RFC 4648 decode
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodeBase32(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) {
      continue;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

// Generate random Base32 secret (20 characters = 100 bits)
export function generateBase32Secret(length = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE32_CHARS[bytes[i] % BASE32_CHARS.length];
  }
  return result;
}

// RFC 6238 TOTP computation (HMAC-SHA-1, 30s, 6 digits)
export async function computeTOTP(secretBase32: string, nowMs = Date.now()): Promise<string> {
  const keyBytes = decodeBase32(secretBase32);
  if (keyBytes.length === 0) {
    return '------';
  }

  const stepSeconds = 30;
  const counter = Math.floor(nowMs / 1000 / stepSeconds);

  // 8-byte big-endian counter buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(counter / 0x100000000));
  counterView.setUint32(4, counter & 0xffffffff);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as ArrayBufferView,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hash = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function getTotpRemainingSeconds(nowMs = Date.now()): { seconds: number; progress: number } {
  const currentSeconds = Math.floor(nowMs / 1000) % 30;
  const seconds = 30 - currentSeconds;
  const progress = seconds / 30;
  return { seconds, progress };
}
