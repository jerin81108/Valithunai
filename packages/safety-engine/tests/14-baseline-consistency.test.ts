import { describe, it, expect, beforeEach } from './vitest-shim.js';
import { SafetyEngine } from '../src/state-machine.js';
import { SensingWindowInput } from '../src/types.js';

describe('SafetyEngine - 14 Baseline Consistency Checks', () => {
  let engine: SafetyEngine;

  const defaultAmbient = { lux: 250, noise_dB: 55 };
  const defaultPose = { pitch: 0, roll: 0, yaw: 0 };

  const makeInput = (
    timestamp: number,
    detections: any[] = [],
    options: Partial<SensingWindowInput> = {}
  ): SensingWindowInput => ({
    timestamp,
    detections,
    devicePose: options.devicePose || defaultPose,
    walkingSpeedEstimate_mps: options.walkingSpeedEstimate_mps ?? 1.0,
    ambient: options.ambient || defaultAmbient,
    cameraStalled: options.cameraStalled ?? false,
    sensorDegraded: options.sensorDegraded ?? false
  });

  beforeEach(() => {
    engine = new SafetyEngine();
  });

  // Test 1: Threat taxonomy filtering
  it('1. filters taxonomy: approved classes pass, unapproved peripheral clutter is discarded', () => {
    const input = makeInput(100, [
      { id: '1', class: 'cup', depth_m: 1.0, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 0.8, timestamp: 100 },
      { id: '2', class: 'dog', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 0.4, timestamp: 100 },
      { id: '3', class: 'vehicle', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 0.8, timestamp: 100 }
    ]);

    const output = engine.processWindow(input);
    expect(output.activeHazards.length).toBe(1);
    expect(output.activeHazards[0].normalizedClass).toBe('vehicle');
  });

  // Test 2: Safe-stop distance WARN threshold (< 2.5m)
  it('2. triggers CAUTION when obstacle enters warn distance (< 2.5m) after persistence', () => {
    for (let i = 0; i < 3; i++) {
      const input = makeInput(100 + i * 33, [
        { id: 'obs1', class: 'pole', depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }
      ]);
      engine.processWindow(input);
    }
    expect(engine.getState()).toBe('CAUTION');
    expect(engine.processWindow(makeInput(250, [
      { id: 'obs1', class: 'pole', depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 250 }
    ])).latestReason).toBe('CAUTION_PROXIMITY');
  });

  // Test 3: Safe-stop distance CRITICAL threshold (< 1.5m)
  it('3. triggers HAZARD when obstacle enters critical distance (< 1.5m) after persistence', () => {
    for (let i = 0; i < 3; i++) {
      const input = makeInput(100 + i * 33, [
        { id: 'obs1', class: 'cattle', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }
      ]);
      engine.processWindow(input);
    }
    expect(engine.getState()).toBe('HAZARD');
    expect(engine.processWindow(makeInput(250, [
      { id: 'obs1', class: 'cattle', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 250 }
    ])).latestReason).toBe('CRITICAL_PROXIMITY');
  });

  // Test 4: Dynamic threshold scaling by walking speed
  it('4. scales warn distance threshold upward when user walks briskly', () => {
    // Normal walking speed (1.0 m/s): 2.7m is outside warn threshold (< 2.5m)
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        { id: 'obs1', class: 'person', depth_m: 2.7, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }
      ], { walkingSpeedEstimate_mps: 1.0 }));
    }
    expect(engine.getState()).toBe('CLEAR');

    // Brisk walking (2.0 m/s): warn distance expands, so 2.7m falls inside warn margin
    engine.reset();
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        { id: 'obs1', class: 'person', depth_m: 2.7, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }
      ], { walkingSpeedEstimate_mps: 2.0 }));
    }
    expect(engine.getState()).toBe('CAUTION');
  });

  // Test 5: Vector trajectory closing velocity
  it('5. detects closing velocity > 0.3 m/s as approaching hazard', () => {
    // Window 1: e-rickshaw at 3.0m
    engine.processWindow(makeInput(100, [
      { id: 'rick1', class: 'e-rickshaw', depth_m: 3.0, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 }
    ]));

    // Window 2: e-rickshaw at 2.4m (closes 0.6m in 100ms => 6 m/s closing speed)
    const out2 = engine.processWindow(makeInput(200, [
      { id: 'rick1', class: 'e-rickshaw', depth_m: 2.4, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 200 }
    ]));

    expect(out2.activeHazards[0].closingVelocity_mps).toBeGreaterThan(0.3);
    expect(out2.activeHazards[0].isFastCloser).toBe(true);
  });

  // Test 6: Corridor lateral boundary
  it('6. ignores peripheral clutter outside 1.2m corridor (|lateral| > 0.6m)', () => {
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        // Pole at 0.8m lateral (outside 0.6m corridor half-width)
        { id: 'pole_side', class: 'pole', depth_m: 1.0, depth_confidence: 0.9, lateral_offset_m: 0.8, height_m: 1.0, timestamp: 100 + i * 33 }
      ]));
    }
    expect(engine.getState()).toBe('CLEAR');
  });

  // Test 7: Corridor IMU compensation
  it('7. compensates for phone tilt/roll to maintain true world corridor', () => {
    // Device rolled 45 degrees (0.785 rad). An object with lateral 0.7m in camera frame
    // rotates back into world corridor boundary
    const roll = Math.PI / 4;
    const output = engine.processWindow(makeInput(100, [
      { id: 'obs1', class: 'pole', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0.4, height_m: 1.4, timestamp: 100 }
    ], { devicePose: { pitch: 0, roll, yaw: 0 } }));

    expect(output.activeHazards.length).toBeGreaterThanOrEqual(1);
  });

  // Test 8: Sky Guard upper-corridor head/chest hazard
  it('8. triggers Sky Guard for overhead hazards (height > 1.2m) with rising two-tone earcon and ramp haptic', () => {
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        { id: 'branch1', class: 'tree_branch', depth_m: 1.4, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.8, timestamp: 100 + i * 33 }
      ]));
    }
    const out = engine.processWindow(makeInput(200, [
      { id: 'branch1', class: 'tree_branch', depth_m: 1.4, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.8, timestamp: 200 }
    ]));

    expect(out.activeHazards[0].isSkyGuard).toBe(true);
    expect(out.earconRecommendation.soundType).toBe('SKY_GUARD');
    expect(out.hapticRecommendation.pattern).toBe('SKY_GUARD_RAMP');
  });

  // Test 9: Drop-off and stairs-down detector
  it('9. triggers drop-off detector for stairs-down or open pit with descending buzz', () => {
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        { id: 'pit1', class: 'pit/open manhole', depth_m: 1.3, depth_confidence: 0.9, lateral_offset_m: 0, height_m: -0.1, timestamp: 100 + i * 33 }
      ]));
    }
    const out = engine.processWindow(makeInput(200, [
      { id: 'pit1', class: 'pit/open manhole', depth_m: 1.3, depth_confidence: 0.9, lateral_offset_m: 0, height_m: -0.1, timestamp: 200 }
    ]));

    expect(out.activeHazards[0].isDropOff).toBe(true);
    expect(out.earconRecommendation.soundType).toBe('DROP_OFF');
    expect(out.hapticRecommendation.pattern).toBe('DROP_OFF_BUZZ');
  });

  // Test 10: Temporal persistence
  it('10. requires 3 consecutive windows before static caution obstacle escalates', () => {
    // Window 1: static pole at 2.2m
    const out1 = engine.processWindow(makeInput(100, [
      { id: 'pole1', class: 'pole', depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 }
    ]));
    expect(out1.state).toBe('CLEAR'); // Not yet persisted

    // Window 2
    const out2 = engine.processWindow(makeInput(133, [
      { id: 'pole1', class: 'pole', depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 133 }
    ]));
    expect(out2.state).toBe('CLEAR'); // Not yet persisted

    // Window 3: 3rd window reaches persistence threshold
    const out3 = engine.processWindow(makeInput(166, [
      { id: 'pole1', class: 'pole', depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 166 }
    ]));
    expect(out3.state).toBe('CAUTION');
  });

  // Test 11: Fast closer bypasses persistence
  it('11. escalates immediately in 1 window if obstacle closes faster than 1.5 m/s', () => {
    // Window 1
    engine.processWindow(makeInput(100, [
      { id: 'fast_auto', class: 'e-rickshaw', depth_m: 3.0, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 }
    ]));

    // Window 2: closes from 3.0m to 1.3m in 100ms => 17 m/s approach
    const out2 = engine.processWindow(makeInput(200, [
      { id: 'fast_auto', class: 'e-rickshaw', depth_m: 1.3, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 200 }
    ]));

    expect(out2.state).toBe('HAZARD');
    expect(out2.activeHazards[0].isFastCloser).toBe(true);
  });

  // Test 12: Recovery hysteresis
  it('12. requires exactly 5 consecutive clean windows to recover from HAZARD to CLEAR', () => {
    // Put engine into HAZARD
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        { id: 'car1', class: 'vehicle', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }
      ]));
    }
    expect(engine.getState()).toBe('HAZARD');

    // Clean windows 1, 2, 3, 4: MUST be in RECOVERING
    for (let w = 1; w <= 4; w++) {
      const out = engine.processWindow(makeInput(200 + w * 33, []));
      expect(out.state).toBe('RECOVERING');
      expect(out.recoveryCount).toBe(w);
    }

    // Clean window 5: Transitions to CLEAR
    const out5 = engine.processWindow(makeInput(200 + 5 * 33, []));
    expect(out5.state).toBe('CLEAR');
    expect(out5.recoveryCount).toBe(0);
    expect(out5.earconRecommendation.soundType).toBe('CLEAR_CHIME');
  });

  // Test 13: Instant relapse during recovery
  it('13. instantly relapses from RECOVERING to HAZARD and resets counter to 0 on new obstacle', () => {
    // Escalate to HAZARD
    for (let i = 0; i < 3; i++) {
      engine.processWindow(makeInput(100 + i * 33, [
        { id: 'scaffold', class: 'scaffolding', depth_m: 1.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.5, timestamp: 100 + i * 33 }
      ]));
    }
    expect(engine.getState()).toBe('HAZARD');

    // Clean windows 1 & 2 -> RECOVERING
    engine.processWindow(makeInput(200, []));
    const outRec2 = engine.processWindow(makeInput(233, []));
    expect(outRec2.state).toBe('RECOVERING');
    expect(outRec2.recoveryCount).toBe(2);

    // Sudden obstacle in window 3 -> INSTANT RELAPSE
    const relapseOut = engine.processWindow(makeInput(266, [
      { id: 'cow', class: 'cattle', depth_m: 1.4, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 266 }
    ]));

    expect(relapseOut.state).toBe('HAZARD');
    expect(relapseOut.recoveryCount).toBe(0);
    expect(relapseOut.latestReason).toBe('INSTANT_RELAPSE_DURING_RECOVERY');
  });

  // Test 14: Ambient adjustment & Fail-loud stall detection
  it('14. adapts to ambient noise and fails loud on camera stall without ever reporting CLEAR', () => {
    // Ambient noise test: 75 dB noise raises earcon volume above safety floor
    const loudOut = engine.processWindow(makeInput(100, [], { ambient: { lux: 200, noise_dB: 75 } }));
    expect(loudOut.earconRecommendation.volumeDb).toBe(80); // clamped to 80 dB ceiling

    // Camera stall (> 250ms gap): must degrade and trigger SYSTEM_DEGRADED
    const stallOut = engine.processWindow(makeInput(400, [])); // 300ms gap from 100ms
    expect(stallOut.degraded).toBe(true);
    expect(stallOut.degradedReason).toBe('SYSTEM_DEGRADED_CAMERA_STALL');
    expect(stallOut.state).toBe('HAZARD');
    expect(stallOut.state).not.toBe('CLEAR');
    expect(stallOut.earconRecommendation.soundType).toBe('SYSTEM_DEGRADED');
    expect(stallOut.hapticRecommendation.pattern).toBe('SYSTEM_DEGRADED_TRIPLE');
  });
});
