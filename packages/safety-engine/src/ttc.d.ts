/**
 * வழித்துணை (Vazhithunai) - Time-to-Collision (TTC) & Trajectory Engine
 * Dynamically computes closing velocity, speed-scaled safe-stop margins, and TTC.
 */
import { CorridorConfig } from './types.js';
export interface TrajectoryResult {
    closingVelocity_mps: number;
    ttc_seconds: number;
    isClosing: boolean;
    isFastCloser: boolean;
    scaledWarnDistance_m: number;
    scaledCriticalDistance_m: number;
    distanceSeverity: 'CRITICAL' | 'WARN' | 'SAFE';
}
/**
 * Calculates speed-scaled safe stop distances based on user walking speed.
 * A brisk walker (e.g. 1.8 m/s) receives expanded warning margins.
 */
export declare function calculateScaledThresholds(walkingSpeed_mps: number, config: CorridorConfig): {
    warnDist: number;
    critDist: number;
};
/**
 * Computes closing velocity between previous and current detection depth.
 */
export declare function calculateClosingVelocity(currDepth_m: number, prevDepth_m: number | undefined, deltaTime_s: number): number;
/**
 * Evaluates comprehensive trajectory and TTC for an obstacle.
 */
export declare function evaluateTrajectory(currentDepth_m: number, closingVelocity_mps: number, walkingSpeed_mps: number, config: CorridorConfig): TrajectoryResult;
//# sourceMappingURL=ttc.d.ts.map