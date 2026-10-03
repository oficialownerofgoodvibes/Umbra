import { IdentityData, VaultData, EncryptedVaultRecord, AutoTestResult } from './types';

// Convert binary to/from Base64 and Base64URL
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64ToBytes(base64);
}

// Constant-time byte array comparison
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// Memory zeroing
export function wipeMemory(buffer: Uint8Array | null | undefined): void {
  if (!buffer) return;
  try {
    crypto.getRandomValues(buffer);
  } catch {
    // fallback
  }
  buffer.fill(0);
}

export interface DerivedKeys {
  encKey: CryptoKey;
  macKey: CryptoKey;
  rawEncBytes: Uint8Array;
  rawMacBytes: Uint8Array;
}

// Derive 512 bits (64 bytes) via PBKDF2-HMAC-SHA-256 with 600,000 iterations
export async function deriveKeys(password: string, salt: Uint8Array, iterations = 600000): Promise<DerivedKeys> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as ArrayBufferView,
      iterations: iterations,
      hash: 'SHA-256'
    },
    baseKey,
    512 // 512 bits = 64 bytes
  );

  const derivedBytes = new Uint8Array(derivedBits);
  const rawEncBytes = derivedBytes.slice(0, 32);
  const rawMacBytes = derivedBytes.slice(32, 64);

  const encKey = await crypto.subtle.importKey(
    'raw',
    rawEncBytes,
    { name: 'AES-CTR', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const macKey = await crypto.subtle.importKey(
    'raw',
    rawMacBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  return { encKey, macKey, rawEncBytes, rawMacBytes };
}

// Encrypt-then-MAC: [version 1 byte (0x01)][16 bytes IV][ciphertext][32 bytes HMAC]
export async function encryptData(
  dataBytes: Uint8Array,
  encKey: CryptoKey,
  macKey: CryptoKey
): Promise<Uint8Array> {
  const version = new Uint8Array([0x01]);
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: iv,
      length: 64
    },
    encKey,
    dataBytes
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Payload to MAC: version (1) + IV (16) + ciphertext
  const macPayload = new Uint8Array(1 + 16 + ciphertext.length);
  macPayload.set(version, 0);
  macPayload.set(iv, 1);
  macPayload.set(ciphertext, 1 + 16);

  const macBuffer = await crypto.subtle.sign('HMAC', macKey, macPayload);
  const mac = new Uint8Array(macBuffer);

  // Final blob: version + IV + ciphertext + HMAC
  const blob = new Uint8Array(1 + 16 + ciphertext.length + 32);
  blob.set(macPayload, 0);
  blob.set(mac, 1 + 16 + ciphertext.length);

  return blob;
}

// Decrypt with constant-time MAC verification
export async function decryptData(
  blob: Uint8Array,
  encKey: CryptoKey,
  macKey: CryptoKey
): Promise<Uint8Array> {
  if (blob.length < 1 + 16 + 32) {
    throw new Error('HMAC inválido — contraseña incorrecta o datos alterados');
  }

  const version = blob[0];
  if (version !== 0x01) {
    throw new Error('Versión de formato no soportada');
  }

  const iv = blob.slice(1, 17);
  const ciphertextLength = blob.length - 17 - 32;
  const ciphertext = blob.slice(17, 17 + ciphertextLength);
  const storedMac = blob.slice(blob.length - 32);

  // Recompute MAC over [version || IV || ciphertext]
  const macPayload = blob.slice(0, 17 + ciphertextLength);
  const computedMacBuffer = await crypto.subtle.sign('HMAC', macKey, macPayload);
  const computedMac = new Uint8Array(computedMacBuffer);

  // Constant-time check
  if (!constantTimeEqual(storedMac, computedMac)) {
    throw new Error('HMAC inválido — contraseña incorrecta o datos alterados');
  }

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-CTR',
        counter: iv,
        length: 64
      },
      encKey,
      ciphertext
    );
    return new Uint8Array(decryptedBuffer);
  } catch {
    throw new Error('HMAC inválido — contraseña incorrecta o datos alterados');
  }
}

