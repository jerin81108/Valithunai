/**
 * வழித்துணை (Vazhithunai) - 3D Walking Corridor & IMU Alignment
 * Projects a 1.2m wide x 2.2m high virtual forward corridor and realigns with IMU pose.
 */
import { DevicePose, CorridorConfig, Detection } from './types.js';
export interface CorridorCheckResult {
    inCorridor: boolean;
    compensatedLateral_m: number;
    compensatedHeight_m: number;
    isSkyGuard: boolean;
    isDropOff: boolean;
}
/**
 * Checks whether a detection falls inside the 3D walking corridor,
 * compensating for phone pitch and roll from the IMU.
 */
export declare function evaluateCorridor(detection: Detection, pose: DevicePose, config: CorridorConfig): CorridorCheckResult;
//# sourceMappingURL=corridor.d.ts.map