/**
 * Cart Session Hook
 * 
 * Manages persistent cart session ID for analytics tracking.
 * 
 * Purpose:
 * - Generate unique cart session ID on first use
 * - Persist across app restarts via AsyncStorage
 * - Allow manual reset on checkout completion
 * 
 * Cart Session ID Format: cart-{timestamp}-{random}
 * Example: cart-1697123456789-x3j9k2m4p
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_SESSION_STORAGE_KEY = '@cart_session_id';

interface UseCartSessionReturn {
  /** Current cart session ID (null until loaded) */
  cartSessionId: string | null;
  /** True while loading from AsyncStorage */
  isLoading: boolean;
  /** Generate new cart session ID (call after checkout) */
  resetCartSession: () => Promise<void>;
}

/**
 * Custom hook to manage persistent cart session ID
 * 
 * Features:
 * - Automatically loads or generates session ID on mount
 * - Persists to AsyncStorage for cross-session tracking
 * - Provides reset function for checkout completion
 * 
 * @returns Cart session state and control functions
 * 
 * @example
 * const { cartSessionId, isLoading, resetCartSession } = useCartSession();
 * 
 * // In product tracking
 * productListItems.map(item => ({
 *   ...item,
 *   _adobecmteas: {
 *     lowerFunnel: { cartID: cartSessionId }
 *   }
 * }))
 * 
 * // After checkout completes
 * await resetCartSession();
 */
export const useCartSession = (): UseCartSessionReturn => {
  const [cartSessionId, setCartSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Generate a new unique cart session ID
   * Format: cart-{timestamp}-{random}
   */
  const generateCartSessionId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11); // 9 char random string
    return `cart-${timestamp}-${random}`;
  };

  /**
   * Load existing session ID or create new one
   * Called on component mount
   */
  const loadOrCreateCartSession = async () => {
    try {
      // Try to load existing session ID
      const existingId = await AsyncStorage.getItem(CART_SESSION_STORAGE_KEY);
      
      if (existingId) {
        // Use existing session
        console.log('Loaded existing cart session:', existingId);
        setCartSessionId(existingId);
      } else {
        // Generate new session
        const newId = generateCartSessionId();
        await AsyncStorage.setItem(CART_SESSION_STORAGE_KEY, newId);
        console.log('Created new cart session:', newId);
        setCartSessionId(newId);
      }
    } catch (error) {
      console.error('Error loading cart session:', error);
      // Fallback: use in-memory session ID
      const fallbackId = generateCartSessionId();
      setCartSessionId(fallbackId);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset cart session (create new ID)
   * Call this after checkout completes
   */
  const resetCartSession = async () => {
    try {
      const newId = generateCartSessionId();
      await AsyncStorage.setItem(CART_SESSION_STORAGE_KEY, newId);
      setCartSessionId(newId);
      console.log('Reset cart session to:', newId);
    } catch (error) {
      console.error('Error resetting cart session:', error);
    }
  };

  // Load session on mount
  useEffect(() => {
    loadOrCreateCartSession();
  }, []);

  return {
    cartSessionId,
    isLoading,
    resetCartSession,
  };
};

