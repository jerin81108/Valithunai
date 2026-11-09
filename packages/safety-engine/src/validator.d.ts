/**
 * வழித்துணை (Vazhithunai) - Fail-Loud Safety Validator & Sanitizer
 * Ensures the engine never throws on corrupted inputs (fuzz resilience)
 * and always fails loud on camera stalls or sensor degradation.
 */
import { SensingWindowInput, Detection, ReasonCode } from './types.js';
export interface ValidationResult {
    isValid: boolean;
    degraded: boolean;
    degradedReason?: ReasonCode;
    sanitizedDetections: Detection[];
}
/**
 * Validates and sanitizes a single detection, handling NaN, null, and out-of-bounds numbers.
 */
export declare function sanitizeDetection(raw: any, index: number): {
    detection: Detection;
    isCorrupt: boolean;
};
/**
 * Validates the sensing window input against camera stalls and sensor anomalies.
 */
export declare function validateSensingWindow(input: SensingWindowInput, lastTimestamp: number | null, maxAllowedFrameDelta_ms: number): ValidationResult;
//# sourceMappingURL=validator.d.ts.map