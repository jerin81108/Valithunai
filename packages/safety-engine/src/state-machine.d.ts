/**
 * வழித்துணை (Vazhithunai) - Deterministic Safety State Machine
 * Pure state machine: CLEAR -> CAUTION -> HAZARD -> RECOVERING
 * Zero dependencies, zero I/O, 100% replayable.
 */
import { HazardState, SensingWindowInput, EngineOutput, CorridorConfig, ReasonCode } from './types.js';
export declare const DEFAULT_CORRIDOR_CONFIG: CorridorConfig;
export declare class SafetyEngine {
    private state;
    private recoveryCount;
    private trackMap;
    private lastTimestamp;
    private lastReason;
    private latestExplanation_ta;
    private latestExplanation_en;
    private config;
    constructor(config?: Partial<CorridorConfig>);
    /**
     * Resets internal state to initial CLEAR state.
     */
    reset(): void;
    getState(): HazardState;
    getRecoveryCount(): number;
    getLastReason(): ReasonCode;
    getLatestExplanation(): {
        ta: string;
        en: string;
    };
    /**
     * Primary deterministic tick: processes a single sensing window input.
     */
    processWindow(input: SensingWindowInput): EngineOutput;
    /**
     * Generates earcon pitch, rhythm, timbre and spatial panning.
     */
    private synthesizeEarcon;
    /**
     * Generates haptic pattern and directionality.
     */
    private synthesizeHaptic;
}
//# sourceMappingURL=state-machine.d.ts.map