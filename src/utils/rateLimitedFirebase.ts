/**
 * Rate Limited Firebase Operations
 * Wraps Firebase operations with rate limiting protection
 */

import {
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  DocumentReference,
  Query,
  CollectionReference,
  UpdateData,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  Auth,
  UserCredential,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import rateLimiter, { type RateLimitResult } from './rateLimiter';

/**
 * Rate limited wrapper for Firebase Auth operations
 */
export class RateLimitedAuth {
  private auth: Auth;

  constructor(
    auth: Auth,
    _getUserIdentifier: () => string = () => 'anonymous'
  ) {
    this.auth = auth;
    // getUserIdentifier parameter reserved for future rate limiting features
  }

  async signInWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<UserCredential | null> {
    const identifier = email.toLowerCase();
    const limit = rateLimiter.checkLimit('auth:login', identifier);

    if (!limit.allowed) {
      const message =
        limit.message || 'Zbyt wiele prób logowania. Spróbuj ponownie później.';
      toast.error(message);
      throw new Error(message);
    }

    try {
      const result = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return result;
    } catch (error) {
      // Don't show Firebase-specific error details to user
      toast.error('Nieprawidłowy email lub hasło.');
      throw error;
    }
  }

  async createUserWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<UserCredential | null> {
    const identifier = email.toLowerCase();
    const limit = rateLimiter.checkLimit('auth:signup', identifier);

    if (!limit.allowed) {
      const message =
        limit.message ||
        'Zbyt wiele prób rejestracji. Spróbuj ponownie później.';
      toast.error(message);
      throw new Error(message);
    }

    try {
      const result = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return result;
    } catch (error) {
      toast.error('Nie udało się utworzyć konta. Spróbuj ponownie.');
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    const identifier = email.toLowerCase();
    const limit = rateLimiter.checkLimit('auth:password-reset', identifier);

    if (!limit.allowed) {
      const message =
        limit.message ||
        'Zbyt wiele prób resetowania hasła. Spróbuj ponownie później.';
      toast.error(message);
      throw new Error(message);
    }

    try {
      await sendPasswordResetEmail(this.auth, email);
      toast.success('Link do resetowania hasła został wysłany na email.');
    } catch (error) {
      toast.error('Nie udało się wysłać emaila z linkiem resetującym.');
      throw error;
    }
  }
}

/**
 * Rate limited wrapper for Firestore operations
 */
export class RateLimitedFirestore {
  private getUserIdentifier: () => string;

  constructor(getUserIdentifier: () => string = () => 'anonymous') {
    this.getUserIdentifier = getUserIdentifier;
  }

  private checkOperationLimit(operation: string): void {
    const identifier = this.getUserIdentifier();
    const limit = rateLimiter.checkLimit(operation, identifier);

    if (!limit.allowed) {
      const message =
        limit.message ||
        `Operacja ${operation} została ograniczona. Spróbuj ponownie później.`;
      toast.error(message);
      throw new Error(message);
    }
  }

  async addDoc(
    reference: CollectionReference<DocumentData>,
    data: DocumentData
  ): Promise<DocumentReference<DocumentData>> {
    this.checkOperationLimit('firestore:write');

    try {
      return await addDoc(reference, data);
    } catch (error) {
      toast.error('Nie udało się zapisać danych.');
      throw error;
    }
  }

  async updateDoc(
    reference: DocumentReference<DocumentData>,
    data: UpdateData<DocumentData>
  ): Promise<void> {
    this.checkOperationLimit('firestore:write');

    try {
      await updateDoc(reference, data);
    } catch (error) {
      toast.error('Nie udało się zaktualizować danych.');
      throw error;
    }
  }

  async deleteDoc(reference: DocumentReference<DocumentData>): Promise<void> {
    this.checkOperationLimit('firestore:write');

    try {
      await deleteDoc(reference);
    } catch (error) {
      toast.error('Nie udało się usunąć danych.');
      throw error;
    }
  }

  async getDoc(
    reference: DocumentReference<DocumentData>
  ): Promise<DocumentSnapshot<DocumentData>> {
    this.checkOperationLimit('firestore:read');

    try {
      return await getDoc(reference);
    } catch (error) {
      toast.error('Nie udało się pobrać danych.');
      throw error;
    }
  }

  async getDocs(
    query: Query<DocumentData>
  ): Promise<QuerySnapshot<DocumentData>> {
    this.checkOperationLimit('firestore:query');

    try {
      return await getDocs(query);
    } catch (error) {
      toast.error('Nie udało się pobrać danych.');
      throw error;
    }
  }
}

/**
 * Specialized rate limited operations for specific entities
 */
export class RateLimitedOperations {
  private getUserIdentifier: () => string;

  constructor(getUserIdentifier: () => string = () => 'anonymous') {
    this.getUserIdentifier = getUserIdentifier;
  }

  private checkLimit(operation: string): RateLimitResult {
    const identifier = this.getUserIdentifier();
    return rateLimiter.checkLimit(operation, identifier);
  }

  checkReceiptCreate(): RateLimitResult {
    return this.checkLimit('receipt:create');
  }

  checkReceiptUpdate(): RateLimitResult {
    return this.checkLimit('receipt:update');
  }

  checkClientCreate(): RateLimitResult {
    return this.checkLimit('client:create');
  }

  checkProductCreate(): RateLimitResult {
    return this.checkLimit('product:create');
  }

  checkSyncOperation(): RateLimitResult {
    return this.checkLimit('sync:operation');
  }

  checkDataExport(): RateLimitResult {
    return this.checkLimit('export:data');
  }

  checkPDFGenerate(): RateLimitResult {
    return this.checkLimit('pdf:generate');
  }

  /**
   * Execute an operation with rate limiting protection
   */
  async executeWithRateLimit<T>(
    operation: string,
    operationFn: () => Promise<T>,
    errorMessage?: string
  ): Promise<T> {
    const limit = this.checkLimit(operation);

    if (!limit.allowed) {
      const message =
        limit.message ||
        errorMessage ||
        'Operacja została ograniczona. Spróbuj ponownie później.';
      toast.error(message);
      throw new Error(message);
    }

    try {
      return await operationFn();
    } catch (error) {
      if (errorMessage) {
        toast.error(errorMessage);
      }
      throw error;
    }
  }
}

/**
 * Utility function to create rate limited instances
 */
export function createRateLimitedInstances(
  auth: Auth,
  getUserId: () => string
) {
  const getUserIdentifier = () => {
    try {
      return getUserId() || 'anonymous';
    } catch {
      return 'anonymous';
    }
  };

  return {
    auth: new RateLimitedAuth(auth, getUserIdentifier),
    firestore: new RateLimitedFirestore(getUserIdentifier),
    operations: new RateLimitedOperations(getUserIdentifier),
  };
}

/**
 * React hook for using rate limited operations
 */
export function useRateLimitedOperations(getUserId: () => string) {
  const getUserIdentifier = () => {
    try {
      return getUserId() || 'anonymous';
    } catch {
      return 'anonymous';
    }
  };

  return new RateLimitedOperations(getUserIdentifier);
}

// Export rate limiter for direct access if needed
export { rateLimiter };
