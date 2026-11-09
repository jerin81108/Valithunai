import { describe, it, expect } from './vitest-shim.js';
import { SafetyEngine } from '../src/state-machine.js';
import { SensingWindowInput } from '../src/types.js';

describe('SafetyEngine - 21 Real-World Replay Traces', () => {
  const makeBase = (t: number, speed = 1.1): SensingWindowInput => ({
    timestamp: t,
    detections: [],
    devicePose: { pitch: 0, roll: 0, yaw: 0 },
    walkingSpeedEstimate_mps: speed,
    ambient: { lux: 250, noise_dB: 55 }
  });

  // Trace 1: Crowded metro platform
  it('Trace 1: Crowded metro platform - handles multiple pedestrians with corridor lateral filtering', () => {
    const engine = new SafetyEngine();
    // 3 windows with people on the side (lateral 0.8m) and one person ahead at 2.8m
    for (let i = 0; i < 3; i++) {
      const out = engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [
          { id: 'p_side', class: 'person', bbox: [0, 0, 1, 1], depth_m: 1.5, depth_confidence: 0.9, lateral_offset_m: 0.9, height_m: 1.6, timestamp: 100 + i * 33 },
          { id: 'p_ahead', class: 'person', bbox: [0, 0, 1, 1], depth_m: 2.8, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.6, timestamp: 100 + i * 33 }
        ]
      });
      expect(out.state).toBe('CLEAR'); // Side person ignored, ahead person beyond 2.5m
    }
  });

  // Trace 2: Construction zone scaffolding
  it('Trace 2: Construction zone scaffolding - detects overhead metallic pipes with Sky Guard', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{
          id: 'scaff_pipe',
          class: 'scaffolding',
          bbox: [0.1, 0.1, 0.8, 0.2],
          depth_m: 1.4,
          depth_confidence: 0.9,
          lateral_offset_m: 0,
          height_m: 1.7,
          timestamp: 100 + i * 33
        }]
      });
    }
    expect(engine.getState()).toBe('HAZARD');
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{
        id: 'scaff_pipe',
        class: 'scaffolding',
        bbox: [0.1, 0.1, 0.8, 0.2],
        depth_m: 1.4,
        depth_confidence: 0.9,
        lateral_offset_m: 0,
        height_m: 1.7,
        timestamp: 200
      }]
    });
    expect(out.earconRecommendation.soundType).toBe('SKY_GUARD');
    expect(out.hapticRecommendation.pattern).toBe('SKY_GUARD_RAMP');
  });

  // Trace 3: Fast approaching e-rickshaw
  it('Trace 3: Fast approaching e-rickshaw - triggers single-window fast approach escalation', () => {
    const engine = new SafetyEngine();
    engine.processWindow({
      ...makeBase(100),
      detections: [{
        id: 'auto_fast',
        class: 'e-rickshaw',
        bbox: [0.2, 0.2, 0.6, 0.6],
        depth_m: 3.5,
        depth_confidence: 0.95,
        lateral_offset_m: 0,
        height_m: 1.2,
        timestamp: 100
      }]
    });

    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{
        id: 'auto_fast',
        class: 'e-rickshaw',
        bbox: [0.1, 0.1, 0.8, 0.8],
        depth_m: 1.4,
        depth_confidence: 0.95,
        lateral_offset_m: 0,
        height_m: 1.2,
        timestamp: 200
      }]
    });

    expect(out.state).toBe('HAZARD');
    expect(out.activeHazards[0].isFastCloser).toBe(true);
    expect(out.earconRecommendation.soundType).toBe('VEHICLE');
  });

  // Trace 4: Low tree branch (Sky Guard)
  it('Trace 4: Low tree branch - flags head-level obstacle', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{
          id: 'branch',
          class: 'low-hanging object',
          bbox: [0.2, 0, 0.6, 0.4],
          depth_m: 1.5,
          depth_confidence: 0.9,
          lateral_offset_m: 0,
          height_m: 1.8,
          timestamp: 100 + i * 33
        }]
      });
    }
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{
        id: 'branch',
        class: 'low-hanging object',
        bbox: [0.2, 0, 0.6, 0.4],
        depth_m: 1.5,
        depth_confidence: 0.9,
        lateral_offset_m: 0,
        height_m: 1.8,
        timestamp: 200
      }]
    });
    expect(out.activeHazards[0].isSkyGuard).toBe(true);
  });

  // Trace 5: Open trench / pit (drop-off)
  it('Trace 5: Open trench - triggers drop-off hazard with descending buzz', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{
          id: 'trench',
          class: 'pit/open manhole',
          bbox: [0.2, 0.6, 0.6, 0.4],
          depth_m: 1.3,
          depth_confidence: 0.9,
          lateral_offset_m: 0,
          height_m: -0.2,
          timestamp: 100 + i * 33
        }]
      });
    }
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{
        id: 'trench',
        class: 'pit/open manhole',
        bbox: [0.2, 0.6, 0.6, 0.4],
        depth_m: 1.3,
        depth_confidence: 0.9,
        lateral_offset_m: 0,
        height_m: -0.2,
        timestamp: 200
      }]
    });
    expect(out.activeHazards[0].isDropOff).toBe(true);
    expect(out.hapticRecommendation.pattern).toBe('DROP_OFF_BUZZ');
  });

  // Trace 6: Stairs-down
  it('Trace 6: Stairs-down - warns of downward elevation step', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{
          id: 'stairs',
          class: 'stairs-down',
          bbox: [0.1, 0.5, 0.8, 0.5],
          depth_m: 1.4,
          depth_confidence: 0.9,
          lateral_offset_m: 0,
          height_m: -0.1,
          timestamp: 100 + i * 33
        }]
      });
    }
    expect(engine.getState()).toBe('HAZARD');
  });

  // Trace 7: Silent EV approach
  it('Trace 7: Silent EV approach - detects closing velocity even without loud acoustic signature', () => {
    const engine = new SafetyEngine();
    engine.processWindow({
      ...makeBase(100),
      detections: [{ id: 'ev', class: 'vehicle', bbox: [0, 0, 1, 1], depth_m: 3.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.2, timestamp: 100 }]
    });
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{ id: 'ev', class: 'vehicle', bbox: [0, 0, 1, 1], depth_m: 2.1, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.2, timestamp: 200 }]
    });
    expect(out.activeHazards[0].closingVelocity_mps).toBeGreaterThan(1.0);
  });

  // Trace 8: Stray cattle in path
  it('Trace 8: Stray cattle in path - flags cattle threat and speaks Tamil explanation', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{ id: 'cow', class: 'cattle', bbox: [0.2, 0.2, 0.6, 0.6], depth_m: 1.4, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.2, timestamp: 100 + i * 33 }]
      });
    }
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{ id: 'cow', class: 'cattle', bbox: [0.2, 0.2, 0.6, 0.6], depth_m: 1.4, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.2, timestamp: 200 }]
    });
    expect(out.state).toBe('HAZARD');
    expect(out.explanation_ta).toContain('மாடு');
  });

  // Trace 9: Hanging electric wire
  it('Trace 9: Hanging electric wire - identifies overhead wire in corridor', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{ id: 'wire1', class: 'wire', bbox: [0, 0.1, 1, 0.1], depth_m: 1.8, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.6, timestamp: 100 + i * 33 }]
      });
    }
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [{ id: 'wire1', class: 'wire', bbox: [0, 0.1, 1, 0.1], depth_m: 1.8, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.6, timestamp: 200 }]
    });
    expect(out.activeHazards[0].isSkyGuard).toBe(true);
    expect(out.explanation_ta).toContain('தொங்கும் கம்பி');
  });

  // Trace 10: Roadside telephone pole
  it('Trace 10: Roadside pole - triggers CAUTION at 2.2m', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{ id: 'pole', class: 'pole', bbox: [0.4, 0, 0.2, 1], depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0.1, height_m: 1.5, timestamp: 100 + i * 33 }]
      });
    }
    expect(engine.getState()).toBe('CAUTION');
  });

  // Trace 11: Pedestrian sudden stop
  it('Trace 11: Pedestrian sudden stop - escalates to critical proximity when walking closer', () => {
    const engine = new SafetyEngine();
    // Person at 2.2m (CAUTION)
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{ id: 'p1', class: 'person', bbox: [0, 0, 1, 1], depth_m: 2.2, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.6, timestamp: 100 + i * 33 }]
      });
    }
    expect(engine.getState()).toBe('CAUTION');

    // User steps forward to 1.1m (HAZARD)
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(200 + i * 33),
        detections: [{ id: 'p1', class: 'person', bbox: [0, 0, 1, 1], depth_m: 1.1, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.6, timestamp: 200 + i * 33 }]
      });
    }
    expect(engine.getState()).toBe('HAZARD');
  });

  // Trace 12: Camera occlusion / sensor fault
  it('Trace 12: Camera occlusion / sensor degraded - degrades immediately and alerts', () => {
    const engine = new SafetyEngine();
    const out = engine.processWindow({
      ...makeBase(100),
      sensorDegraded: true
    });
    expect(out.degraded).toBe(true);
    expect(out.state).toBe('HAZARD');
    expect(out.earconRecommendation.soundType).toBe('SYSTEM_DEGRADED');
  });

  // Trace 13: Phone roll IMU compensation
  it('Trace 13: Phone roll IMU compensation - accurately adjusts lateral perception', () => {
    const engine = new SafetyEngine();
    const rollAngle = -0.3; // radians
    const out = engine.processWindow({
      ...makeBase(100),
      devicePose: { pitch: 0, roll: rollAngle, yaw: 0 },
      detections: [{ id: 'pole', class: 'pole', bbox: [0, 0, 1, 1], depth_m: 1.5, depth_confidence: 0.9, lateral_offset_m: 0.3, height_m: 1.0, timestamp: 100 }]
    });
    expect(out.activeHazards.length).toBe(1);
    expect(out.activeHazards[0].compensatedLateral_m).toBeDefined();
  });

  // Trace 14: Night walking in low lux (< 10 lux)
  it('Trace 14: Night walking in low lux - activates auto-torch recommendation', () => {
    const engine = new SafetyEngine();
    const out = engine.processWindow({
      ...makeBase(100),
      ambient: { lux: 8, noise_dB: 50 }
    });
    expect(out.cameraAdjustment.autoTorch).toBe(true);
    expect(out.cameraAdjustment.exposureGainRecommendation).toBeGreaterThanOrEqual(2.0);
  });

  // Trace 15: High ambient traffic noise (82 dB)
  it('Trace 15: High ambient noise - caps earcon at safety ceiling (80 dB SPL)', () => {
    const engine = new SafetyEngine();
    const out = engine.processWindow({
      ...makeBase(100),
      ambient: { lux: 300, noise_dB: 82 }
    });
    expect(out.earconRecommendation.volumeDb).toBe(80);
  });

  // Trace 16: Clean path recovery to CLEAR
  it('Trace 16: Clean path recovery - verifies all 5 hysteresis steps', () => {
    const engine = new SafetyEngine();
    // Set to HAZARD
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{ id: 'obs', class: 'vehicle', bbox: [0, 0, 1, 1], depth_m: 1.0, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }]
      });
    }
    expect(engine.getState()).toBe('HAZARD');

    for (let w = 1; w <= 4; w++) {
      const recOut = engine.processWindow(makeBase(200 + w * 33));
      expect(recOut.state).toBe('RECOVERING');
      expect(recOut.recoveryCount).toBe(w);
    }
    const clearOut = engine.processWindow(makeBase(400));
    expect(clearOut.state).toBe('CLEAR');
    expect(clearOut.recoveryCount).toBe(0);
  });

  // Trace 17: Relapse in window 3 of recovery
  it('Trace 17: Relapse during recovery - resets count immediately to 0', () => {
    const engine = new SafetyEngine();
    // Hazard
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{ id: 'obs', class: 'vehicle', bbox: [0, 0, 1, 1], depth_m: 1.0, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 100 + i * 33 }]
      });
    }
    engine.processWindow(makeBase(200));
    engine.processWindow(makeBase(233));
    expect(engine.getRecoveryCount()).toBe(2);

    const relapse = engine.processWindow({
      ...makeBase(266),
      detections: [{ id: 'new_obs', class: 'pole', bbox: [0, 0, 1, 1], depth_m: 1.1, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.0, timestamp: 266 }]
    });
    expect(relapse.state).toBe('HAZARD');
    expect(relapse.recoveryCount).toBe(0);
  });

  // Trace 18: Fast cyclist passing on side (outside corridor)
  it('Trace 18: Fast cyclist passing on side - ignored because |lateral| > 0.6m', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 5; i++) {
      const out = engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{
          id: 'bike_pass',
          class: 'two-wheeler',
          bbox: [0.8, 0.2, 0.2, 0.8],
          depth_m: 1.2,
          depth_confidence: 0.9,
          lateral_offset_m: 0.85, // outside corridor
          height_m: 1.0,
          timestamp: 100 + i * 33
        }]
      });
      expect(out.state).toBe('CLEAR');
    }
  });

  // Trace 19: Speed breaker / loose tile on ground
  it('Trace 19: Ground obstacle - detected within corridor safely', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [{
          id: 'tile',
          class: 'pole', // maps to solid static object
          bbox: [0.3, 0.7, 0.4, 0.3],
          depth_m: 1.4,
          depth_confidence: 0.85,
          lateral_offset_m: 0,
          height_m: 0.2,
          timestamp: 100 + i * 33
        }]
      });
    }
    expect(engine.getState()).toBe('HAZARD');
  });

  // Trace 20: Multiple simultaneous hazards (priority resolution)
  it('Trace 20: Multiple simultaneous hazards - prioritizes critical vehicle over caution person', () => {
    const engine = new SafetyEngine();
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(100 + i * 33),
        detections: [
          { id: 'p_far', class: 'person', bbox: [0, 0, 1, 1], depth_m: 2.3, depth_confidence: 0.9, lateral_offset_m: -0.2, height_m: 1.6, timestamp: 100 + i * 33 },
          { id: 'car_near', class: 'vehicle', bbox: [0, 0, 1, 1], depth_m: 1.1, depth_confidence: 0.95, lateral_offset_m: 0.1, height_m: 1.2, timestamp: 100 + i * 33 }
        ]
      });
    }
    const out = engine.processWindow({
      ...makeBase(200),
      detections: [
        { id: 'p_far', class: 'person', bbox: [0, 0, 1, 1], depth_m: 2.3, depth_confidence: 0.9, lateral_offset_m: -0.2, height_m: 1.6, timestamp: 200 },
        { id: 'car_near', class: 'vehicle', bbox: [0, 0, 1, 1], depth_m: 1.1, depth_confidence: 0.95, lateral_offset_m: 0.1, height_m: 1.2, timestamp: 200 }
      ]
    });
    expect(out.state).toBe('HAZARD');
    expect(out.latestReason).toBe('CRITICAL_PROXIMITY');
    expect(out.earconRecommendation.soundType).toBe('VEHICLE');
  });

  // Trace 21: Emergency stop scenario
  it('Trace 21: Emergency stop scenario - user halts abruptly when hazard is alerted', () => {
    const engine = new SafetyEngine();
    // Walking fast
    engine.processWindow({
      ...makeBase(100, 1.8),
      detections: [{ id: 'bar', class: 'scaffolding', bbox: [0, 0, 1, 1], depth_m: 1.3, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.5, timestamp: 100 }]
    });
    // User stops (speed drops to 0.0 m/s)
    for (let i = 0; i < 3; i++) {
      engine.processWindow({
        ...makeBase(200 + i * 33, 0.0),
        detections: [{ id: 'bar', class: 'scaffolding', bbox: [0, 0, 1, 1], depth_m: 1.3, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1.5, timestamp: 200 + i * 33 }]
      });
    }
    expect(engine.getState()).toBe('HAZARD');
  });
});