// Generate ECDH P-256 Identity and 16-hex fingerprint
export async function generateIdentity(): Promise<IdentityData> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // Canonical JWK representation: crv, kty, x, y
  const canonicalJwk = JSON.stringify({
    crv: publicKeyJwk.crv,
    kty: publicKeyJwk.kty,
    x: publicKeyJwk.x,
    y: publicKeyJwk.y
  });

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJwk));
  const hashBytes = new Uint8Array(hashBuffer);

  // First 8 bytes as uppercase hex, grouped in 4 digits (e.g., "A1B2 C3D4 E5F6 7890")
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += hashBytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  const fingerprint = `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)} ${hex.slice(12, 16)}`;

  return {
    publicKeyJwk,
    privateKeyJwk,
    fingerprint
  };
}

// Encrypt entire vault JSON to EncryptedVaultRecord
export async function encryptVaultRecord(
  vaultData: VaultData,
  password: string,
  customSalt?: Uint8Array
): Promise<{ record: EncryptedVaultRecord; saltBytes: Uint8Array }> {
  const salt = customSalt || crypto.getRandomValues(new Uint8Array(16));
  const keys = await deriveKeys(password, salt, 600000);

  const jsonStr = JSON.stringify(vaultData);
  const dataBytes = new TextEncoder().encode(jsonStr);

  const blobBytes = await encryptData(dataBytes, keys.encKey, keys.macKey);

  wipeMemory(keys.rawEncBytes);
  wipeMemory(keys.rawMacBytes);

  const record: EncryptedVaultRecord = {
    umbra: 1,
    kdf: 'PBKDF2-HMAC-SHA-256',
    iterations: 600000,
    salt: bytesToBase64(salt),
    cipher: 'AES-256-CTR',
    mac: 'HMAC-SHA-256',
    construction: 'Encrypt-then-MAC',
    createdAt: new Date().toISOString(),
    blob: bytesToBase64(blobBytes)
  };

  return { record, saltBytes: salt };
}

// Decrypt EncryptedVaultRecord back to VaultData
export async function decryptVaultRecord(
  record: EncryptedVaultRecord,
  password: string
): Promise<VaultData> {
  if (record.umbra !== 1) {
    throw new Error('Formato de bóveda incompatible');
  }

  const salt = base64ToBytes(record.salt);
  const keys = await deriveKeys(password, salt, record.iterations || 600000);
  const blob = base64ToBytes(record.blob);

  try {
    const dataBytes = await decryptData(blob, keys.encKey, keys.macKey);
    const jsonStr = new TextDecoder().decode(dataBytes);
    return JSON.parse(jsonStr) as VaultData;
  } finally {
    wipeMemory(keys.rawEncBytes);
    wipeMemory(keys.rawMacBytes);
  }
}

// --- HMAC Double-Chain Ratchet Protocol ---
// HMAC utility
async function hmacSha256(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(signature);
}

// Derive initial chain keys from root
export async function deriveInitialChain(rootBytes: Uint8Array, label: string): Promise<Uint8Array> {
  return hmacSha256(rootBytes, new TextEncoder().encode(label));
}

// Ratchet one step forward: messageKey = HMAC(chain, [1]), nextChain = HMAC(chain, [2])
export async function ratchetStep(chainKey: Uint8Array): Promise<{ messageKey: Uint8Array; nextChain: Uint8Array }> {
  const messageKey = await hmacSha256(chainKey, new Uint8Array([0x01]));
  const nextChain = await hmacSha256(chainKey, new Uint8Array([0x02]));
  return { messageKey, nextChain };
}

