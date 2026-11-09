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
export function sanitizeDetection(raw: any, index: number): { detection: Detection; isCorrupt: boolean } {
  let isCorrupt = false;

  const id = typeof raw?.id === 'string' && raw.id.length > 0 ? raw.id : `detection_${index}`;
  const rawClass = typeof raw?.class === 'string' ? raw.class : 'unknown';

  let depth = Number(raw?.depth_m);
  if (!Number.isFinite(depth) || depth < 0) {
    depth = 0.5; // Failsafe clamp to close range to ensure safety
    isCorrupt = true;
  }

  let confidence = Number(raw?.depth_confidence);
  if (!Number.isFinite(confidence) || confidence < 0) {
    confidence = 0.5;
    isCorrupt = true;
  } else if (confidence > 1.0) {
    confidence = 1.0;
  }

  let lateral = Number(raw?.lateral_offset_m);
  if (!Number.isFinite(lateral)) {
    lateral = 0;
    isCorrupt = true;
  }

  let height = Number(raw?.height_m);
  if (!Number.isFinite(height)) {
    height = 0.8;
    isCorrupt = true;
  }

  const timestamp = Number.isFinite(raw?.timestamp) ? Number(raw.timestamp) : 0;

  // Bounding box sanitization
  let bbox = raw?.bbox;
  if (!Array.isArray(bbox) || bbox.length < 4 || bbox.some((v: any) => !Number.isFinite(v))) {
    bbox = [0, 0, 1, 1];
  }

  return {
    detection: {
      id,
      class: rawClass,
      bbox: bbox as [number, number, number, number],
      depth_m: depth,
      depth_confidence: confidence,
      lateral_offset_m: lateral,
      height_m: height,
      timestamp
    },
    isCorrupt
  };
}

/**
 * Validates the sensing window input against camera stalls and sensor anomalies.
 */
export function validateSensingWindow(
  input: SensingWindowInput,
  lastTimestamp: number | null,
  maxAllowedFrameDelta_ms: number
): ValidationResult {
  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      degraded: true,
      degradedReason: 'SYSTEM_DEGRADED_SENSOR_FAULT',
      sanitizedDetections: []
    };
  }

  // Camera stall detection: explicit flag OR excessive timestamp delta
  if (input.cameraStalled) {
    return {
      isValid: false,
      degraded: true,
      degradedReason: 'SYSTEM_DEGRADED_CAMERA_STALL',
      sanitizedDetections: []
    };
  }

  if (lastTimestamp !== null && Number.isFinite(input.timestamp) && Number.isFinite(lastTimestamp)) {
    const delta = input.timestamp - lastTimestamp;
    if (delta > maxAllowedFrameDelta_ms) {
      return {
        isValid: false,
        degraded: true,
        degradedReason: 'SYSTEM_DEGRADED_CAMERA_STALL',
        sanitizedDetections: []
      };
    }
  }

  if (input.sensorDegraded) {
    return {
      isValid: false,
      degraded: true,
      degradedReason: 'SYSTEM_DEGRADED_SENSOR_FAULT',
      sanitizedDetections: []
    };
  }

  // Sanitize detections array
  const rawList = Array.isArray(input.detections) ? input.detections : [];
  const sanitizedList: Detection[] = [];
  let corruptCount = 0;

  for (let i = 0; i < rawList.length; i++) {
    const { detection, isCorrupt } = sanitizeDetection(rawList[i], i);
    sanitizedList.push(detection);
    if (isCorrupt) corruptCount++;
  }

  if (corruptCount > 3) {
    return {
      isValid: true,
      degraded: true,
      degradedReason: 'SYSTEM_DEGRADED_INVALID_DEPTH',
      sanitizedDetections: sanitizedList
    };
  }

  return {
    isValid: true,
    degraded: false,
    sanitizedDetections: sanitizedList
  };
}
