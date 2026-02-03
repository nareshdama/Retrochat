import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export const DB_NAME = 'retrochat-vault'
export const DB_VERSION = 3

export type StoreName = 'keys' | 'contacts' | 'conversations' | 'messages' | 'settings'

export type EncryptedBlob = {
  iv: Uint8Array
  ciphertext: Uint8Array
}

export type VaultRow = {
  id: string
  blob: EncryptedBlob
  createdAt: string
  updatedAt: string
}

interface RetrochatDb extends DBSchema {
  keys: {
    key: string
    value: VaultRow
    indexes: { 'by-updated': string }
  }
  contacts: {
    key: string
    value: VaultRow
    indexes: { 'by-updated': string }
  }
  conversations: {
    key: string
    value: VaultRow
    indexes: { 'by-updated': string }
  }
  messages: {
    key: string
    value: VaultRow
    indexes: { 'by-updated': string; 'by-timestamp': string }
  }
  settings: {
    key: string
    value: VaultRow
    indexes: { 'by-updated': string }
  }
}

export type RetrochatDatabase = IDBPDatabase<RetrochatDb>

export async function getDb(): Promise<RetrochatDatabase> {
  return openDB<RetrochatDb>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
      const version = newVersion ?? DB_VERSION

      // Idempotent creation of stores.
      const createStore = (name: StoreName) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' })
          store.createIndex('by-updated', 'updatedAt')
        }
      }

      // Add timestamp index to messages store if it doesn't exist.
      if (db.objectStoreNames.contains('messages')) {
        const messagesStore = tx.objectStore('messages')
        if (!messagesStore.indexNames.contains('by-timestamp')) {
          messagesStore.createIndex('by-timestamp', 'updatedAt')
        }
      }

      if (oldVersion < 1 && version >= 1) {
        ;['keys', 'contacts', 'conversations', 'messages', 'settings'].forEach((name) =>
          createStore(name as StoreName),
        )
      }

      // Future versions: add migrations here; ensure they are idempotent.
      void tx
    },
  })
}

export async function resetVault(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available.')
  }

  const db = await getDb()
  db.close()

  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME)

    deleteRequest.onsuccess = () => {
      resolve()
    }

    deleteRequest.onerror = () => {
      reject(new Error('Failed to reset vault.'))
    }

    deleteRequest.onblocked = () => {
      reject(new Error('Vault reset blocked. Please close all tabs and try again.'))
    }
  })
}

