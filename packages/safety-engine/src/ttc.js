/**
 * வழித்துணை (Vazhithunai) - Time-to-Collision (TTC) & Trajectory Engine
 * Dynamically computes closing velocity, speed-scaled safe-stop margins, and TTC.
 */
/**
 * Calculates speed-scaled safe stop distances based on user walking speed.
 * A brisk walker (e.g. 1.8 m/s) receives expanded warning margins.
 */
export function calculateScaledThresholds(walkingSpeed_mps, config) {
    const safeWalkSpeed = Math.max(0, Number.isFinite(walkingSpeed_mps) ? walkingSpeed_mps : 1.0);
    // Reaction distance delta (assuming ~0.8s reaction latency buffer for walking delta over 1.0 m/s)
    const speedBonus = Math.max(0, (safeWalkSpeed - 1.0) * 0.8);
    const warnDist = Number((config.warnDistance_m + speedBonus).toFixed(2));
    const critDist = Number((config.criticalDistance_m + speedBonus * 0.5).toFixed(2));
    return { warnDist, critDist };
}
/**
 * Computes closing velocity between previous and current detection depth.
 */
export function calculateClosingVelocity(currDepth_m, prevDepth_m, deltaTime_s) {
    if (prevDepth_m === undefined || deltaTime_s <= 0 || !Number.isFinite(deltaTime_s)) {
        return 0;
    }
    // delta distance: positive when distance is decreasing (closing in)
    const deltaDistance = prevDepth_m - currDepth_m;
    const velocity = deltaDistance / deltaTime_s;
    return Number.isFinite(velocity) ? Number(velocity.toFixed(2)) : 0;
}
/**
 * Evaluates comprehensive trajectory and TTC for an obstacle.
 */
export function evaluateTrajectory(currentDepth_m, closingVelocity_mps, walkingSpeed_mps, config) {
    const { warnDist, critDist } = calculateScaledThresholds(walkingSpeed_mps, config);
    const isClosing = closingVelocity_mps > config.closingVelocityThreshold_mps;
    const isFastCloser = closingVelocity_mps >= config.fastApproachThreshold_mps;
    // Effective relative approach speed
    const safeWalk = Math.max(0, Number.isFinite(walkingSpeed_mps) ? walkingSpeed_mps : 0);
    const relativeApproachSpeed = Math.max(0, closingVelocity_mps) + (isClosing ? safeWalk : safeWalk * 0.5);
    let ttc = 999.0;
    if (relativeApproachSpeed > 0.1 && currentDepth_m > 0) {
        ttc = Number((currentDepth_m / relativeApproachSpeed).toFixed(2));
    }
    // Determine distance severity
    let distanceSeverity = 'SAFE';
    if (currentDepth_m <= critDist ||
        (isClosing && ttc <= config.ttcCriticalThreshold_s && currentDepth_m <= warnDist * 1.5) ||
        isFastCloser) {
        distanceSeverity = 'CRITICAL';
    }
    else if (currentDepth_m <= warnDist || (isClosing && currentDepth_m <= warnDist * 1.2)) {
        distanceSeverity = 'WARN';
    }
    return {
        closingVelocity_mps,
        ttc_seconds: ttc,
        isClosing,
        isFastCloser,
        scaledWarnDistance_m: warnDist,
        scaledCriticalDistance_m: critDist,
        distanceSeverity
    };
}
//# sourceMappingURL=ttc.js.map