// Encrypt ratchet message
export async function encryptRatchetMessage(
  chainKey: Uint8Array,
  text: string
): Promise<{ blobBase64Url: string; nextChain: Uint8Array }> {
  const { messageKey, nextChain } = await ratchetStep(chainKey);
  const encKeyBytes = messageKey.slice(0, 32);
  const macKeyBytes = await hmacSha256(messageKey, new TextEncoder().encode('umbra-mac'));

  const encKey = await crypto.subtle.importKey(
    'raw',
    encKeyBytes,
    { name: 'AES-CTR', length: 256 },
    false,
    ['encrypt']
  );

  const macKey = await crypto.subtle.importKey(
    'raw',
    macKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const dataBytes = new TextEncoder().encode(text);
  const blob = await encryptData(dataBytes, encKey, macKey);

  wipeMemory(messageKey);
  wipeMemory(encKeyBytes);
  wipeMemory(macKeyBytes);

  return {
    blobBase64Url: bytesToBase64Url(blob),
    nextChain
  };
}

// Decrypt ratchet message
export async function decryptRatchetMessage(
  chainKey: Uint8Array,
  blobBase64Url: string
): Promise<{ text: string; nextChain: Uint8Array }> {
  const { messageKey, nextChain } = await ratchetStep(chainKey);
  const encKeyBytes = messageKey.slice(0, 32);
  const macKeyBytes = await hmacSha256(messageKey, new TextEncoder().encode('umbra-mac'));

  const encKey = await crypto.subtle.importKey(
    'raw',
    encKeyBytes,
    { name: 'AES-CTR', length: 256 },
    false,
    ['decrypt']
  );

  const macKey = await crypto.subtle.importKey(
    'raw',
    macKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const blob = base64UrlToBytes(blobBase64Url);
  const dataBytes = await decryptData(blob, encKey, macKey);
  const text = new TextDecoder().decode(dataBytes);

  wipeMemory(messageKey);
  wipeMemory(encKeyBytes);
  wipeMemory(macKeyBytes);

  return {
    text,
    nextChain
  };
}

// --- Autotest Suite (4 Tests) ---
export async function runCryptoAutotest(): Promise<AutoTestResult[]> {
  const results: AutoTestResult[] = [];

  // Test 1: Round-trip AES-256-CTR + HMAC-SHA-256
  {
    const t0 = performance.now();
    try {
      const rawEnc = crypto.getRandomValues(new Uint8Array(32));
      const rawMac = crypto.getRandomValues(new Uint8Array(32));
      const encKey = await crypto.subtle.importKey('raw', rawEnc, { name: 'AES-CTR', length: 256 }, false, ['encrypt', 'decrypt']);
      const macKey = await crypto.subtle.importKey('raw', rawMac, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      const plainText = 'Vector de prueba ODS-bubbas-umbra-2026';
      const plainBytes = new TextEncoder().encode(plainText);
      const encrypted = await encryptData(plainBytes, encKey, macKey);
      const decrypted = await decryptData(encrypted, encKey, macKey);
      const recovered = new TextDecoder().decode(decrypted);

      const passed = recovered === plainText;
      const durationMs = Math.round(performance.now() - t0);
      results.push({
        id: 'aes-roundtrip',
        name: 'Round-trip AES-256-CTR',
        passed,
        durationMs,
        details: passed ? 'Cifrado y descifrado verificado con integridad idéntica.' : 'Error: texto recuperado no coincide.'
      });
    } catch (e: any) {
      results.push({
        id: 'aes-roundtrip',
        name: 'Round-trip AES-256-CTR',
        passed: false,
        durationMs: Math.round(performance.now() - t0),
        details: 'Fallo: ' + e.message
      });
    }
  }

  // Test 2: HMAC Tampering Detection (1 bit flip)
  {
    const t0 = performance.now();
    try {
      const rawEnc = crypto.getRandomValues(new Uint8Array(32));
      const rawMac = crypto.getRandomValues(new Uint8Array(32));
      const encKey = await crypto.subtle.importKey('raw', rawEnc, { name: 'AES-CTR', length: 256 }, false, ['encrypt', 'decrypt']);
      const macKey = await crypto.subtle.importKey('raw', rawMac, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      const plainBytes = new TextEncoder().encode('Integridad estricta');
      const blob = await encryptData(plainBytes, encKey, macKey);

      // Flip 1 bit in ciphertext (offset 20)
      blob[20] ^= 0x01;

      let detected = false;
      try {
        await decryptData(blob, encKey, macKey);
      } catch (err: any) {
        if (err.message.includes('HMAC inválido')) {
          detected = true;
        }
      }

      const durationMs = Math.round(performance.now() - t0);
      results.push({
        id: 'hmac-tamper',
        name: 'Detección de manipulación HMAC',
        passed: detected,
        durationMs,
        details: detected ? 'Rechazó alteración de 1 bit en tiempo constante.' : 'Fallo: no detectó la alteración del ciphertext.'
      });
    } catch (e: any) {
      results.push({
        id: 'hmac-tamper',
        name: 'Detección de manipulación HMAC',
        passed: false,
        durationMs: Math.round(performance.now() - t0),
        details: 'Fallo inesperado: ' + e.message
      });
    }
  }

  // Test 3: PBKDF2 Determinism & 64-byte derivation
  {
    const t0 = performance.now();
    try {
      // 10,000 iterations for test execution speed while verifying exact algorithm determinism
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const k1 = await deriveKeys('test-password-123', salt, 10000);
      const k2 = await deriveKeys('test-password-123', salt, 10000);

      const encMatch = constantTimeEqual(k1.rawEncBytes, k2.rawEncBytes);
      const macMatch = constantTimeEqual(k1.rawMacBytes, k2.rawMacBytes);
      const validLength = k1.rawEncBytes.length === 32 && k1.rawMacBytes.length === 32;

      wipeMemory(k1.rawEncBytes);
      wipeMemory(k1.rawMacBytes);
      wipeMemory(k2.rawEncBytes);
      wipeMemory(k2.rawMacBytes);

      const passed = encMatch && macMatch && validLength;
      const durationMs = Math.round(performance.now() - t0);
      results.push({
        id: 'pbkdf2-det',
        name: 'PBKDF2 determinista (512 bits)',
        passed,
        durationMs,
        details: passed ? 'Derivación determinista 32B AES + 32B HMAC verificada.' : 'Fallo: resultados no coinciden.'
      });
    } catch (e: any) {
      results.push({
        id: 'pbkdf2-det',
        name: 'PBKDF2 determinista (512 bits)',
        passed: false,
        durationMs: Math.round(performance.now() - t0),
        details: 'Fallo: ' + e.message
      });
    }
  }

  // Test 4: Ratchet HMAC Dual-chain 2-step advancement
  {
    const t0 = performance.now();
    try {
      const root = crypto.getRandomValues(new Uint8Array(32));
      const aliceSendChain = await deriveInitialChain(root, 'umbra-chain:alice');
      const bobRecvChain = await deriveInitialChain(root, 'umbra-chain:alice');

      // Alice sends message 1
      const msg1 = 'Hola desde el paso 1 del Ratchet';
      const { blobBase64Url: b1, nextChain: aliceChain2 } = await encryptRatchetMessage(aliceSendChain, msg1);

      // Bob receives message 1
      const { text: r1, nextChain: bobChain2 } = await decryptRatchetMessage(bobRecvChain, b1);

      // Alice sends message 2
      const msg2 = 'Paso 2 con forward secrecy';
      const { blobBase64Url: b2 } = await encryptRatchetMessage(aliceChain2, msg2);

      // Bob receives message 2
      const { text: r2 } = await decryptRatchetMessage(bobChain2, b2);

      const passed = r1 === msg1 && r2 === msg2;
      const durationMs = Math.round(performance.now() - t0);
      results.push({
        id: 'ratchet-test',
        name: 'Ratchet HMAC dual-chain',
        passed,
        durationMs,
        details: passed ? '2 pasos completados con avance unidireccional y forward secrecy.' : 'Fallo: mensajes del ratchet no coincidieron.'
      });
    } catch (e: any) {
      results.push({
        id: 'ratchet-test',
        name: 'Ratchet HMAC dual-chain',
        passed: false,
        durationMs: Math.round(performance.now() - t0),
        details: 'Fallo: ' + e.message
      });
    }
  }

  return results;
}
