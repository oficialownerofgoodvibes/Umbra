import { EncryptedVaultRecord } from './types';

const DB_NAME = 'umbra';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const VAULT_KEY = 'vault';
const LOCAL_STORAGE_KEY = 'umbra-vault-v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveEncryptedVault(record: EncryptedVaultRecord): Promise<void> {
  // 1. Save to IndexedDB
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record, VAULT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Fallo al guardar en IndexedDB, usando localStorage:', err);
  }

  // 2. Backup to localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    console.warn('Fallo al respaldar en localStorage:', err);
  }
}

export async function loadEncryptedVault(): Promise<EncryptedVaultRecord | null> {
  // Try IndexedDB first
  try {
    const db = await openDb();
    const record = await new Promise<EncryptedVaultRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(VAULT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (record) {
      return record;
    }
  } catch (err) {
    console.warn('Fallo al leer IndexedDB, intentando localStorage:', err);
  }

  // Try localStorage fallback
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as EncryptedVaultRecord;
      if (parsed && parsed.umbra === 1) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Fallo al leer localStorage:', err);
  }

  return null;
}

export async function clearVaultStorage(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(VAULT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error al limpiar IndexedDB:', err);
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn('Error al limpiar localStorage:', err);
  }
}
