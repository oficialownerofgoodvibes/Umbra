export type TabType = 'messages' | 'passwords' | 'notes' | 'stealth';

export interface IdentityData {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  fingerprint: string; // 16 hex chars grouped by 4: "XXXX XXXX XXXX XXXX"
}

export interface MessageItem {
  id: string;
  seq: number;
  sender: 'me' | 'peer';
  text: string;
  createdAt: number; // epoch ms
  expiresAt: number | null; // epoch ms or null
}

export interface SharedState {
  rootKeyBase64: string;
  myRole: 'alice' | 'bob';
  sendChainBase64: string;
  recvChainBase64: string;
  nextSendSeq: number;
  lastRecvSeq: number;
}

export interface Conversation {
  id: string;
  name: string;
  isShared: boolean;
  sharedState?: SharedState;
  messages: MessageItem[];
  createdAt: number;
  updatedAt: number;
}

export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  totpSecret: string;
  notes: string;
  updatedAt: number;
}

export interface NoteEntry {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface VaultSettings {
  idleMs: number; // e.g., 300000 (5 mins)
  createdAt: string;
}

export interface VaultData {
  version: number; // 1
  displayName: string;
  identity: IdentityData;
  conversations: Conversation[];
  passwords: PasswordEntry[];
  notes: NoteEntry[];
  settings: VaultSettings;
  updatedAt: string;
}

export interface EncryptedVaultRecord {
  umbra: number; // 1
  kdf: 'PBKDF2-HMAC-SHA-256';
  iterations: number; // 600000
  salt: string; // base64
  cipher: 'AES-256-CTR';
  mac: 'HMAC-SHA-256';
  construction: 'Encrypt-then-MAC';
  createdAt: string;
  blob: string; // base64
}

export interface AutoTestResult {
  id: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}
