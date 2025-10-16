/**
 * Identity Helpers for XDM Schema Implementation
 * 
 * Provides utility functions for:
 * - Email hashing (SHA-256) for privacy
 * - Building tenant identity structures for _adobecmteas namespace
 * 
 * Per SchemaUpdateGuide.md requirements:
 * - Hash emails as lowercase + SHA-256 hex
 * - Mirror identityMap to _adobecmteas.identities
 */

import * as Crypto from 'expo-crypto';

/**
 * Hash an email address for privacy-safe identity tracking
 * 
 * Process:
 * 1. Trim whitespace
 * 2. Convert to lowercase
 * 3. SHA-256 hash
 * 4. Return hex string
 * 
 * @param email - Email address to hash
 * @returns SHA-256 hex hash of normalized email, or empty string if no email
 * 
 * @example
 * const hashed = await hashEmail('User@Example.com');
 * // Returns: sha256 hex of 'user@example.com'
 */
export const hashEmail = async (email: string): Promise<string> => {
  if (!email) return '';
  
  // Normalize: trim and lowercase (per schema guide requirements)
  const normalized = email.toLowerCase().trim();
  
  // Hash using SHA-256
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized
  );
  
  return hash;
};

/**
 * Build tenant identity structure for _adobecmteas.identities
 * 
 * Mirrors identityMap data into tenant namespace for:
 * - Easier querying downstream
 * - Privacy-safe hashed email
 * - Multiple identity types
 * 
 * @param params - Identity parameters
 * @param params.ecid - Experience Cloud ID (from identityMap)
 * @param params.email - Plain email address (will be hashed)
 * @param params.phone - Mobile phone number (optional)
 * @returns Object with tenant identity fields
 * 
 * @example
 * const identities = await buildTenantIdentities({
 *   ecid: '12345678901234567890123456789012345',
 *   email: 'user@example.com',
 *   phone: '+1234567890'
 * });
 * // Returns: { ecid: '...', emailAddress: '...', hashedEmail: '...', mobilePhone: '...' }
 */
export const buildTenantIdentities = async (params: {
  ecid?: string;
  email?: string;
  phone?: string;
}): Promise<{
  ecid?: string;
  emailAddress?: string;
  hashedEmail?: string;
  mobilePhone?: string;
}> => {
  const identities: {
    ecid?: string;
    emailAddress?: string;
    hashedEmail?: string;
    mobilePhone?: string;
  } = {};
  
  // Add ECID if provided
  if (params.ecid) {
    identities.ecid = params.ecid;
  }
  
  // Add email (plain and hashed) if provided
  if (params.email) {
    identities.emailAddress = params.email;
    identities.hashedEmail = await hashEmail(params.email);
  }
  
  // Add phone if provided
  if (params.phone) {
    identities.mobilePhone = params.phone;
  }
  
  return identities;
};

/**
 * Extract ECID from identityMap object
 * 
 * Helper to safely extract ECID from the identityMap structure
 * returned by Identity.getIdentities()
 * 
 * @param identityMap - Identity map from Adobe SDK
 * @returns ECID string or undefined
 * 
 * @example
 * const identityMap = await Identity.getIdentities();
 * const ecid = extractECID(identityMap);
 * // Returns: '12345678901234567890123456789012345'
 */
export const extractECID = (identityMap: any): string | undefined => {
  return identityMap?.ECID?.[0]?.id;
};

/**
 * Extract email from identityMap object
 * 
 * Helper to safely extract email from the identityMap structure
 * 
 * @param identityMap - Identity map from Adobe SDK
 * @returns Email string or undefined
 * 
 * @example
 * const identityMap = await Identity.getIdentities();
 * const email = extractEmail(identityMap);
 * // Returns: 'user@example.com'
 */
export const extractEmail = (identityMap: any): string | undefined => {
  return identityMap?.Email?.[0]?.id;
};

