/**
 * Parse a JSON string safely. Returns `fallback` if the value is null/undefined,
 * empty, or malformed. Logs parse errors with the caller-supplied `label` so the
 * failure is not silent — the schema or storage entry can be diagnosed.
 *
 * Used by every site that decodes an `AsyncStorage.getItem` result so a single
 * corrupted entry can't crash the component or silently default to {}.
 */
export function safeParseJSON<T>(
  value: string | null | undefined,
  fallback: T,
  label = 'safeParseJSON'
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[${label}] Failed to parse JSON:`, error);
    return fallback;
  }
}
