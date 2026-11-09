/**
 * வழித்துணை (Vazhithunai) - Deterministic Safety State Machine
 * Pure state machine: CLEAR -> CAUTION -> HAZARD -> RECOVERING
 * Zero dependencies, zero I/O, 100% replayable.
 */
import { normalizeThreatClass } from './taxonomy.js';
import { evaluateCorridor } from './corridor.js';
import { evaluateTrajectory, calculateClosingVelocity } from './ttc.js';
import { evaluateAmbient } from './ambient.js';
import { validateSensingWindow } from './validator.js';
import { generateExplanation } from './explanations.js';
export const DEFAULT_CORRIDOR_CONFIG = {
    width_m: 1.2,
    height_m: 2.2,
    warnDistance_m: 2.5,
    criticalDistance_m: 1.5,
    closingVelocityThreshold_mps: 0.3,
    fastApproachThreshold_mps: 1.5,
    ttcCriticalThreshold_s: 1.8,
    persistenceWindows: 3,
    recoveryHysteresisWindows: 5,
    maxAllowedFrameDelta_ms: 250
};
export class SafetyEngine {
    state = 'CLEAR';
    recoveryCount = 0;
    trackMap = new Map();
    lastTimestamp = null;
    lastReason = 'CORRIDOR_CLEAR';
    latestExplanation_ta = 'பாதை பாதுகாப்பாக உள்ளது.';
    latestExplanation_en = 'Path is clear.';
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CORRIDOR_CONFIG, ...config };
    }
    /**
     * Resets internal state to initial CLEAR state.
     */
    reset() {
        this.state = 'CLEAR';
        this.recoveryCount = 0;
        this.trackMap.clear();
        this.lastTimestamp = null;
        this.lastReason = 'CORRIDOR_CLEAR';
        this.latestExplanation_ta = 'பாதை பாதுகாப்பாக உள்ளது.';
        this.latestExplanation_en = 'Path is clear.';
    }
    getState() {
        return this.state;
    }
    getRecoveryCount() {
        return this.recoveryCount;
    }
    getLastReason() {
        return this.lastReason;
    }
    getLatestExplanation() {
        return {
            ta: this.latestExplanation_ta,
            en: this.latestExplanation_en
        };
    }
    /**
     * Primary deterministic tick: processes a single sensing window input.
     */
    processWindow(input) {
        // 1. Fail-Loud Validator: check stalls, NaN, sensor status
        const validation = validateSensingWindow(input, this.lastTimestamp, this.config.maxAllowedFrameDelta_ms);
        // Compute ambient adjustments safely
        const safeAmbient = input?.ambient || { lux: 200, noise_dB: 55 };
        const ambientResult = evaluateAmbient(safeAmbient);
        const safeTimestamp = Number.isFinite(input?.timestamp) ? input.timestamp : (this.lastTimestamp ? this.lastTimestamp + 33 : 0);
        if (validation.degraded) {
            const degradedReason = validation.degradedReason || 'SYSTEM_DEGRADED_SENSOR_FAULT';
            const explanations = generateExplanation(degradedReason);
            this.lastReason = degradedReason;
            this.latestExplanation_ta = explanations.ta;
            this.latestExplanation_en = explanations.en;
            // Fail-loud: emit SYSTEM DEGRADED earcon and triple pulse haptic
            const degradedEarcon = {
                soundType: 'SYSTEM_DEGRADED',
                pitchHz: 880,
                rhythmHz: 10,
                volumeDb: Math.max(75, ambientResult.earconVolumeDb),
                pan: 0
            };
            const degradedHaptic = {
                pattern: 'SYSTEM_DEGRADED_TRIPLE',
                intensity: 1.0,
                direction: 'center'
            };
            const prevState = this.state;
            this.state = 'HAZARD'; // Escalate to hazard upon system degradation
            let transitionEvent;
            if (prevState !== 'HAZARD') {
                transitionEvent = {
                    fromState: prevState,
                    toState: 'HAZARD',
                    timestamp: safeTimestamp,
                    reasons: [degradedReason],
                    explanation_ta: explanations.ta,
                    explanation_en: explanations.en
                };
            }
            this.lastTimestamp = safeTimestamp;
            return {
                state: this.state,
                transitionEvent,
                activeHazards: [],
                recoveryCount: 0,
                earconRecommendation: degradedEarcon,
                hapticRecommendation: degradedHaptic,
                cameraAdjustment: ambientResult.cameraAdjustment,
                degraded: true,
                degradedReason,
                latestReason: degradedReason,
                explanation_ta: explanations.ta,
                explanation_en: explanations.en,
                timestamp: safeTimestamp
            };
        }
        // 2. Track & Correlate Detections
        const newTrackMap = new Map();
        const processedHazards = [];
        for (const detection of validation.sanitizedDetections) {
            // Consistency Check 1: Threat Taxonomy
            const normalizedClass = normalizeThreatClass(detection.class);
            if (!normalizedClass) {
                continue; // Peripheral clutter / non-threat filtered out
            }
            // Consistency Check 4: 3D Walking Corridor + IMU Re-alignment
            const corridorResult = evaluateCorridor(detection, input.devicePose, this.config);
            if (!corridorResult.inCorridor) {
                continue; // Outside virtual walking corridor, ignored
            }
            // Consistency Check 3 & 5: Vector Trajectory & Tracking
            const prevTrack = this.trackMap.get(detection.id);
            const deltaTime_s = prevTrack && this.lastTimestamp
                ? Math.max(0.001, (input.timestamp - prevTrack.lastTimestamp) / 1000)
                : 0.033; // ~30 FPS fallback
            const closingVelocity = calculateClosingVelocity(detection.depth_m, prevTrack?.lastDepth_m, deltaTime_s);
            // Trajectory & Safe-stop Evaluation (Consistency Check 2 & Section 5 TTC)
            const trajectory = evaluateTrajectory(detection.depth_m, closingVelocity, input.walkingSpeedEstimate_mps, this.config);
            // Persistence calculation
            let persistence = (prevTrack?.persistenceCount || 0) + 1;
            // Exception: fast approaching obstacle (> 1.5 m/s) escalates immediately
            if (trajectory.isFastCloser) {
                persistence = Math.max(persistence, this.config.persistenceWindows);
            }
            newTrackMap.set(detection.id, {
                persistenceCount: persistence,
                lastDepth_m: detection.depth_m,
                lastTimestamp: input.timestamp
            });
            // Collect Reason Codes
            const reasons = [];
            if (trajectory.isFastCloser)
                reasons.push('FAST_APPROACHING_HAZARD');
            if (trajectory.isClosing)
                reasons.push('VECTOR_CLOSING_HAZARD');
            if (trajectory.distanceSeverity === 'CRITICAL')
                reasons.push('CRITICAL_PROXIMITY');
            if (trajectory.distanceSeverity === 'WARN')
                reasons.push('CAUTION_PROXIMITY');
            if (corridorResult.isSkyGuard)
                reasons.push('SKY_GUARD_HEAD_HAZARD');
            if (corridorResult.isDropOff)
                reasons.push('DROP_OFF_HAZARD');
            // Specific threat class reason
            switch (normalizedClass) {
                case 'vehicle':
                    reasons.push('VEHICLE_APPROACH');
                    break;
                case 'two-wheeler':
                    reasons.push('TWO_WHEELER_APPROACH');
                    break;
                case 'e-rickshaw':
                    reasons.push('E_RICKSHAW_APPROACH');
                    break;
                case 'cattle':
                    reasons.push('CATTLE_IN_PATH');
                    break;
                case 'person':
                    reasons.push('PERSON_IN_PATH');
                    break;
                case 'scaffolding':
                    reasons.push('SCAFFOLDING_IN_PATH');
                    break;
                case 'pole':
                    reasons.push('POLE_IN_PATH');
                    break;
                case 'wire':
                    reasons.push('WIRE_IN_PATH');
                    break;
            }
            processedHazards.push({
                detection,
                normalizedClass,
                closingVelocity_mps: closingVelocity,
                ttc_seconds: trajectory.ttc_seconds,
                isSkyGuard: corridorResult.isSkyGuard,
                isDropOff: corridorResult.isDropOff,
                isFastCloser: trajectory.isFastCloser,
                compensatedLateral_m: corridorResult.compensatedLateral_m,
                persistenceCount: persistence,
                distanceSeverity: trajectory.distanceSeverity,
                reasons
            });
        }
        this.trackMap = newTrackMap;
        this.lastTimestamp = input.timestamp;
        // 3. State Machine Transitions
        // Filter active hazards that have met persistence requirements
        const persistedCriticalHazards = processedHazards.filter(h => (h.distanceSeverity === 'CRITICAL' || h.isFastCloser) &&
            (h.persistenceCount >= this.config.persistenceWindows || h.isFastCloser));
        const persistedWarnHazards = processedHazards.filter(h => h.distanceSeverity === 'WARN' &&
            h.persistenceCount >= this.config.persistenceWindows);
        const hasAnyCritical = persistedCriticalHazards.length > 0;
        const hasAnyWarn = persistedWarnHazards.length > 0;
        const corridorClean = processedHazards.length === 0;
        const prevState = this.state;
        let nextState = this.state;
        let primaryHazard;
        let transitionReason = 'CORRIDOR_CLEAR';
        if (hasAnyCritical) {
            primaryHazard = persistedCriticalHazards[0];
            transitionReason = primaryHazard.reasons[0] || 'CRITICAL_PROXIMITY';
            if (this.state === 'RECOVERING') {
                // Instant relapse!
                transitionReason = 'INSTANT_RELAPSE_DURING_RECOVERY';
            }
            nextState = 'HAZARD';
            this.recoveryCount = 0;
        }
        else if (hasAnyWarn) {
            primaryHazard = persistedWarnHazards[0];
            transitionReason = primaryHazard.reasons[0] || 'CAUTION_PROXIMITY';
            if (this.state === 'RECOVERING') {
                // Relapse to caution/hazard during recovery resets counter
                this.recoveryCount = 0;
                nextState = 'CAUTION';
            }
            else if (this.state === 'HAZARD') {
                // Drop to caution if critical cleared but caution remains
                nextState = 'CAUTION';
            }
            else if (this.state === 'CLEAR') {
                nextState = 'CAUTION';
            }
        }
        else if (corridorClean) {
            if (this.state === 'HAZARD' || this.state === 'CAUTION') {
                nextState = 'RECOVERING';
                this.recoveryCount = 1;
                transitionReason = 'RECOVERING_HYSTERESIS';
            }
            else if (this.state === 'RECOVERING') {
                this.recoveryCount++;
                if (this.recoveryCount >= this.config.recoveryHysteresisWindows) {
                    nextState = 'CLEAR';
                    this.recoveryCount = 0;
                    transitionReason = 'CORRIDOR_CLEAR';
                }
                else {
                    transitionReason = 'RECOVERING_HYSTERESIS';
                }
            }
            else {
                // Already CLEAR
                transitionReason = 'CORRIDOR_CLEAR';
            }
        }
        else {
            // Unpersisted detections (e.g. window 1 or 2 of 3)
            primaryHazard = processedHazards[0];
            transitionReason = primaryHazard?.reasons[0] || 'CAUTION_PROXIMITY';
            if (this.state === 'RECOVERING') {
                // Any obstacle detected during recovering resets counter and relapses to HAZARD
                nextState = 'HAZARD';
                this.recoveryCount = 0;
                transitionReason = 'INSTANT_RELAPSE_DURING_RECOVERY';
            }
        }
        this.state = nextState;
        this.lastReason = transitionReason;
        // Generate bilingual explanation
        const explanations = generateExplanation(transitionReason, primaryHazard?.detection, primaryHazard?.closingVelocity_mps);
        this.latestExplanation_ta = explanations.ta;
        this.latestExplanation_en = explanations.en;
        // 4. State Transition Event Emission
        let transitionEvent;
        if (prevState !== nextState || transitionReason === 'INSTANT_RELAPSE_DURING_RECOVERY') {
            transitionEvent = {
                fromState: prevState,
                toState: nextState,
                timestamp: input.timestamp,
                reasons: primaryHazard?.reasons || [transitionReason],
                primaryHazard: primaryHazard?.detection,
                explanation_ta: explanations.ta,
                explanation_en: explanations.en,
                closingVelocity_mps: primaryHazard?.closingVelocity_mps,
                ttc_seconds: primaryHazard?.ttc_seconds,
                corridorLateralOffset_m: primaryHazard?.compensatedLateral_m
            };
        }
        // 5. Synthesize Recommendations (Audio & Haptics)
        const earcon = this.synthesizeEarcon(nextState, primaryHazard, ambientResult.earconVolumeDb);
        const haptic = this.synthesizeHaptic(nextState, primaryHazard);
        return {
            state: this.state,
            transitionEvent,
            activeHazards: processedHazards,
            recoveryCount: this.recoveryCount,
            earconRecommendation: earcon,
            hapticRecommendation: haptic,
            cameraAdjustment: ambientResult.cameraAdjustment,
            degraded: false,
            latestReason: transitionReason,
            explanation_ta: explanations.ta,
            explanation_en: explanations.en,
            timestamp: input.timestamp
        };
    }
    /**
     * Generates earcon pitch, rhythm, timbre and spatial panning.
     */
    synthesizeEarcon(state, hazard, volumeDb) {
        if (state === 'CLEAR') {
            return {
                soundType: 'CLEAR_CHIME',
                pitchHz: 587.33, // D5 note
                rhythmHz: 1,
                volumeDb,
                pan: 0
            };
        }
        if (state === 'RECOVERING') {
            return {
                soundType: 'SETTLING',
                pitchHz: 440,
                rhythmHz: 1,
                volumeDb: Math.max(65, volumeDb - 5),
                pan: 0
            };
        }
        // Pitch rises with proximity: 440Hz at 2.5m -> 1320Hz at 0.5m
        const depth = hazard ? Math.max(0.3, Math.min(2.5, hazard.detection.depth_m)) : 1.5;
        const proximityRatio = (2.5 - depth) / 2.0; // 0.0 at 2.5m, 1.0 at 0.5m
        const pitchHz = Math.round(440 + proximityRatio * (1320 - 440));
        // Rhythm = urgency: CAUTION 2Hz, HAZARD 6Hz, critical proximity continuous/10Hz
        const rhythmHz = state === 'HAZARD'
            ? (hazard?.distanceSeverity === 'CRITICAL' ? 10 : 6)
            : 2;
        // Spatial panning: lateral offset (-0.6m to +0.6m) mapped to -1.0 to +1.0
        const lateral = hazard ? hazard.compensatedLateral_m : 0;
        const pan = Math.max(-1.0, Math.min(1.0, lateral / (this.config.width_m / 2)));
        // Timbre per class family
        let soundType = 'STATIC';
        if (hazard) {
            if (hazard.isSkyGuard) {
                soundType = 'SKY_GUARD';
            }
            else if (hazard.isDropOff) {
                soundType = 'DROP_OFF';
            }
            else if (['vehicle', 'two-wheeler', 'e-rickshaw'].includes(hazard.normalizedClass)) {
                soundType = 'VEHICLE';
            }
            else if (hazard.normalizedClass === 'person') {
                soundType = 'PERSON';
            }
            else {
                soundType = 'STATIC';
            }
        }
        return {
            soundType,
            pitchHz,
            rhythmHz,
            volumeDb,
            pan: Number(pan.toFixed(2))
        };
    }
    /**
     * Generates haptic pattern and directionality.
     */
    synthesizeHaptic(state, hazard) {
        if (state === 'CLEAR') {
            return { pattern: 'RECOVERING_FADE', intensity: 0, direction: 'center' };
        }
        if (state === 'RECOVERING') {
            return { pattern: 'RECOVERING_FADE', intensity: 0.2, direction: 'center' };
        }
        let direction = 'center';
        if (hazard) {
            if (hazard.compensatedLateral_m < -0.2)
                direction = 'left';
            else if (hazard.compensatedLateral_m > 0.2)
                direction = 'right';
        }
        if (state === 'CAUTION') {
            return { pattern: 'CAUTION_TWO_TAPS', intensity: 0.5, direction };
        }
        // HAZARD state
        if (hazard?.isSkyGuard) {
            return { pattern: 'SKY_GUARD_RAMP', intensity: 0.9, direction };
        }
        if (hazard?.isDropOff) {
            return { pattern: 'DROP_OFF_BUZZ', intensity: 1.0, direction };
        }
        if (direction === 'left') {
            return { pattern: 'ASYMMETRIC_LEFT', intensity: 0.85, direction: 'left' };
        }
        if (direction === 'right') {
            return { pattern: 'ASYMMETRIC_RIGHT', intensity: 0.85, direction: 'right' };
        }
        const depth = hazard ? Math.max(0.5, Math.min(2.5, hazard.detection.depth_m)) : 1.0;
        const intensity = Math.min(1.0, Math.max(0.6, 1.0 - (depth / 3.0)));
        return {
            pattern: 'HAZARD_PULSES',
            intensity: Number(intensity.toFixed(2)),
            direction: 'center'
        };
    }
}
//# sourceMappingURL=state-machine.js.map