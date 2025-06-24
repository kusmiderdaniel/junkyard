/**
 * Encryption utility for securing localStorage data
 * Uses Web Crypto API with AES-GCM encryption
 */

// Generate a key from user's UID and a salt
const generateKey = async (userUID: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userUID + process.env.REACT_APP_FIREBASE_PROJECT_ID),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive a key from the key material
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('pwa-receipt-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt data
export const encryptData = async (
  data: any,
  userUID: string
): Promise<string> => {
  try {
    const key = await generateKey(userUID);
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);

    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encoder.encode(dataStr)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for storage
    return btoa(
      Array.from(combined)
        .map(b => String.fromCharCode(b))
        .join('')
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Encryption failed:', error);
    }
    // Fallback to unencrypted if encryption fails (for backward compatibility)
    return JSON.stringify(data);
  }
};

// Decrypt data
export const decryptData = async <T>(
  encryptedStr: string,
  userUID: string
): Promise<T | null> => {
  try {
    // Check if data is already JSON (unencrypted legacy data)
    if (encryptedStr.startsWith('{') || encryptedStr.startsWith('[')) {
      return JSON.parse(encryptedStr);
    }

    const key = await generateKey(userUID);

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedStr), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encryptedData
    );

    // Convert back to string and parse JSON
    const decoder = new TextDecoder();
    const decryptedStr = decoder.decode(decryptedData);
    return JSON.parse(decryptedStr);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Decryption failed:', error);
    }

    // Try parsing as plain JSON (backward compatibility)
    try {
      return JSON.parse(encryptedStr);
    } catch {
      return null;
    }
  }
};

// Check if Web Crypto API is available
export const isEncryptionAvailable = (): boolean => {
  return (
    typeof crypto !== 'undefined' &&
    crypto.subtle !== undefined &&
    typeof crypto.subtle.encrypt === 'function'
  );
};

// Migration utility to encrypt existing unencrypted data
export const migrateUnencryptedData = async (
  userUID: string
): Promise<void> => {
  if (!isEncryptionAvailable()) {
    console.warn('Web Crypto API not available, skipping encryption migration');
    return;
  }

  const keys = [
    'offline_clients',
    'offline_receipts',
    'offline_company_details',
    'offline_products',
    'offline_categories',
    'offline_pending_operations',
  ];

  for (const key of keys) {
    const existingData = localStorage.getItem(key);
    if (
      existingData &&
      (existingData.startsWith('{') || existingData.startsWith('['))
    ) {
      try {
        const parsed = JSON.parse(existingData);
        const encrypted = await encryptData(parsed, userUID);
        localStorage.setItem(key, encrypted);
      } catch (error) {
        console.error(`Failed to migrate ${key}:`, error);
      }
    }
  }
};
