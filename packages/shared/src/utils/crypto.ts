// Browser-compatible crypto utilities
const isBrowser = typeof window !== 'undefined' && typeof window.crypto !== 'undefined';

// Generate random bytes - browser compatible
const getRandomBytes = async (length: number): Promise<Uint8Array> => {
  if (isBrowser) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  } else {
    // Node.js environment - dynamic import to avoid bundling issues
    const { randomBytes } = await import('crypto');
    return new Uint8Array(randomBytes(length));
  }
};

// Generate ID with browser compatibility
export const generateId = async (length: number = 8): Promise<string> => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = await getRandomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  
  return result;
};

// Hash string - browser compatible using SubtleCrypto
export const hashString = async (str: string): Promise<string> => {
  if (isBrowser) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment - dynamic import to avoid bundling issues
    const { createHash } = await import('crypto');
    return createHash('sha256').update(str).digest('hex');
  }
};

// Synchronous hash for backward compatibility
export const hashStringSync = (str: string): string => {
  // For browser, we'll use a simple hash function as fallback
  // Note: In Node.js environments, prefer using hashString() for crypto security
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export const generateCacheKey = (...parts: string[]): string => {
  return parts.join(':');
};

export const generateGameId = async (): Promise<string> => {
  return await generateId(8);
};

export const generateSessionToken = async (): Promise<string> => {
  const bytes = await getRandomBytes(32);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Synchronous versions for backward compatibility (browser-only)
export const generateIdSync = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  if (isBrowser) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback for Node.js - use Math.random (less secure)
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
};

export const generateGameIdSync = (): string => {
  return generateIdSync(8);
};