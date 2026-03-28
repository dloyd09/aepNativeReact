/**
 * Lightweight module-level observable for Adobe SDK readiness state (item 2.1).
 *
 * Why module-level (not a React context)?
 * _layout.tsx initializes the SDK *outside* any provider boundary, so a context
 * value can't be updated from there without wrapping the entire app in a new
 * provider. A module-level store avoids that indirection while still giving
 * components a hook-based subscription.
 *
 * States:
 *   idle         — no App ID configured, SDK not started
 *   initializing — configureAdobe() is running
 *   ready        — initialization complete, ECID available
 *   error        — initialization failed (see console for details)
 *
 * Usage:
 *   // Drive state (from adobeConfig.ts / _layout.tsx):
 *   import { setAdobeReadiness } from './adobeReadiness';
 *   setAdobeReadiness('ready');
 *
 *   // Consume state (from any screen):
 *   import { useAdobeReadiness } from '../../src/utils/adobeReadiness';
 *   const readiness = useAdobeReadiness(); // 'idle' | 'initializing' | 'ready' | 'error'
 */

import { useState, useEffect } from 'react';

export type AdobeReadinessState = 'idle' | 'initializing' | 'ready' | 'error';

let _state: AdobeReadinessState = 'idle';
const _listeners = new Set<(s: AdobeReadinessState) => void>();

export function getAdobeReadiness(): AdobeReadinessState {
  return _state;
}

export function setAdobeReadiness(state: AdobeReadinessState): void {
  _state = state;
  _listeners.forEach(fn => fn(state));
}

/**
 * React hook — returns current readiness state and re-renders when it changes.
 */
export function useAdobeReadiness(): AdobeReadinessState {
  const [state, setState] = useState<AdobeReadinessState>(_state);
  useEffect(() => {
    // Sync in case state changed between render and effect registration
    setState(_state);
    _listeners.add(setState);
    return () => {
      _listeners.delete(setState);
    };
  }, []);
  return state;
}
