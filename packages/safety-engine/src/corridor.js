/**
 * வழித்துணை (Vazhithunai) - 3D Walking Corridor & IMU Alignment
 * Projects a 1.2m wide x 2.2m high virtual forward corridor and realigns with IMU pose.
 */
/**
 * Checks whether a detection falls inside the 3D walking corridor,
 * compensating for phone pitch and roll from the IMU.
 */
export function evaluateCorridor(detection, pose, config) {
    const halfWidth = config.width_m / 2; // 0.6m
    const roll = pose.roll || 0;
    const pitch = pose.pitch || 0;
    // Raw coordinates relative to camera axis
    const rawX = Number.isFinite(detection.lateral_offset_m) ? detection.lateral_offset_m : 0;
    const rawY = Number.isFinite(detection.height_m) ? detection.height_m : 0.8; // default mid-torso height
    // Re-align with gravity vector using device roll:
    // x_world = x_cam * cos(roll) - y_cam * sin(roll)
    // y_world = x_cam * sin(roll) + y_cam * cos(roll)
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const compensatedLateral = rawX * cosR - (rawY - 1.0) * sinR;
    // Pitch compensation for height above ground:
    // Pitch tilting the phone shifts vertical perception
    const compensatedHeight = rawY + Math.sin(pitch) * (detection.depth_m || 1.0);
    // Check corridor boundaries
    const inLateralCorridor = Math.abs(compensatedLateral) <= halfWidth;
    const inVerticalCorridor = compensatedHeight >= -0.3 && compensatedHeight <= config.height_m;
    const inCorridor = inLateralCorridor && inVerticalCorridor;
    // Sky Guard: Upper corridor (chest to head level, 1.4m to 2.2m)
    // Strictly applies to overhead obstacles (scaffolding, hanging objects, tree branches, wires)
    // Ground vehicles, two-wheelers, and cattle are not Sky Guard overhead threats.
    const isGroundEntity = ['vehicle', 'two-wheeler', 'e-rickshaw', 'cattle'].includes(detection.class);
    const isSkyGuard = inCorridor && !isGroundEntity && (compensatedHeight >= 1.4 ||
        detection.class === 'scaffolding' ||
        detection.class === 'low-hanging object' ||
        detection.class === 'wire');
    // Drop-off / Pit / Stairs-down
    const isDropOff = (detection.class === 'stairs-down' ||
        detection.class === 'pit/open manhole' ||
        compensatedHeight < 0.1);
    return {
        inCorridor,
        compensatedLateral_m: Number(compensatedLateral.toFixed(3)),
        compensatedHeight_m: Number(compensatedHeight.toFixed(3)),
        isSkyGuard,
        isDropOff
    };
}
//# sourceMappingURL=corridor.js.map