/**
 * Common return type for server actions that perform mutations.
 * All server actions should return this shape for consistent error handling.
 */
export type ActionResult<T = object> = {
  success: boolean;
  error?: string;
} & T;
