/**
 * வழித்துணை (Vazhithunai) Safety Engine Type Definitions
 * 100% Deterministic, Zero Dependencies, Zero I/O
 */

export type HazardState = 'CLEAR' | 'CAUTION' | 'HAZARD' | 'RECOVERING';

export const THREAT_TAXONOMY = [
  'vehicle',
  'two-wheeler',
  'e-rickshaw',
  'pole',
  'pit/open manhole',
  'stairs-down',
  'scaffolding',
  'low-hanging object',
  'cattle',
  'person',
  'wire'
] as const;

export type ThreatClass = typeof THREAT_TAXONOMY[number];

export interface BoundingBox {
  x: number; // 0.0 to 1.0 (left)
  y: number; // 0.0 to 1.0 (top)
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  class: ThreatClass | string;
  bbox: [number, number, number, number] | BoundingBox; // [x, y, w, h] or object
  depth_m: number;
  depth_confidence: number; // 0.0 to 1.0
  lateral_offset_m: number; // meters from corridor centerline: negative = left, positive = right
  height_m: number; // estimated vertical height from ground level in meters
  timestamp: number; // milliseconds
}

export interface DevicePose {
  pitch: number; // radians (tilt up/down)
  roll: number;  // radians (tilt left/right)
  yaw: number;   // radians (bearing heading)
}

export interface AmbientConditions {
  lux: number;      // ambient illumination (lux)
  noise_dB: number; // ambient acoustic level (dB SPL)
}

export interface SensingWindowInput {
  timestamp: number; // strictly injected timestamp in ms
  detections: Detection[];
  devicePose: DevicePose;
  walkingSpeedEstimate_mps: number; // walking speed in meters per second
  ambient: AmbientConditions;
  cameraStalled?: boolean;
  sensorDegraded?: boolean;
}

export type ReasonCode =
  | 'CORRIDOR_CLEAR'
  | 'CAUTION_PROXIMITY'
  | 'CRITICAL_PROXIMITY'
  | 'FAST_APPROACHING_HAZARD'
  | 'VECTOR_CLOSING_HAZARD'
  | 'SKY_GUARD_HEAD_HAZARD'
  | 'DROP_OFF_HAZARD'
  | 'VEHICLE_APPROACH'
  | 'TWO_WHEELER_APPROACH'
  | 'E_RICKSHAW_APPROACH'
  | 'CATTLE_IN_PATH'
  | 'PERSON_IN_PATH'
  | 'SCAFFOLDING_IN_PATH'
  | 'POLE_IN_PATH'
  | 'WIRE_IN_PATH'
  | 'RECOVERING_HYSTERESIS'
  | 'INSTANT_RELAPSE_DURING_RECOVERY'
  | 'SYSTEM_DEGRADED_CAMERA_STALL'
  | 'SYSTEM_DEGRADED_INVALID_DEPTH'
  | 'SYSTEM_DEGRADED_LOW_CONFIDENCE'
  | 'SYSTEM_DEGRADED_SENSOR_FAULT';

export interface StateTransitionEvent {
  fromState: HazardState;
  toState: HazardState;
  timestamp: number;
  reasons: ReasonCode[];
  primaryHazard?: Detection;
  explanation_ta: string; // Plain Tamil spoken explanation
  explanation_en: string; // Plain English explanation
  closingVelocity_mps?: number;
  ttc_seconds?: number;
  corridorLateralOffset_m?: number;
}

export interface CorridorConfig {
  width_m: number;                   // Walking corridor width (default 1.2 m)
  height_m: number;                  // Walking corridor height (default 2.2 m)
  warnDistance_m: number;            // Default warning threshold (default 2.5 m)
  criticalDistance_m: number;        // Default critical threshold (default 1.5 m)
  closingVelocityThreshold_mps: number; // Closing velocity to count as hazard (default 0.3 m/s)
  fastApproachThreshold_mps: number;    // Immediate single-window escalation threshold (default 1.5 m/s)
  ttcCriticalThreshold_s: number;    // Time-To-Collision critical threshold (default 1.8 s)
  persistenceWindows: number;        // Consecutive windows needed to escalate (default 3)
  recoveryHysteresisWindows: number; // Consecutive clean windows needed to return to CLEAR (default 5)
  maxAllowedFrameDelta_ms: number;   // Camera stall detection threshold (default 250 ms)
}

export interface ProcessedHazard {
  detection: Detection;
  normalizedClass: ThreatClass;
  closingVelocity_mps: number;
  ttc_seconds: number;
  isSkyGuard: boolean;
  isDropOff: boolean;
  isFastCloser: boolean;
  compensatedLateral_m: number;
  persistenceCount: number;
  distanceSeverity: 'CRITICAL' | 'WARN' | 'SAFE';
  reasons: ReasonCode[];
}

export interface EarconRecommendation {
  soundType: 'VEHICLE' | 'SKY_GUARD' | 'DROP_OFF' | 'PERSON' | 'STATIC' | 'SETTLING' | 'CLEAR_CHIME' | 'SYSTEM_DEGRADED';
  pitchHz: number;
  rhythmHz: number; // 2 Hz for CAUTION, 6 Hz for HAZARD, continuous for critical
  volumeDb: number;
  pan: number;      // -1.0 (full left) to +1.0 (full right)
}

export interface HapticRecommendation {
  pattern: 'CAUTION_TWO_TAPS' | 'HAZARD_PULSES' | 'ASYMMETRIC_LEFT' | 'ASYMMETRIC_RIGHT' | 'SKY_GUARD_RAMP' | 'DROP_OFF_BUZZ' | 'RECOVERING_FADE' | 'SYSTEM_DEGRADED_TRIPLE';
  intensity: number; // 0.0 to 1.0
  direction: 'left' | 'center' | 'right';
}

export interface CameraAdjustment {
  exposureGainRecommendation: number; // Multiplier, 1.0 = baseline
  autoTorch: boolean;
}

export interface EngineOutput {
  state: HazardState;
  transitionEvent?: StateTransitionEvent;
  activeHazards: ProcessedHazard[];
  recoveryCount: number;
  earconRecommendation: EarconRecommendation;
  hapticRecommendation: HapticRecommendation;
  cameraAdjustment: CameraAdjustment;
  degraded: boolean;
  degradedReason?: ReasonCode;
  latestReason: ReasonCode;
  explanation_ta: string;
  explanation_en: string;
  timestamp: number;
}
