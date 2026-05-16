/**
 * Shared result type for all platform detectors.
 */
export interface PlatformDetectionResult {
  confidence: number; // 0–100
  signals: string[];
}
