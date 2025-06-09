import { FirestoreError } from 'firebase/firestore';

/**
 * Utility functions for handling Firestore errors and connection issues
 */

export const isNetworkError = (error: any): boolean => {
  if (error?.code) {
    return (
      error.code === 'unavailable' ||
      error.code === 'deadline-exceeded' ||
      error.code === 'resource-exhausted' ||
      error.message?.includes('QUIC_PROTOCOL_ERROR') ||
      error.message?.includes('net::ERR_QUIC_PROTOCOL_ERROR')
    );
  }
  return false;
};

export const isRetryableError = (error: any): boolean => {
  return isNetworkError(error) || error?.code === 'aborted';
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      console.warn(`Attempt ${attempt} failed:`, error.message || error);
      
      if (attempt === maxRetries || !isRetryableError(error)) {
        break;
      }
      
      // Exponential backoff with jitter
      const delayMs = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Retrying in ${Math.round(delayMs)}ms...`);
      await delay(delayMs);
    }
  }
  
  throw lastError;
};

export const handleFirestoreError = (error: any, operation: string): string => {
  console.error(`Firestore error in ${operation}:`, error);
  
  if (isNetworkError(error)) {
    return 'Koneksi bermasalah. Silakan periksa internet dan coba lagi.';
  }
  
  switch (error?.code) {
    case 'permission-denied':
      return 'Anda tidak memiliki izin untuk operasi ini.';
    case 'not-found':
      return 'Data tidak ditemukan.';
    case 'already-exists':
      return 'Data sudah ada.';
    case 'invalid-argument':
      return 'Data tidak valid.';
    case 'unauthenticated':
      return 'Anda perlu login untuk melakukan operasi ini.';
    default:
      return error?.message || `Terjadi kesalahan saat ${operation}`;
  }
};
