/**
 * வழித்துணை (Vazhithunai) Safety Engine Type Definitions
 * 100% Deterministic, Zero Dependencies, Zero I/O
 */
export type HazardState = 'CLEAR' | 'CAUTION' | 'HAZARD' | 'RECOVERING';
export declare const THREAT_TAXONOMY: readonly ["vehicle", "two-wheeler", "e-rickshaw", "pole", "pit/open manhole", "stairs-down", "scaffolding", "low-hanging object", "cattle", "person", "wire"];
export type ThreatClass = typeof THREAT_TAXONOMY[number];
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Detection {
    id: string;
    class: ThreatClass | string;
    bbox: [number, number, number, number] | BoundingBox;
    depth_m: number;
    depth_confidence: number;
    lateral_offset_m: number;
    height_m: number;
    timestamp: number;
}
export interface DevicePose {
    pitch: number;
    roll: number;
    yaw: number;
}
export interface AmbientConditions {
    lux: number;
    noise_dB: number;
}
export interface SensingWindowInput {
    timestamp: number;
    detections: Detection[];
    devicePose: DevicePose;
    walkingSpeedEstimate_mps: number;
    ambient: AmbientConditions;
    cameraStalled?: boolean;
    sensorDegraded?: boolean;
}
export type ReasonCode = 'CORRIDOR_CLEAR' | 'CAUTION_PROXIMITY' | 'CRITICAL_PROXIMITY' | 'FAST_APPROACHING_HAZARD' | 'VECTOR_CLOSING_HAZARD' | 'SKY_GUARD_HEAD_HAZARD' | 'DROP_OFF_HAZARD' | 'VEHICLE_APPROACH' | 'TWO_WHEELER_APPROACH' | 'E_RICKSHAW_APPROACH' | 'CATTLE_IN_PATH' | 'PERSON_IN_PATH' | 'SCAFFOLDING_IN_PATH' | 'POLE_IN_PATH' | 'WIRE_IN_PATH' | 'RECOVERING_HYSTERESIS' | 'INSTANT_RELAPSE_DURING_RECOVERY' | 'SYSTEM_DEGRADED_CAMERA_STALL' | 'SYSTEM_DEGRADED_INVALID_DEPTH' | 'SYSTEM_DEGRADED_LOW_CONFIDENCE' | 'SYSTEM_DEGRADED_SENSOR_FAULT';
export interface StateTransitionEvent {
    fromState: HazardState;
    toState: HazardState;
    timestamp: number;
    reasons: ReasonCode[];
    primaryHazard?: Detection;
    explanation_ta: string;
    explanation_en: string;
    closingVelocity_mps?: number;
    ttc_seconds?: number;
    corridorLateralOffset_m?: number;
}
export interface CorridorConfig {
    width_m: number;
    height_m: number;
    warnDistance_m: number;
    criticalDistance_m: number;
    closingVelocityThreshold_mps: number;
    fastApproachThreshold_mps: number;
    ttcCriticalThreshold_s: number;
    persistenceWindows: number;
    recoveryHysteresisWindows: number;
    maxAllowedFrameDelta_ms: number;
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
    rhythmHz: number;
    volumeDb: number;
    pan: number;
}
export interface HapticRecommendation {
    pattern: 'CAUTION_TWO_TAPS' | 'HAZARD_PULSES' | 'ASYMMETRIC_LEFT' | 'ASYMMETRIC_RIGHT' | 'SKY_GUARD_RAMP' | 'DROP_OFF_BUZZ' | 'RECOVERING_FADE' | 'SYSTEM_DEGRADED_TRIPLE';
    intensity: number;
    direction: 'left' | 'center' | 'right';
}
export interface CameraAdjustment {
    exposureGainRecommendation: number;
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
//# sourceMappingURL=types.d.ts.map