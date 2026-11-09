import { describe, it, expect } from './vitest-shim.js';
import fc from 'fast-check';
import { SafetyEngine } from '../src/state-machine.js';
import { SensingWindowInput, Detection } from '../src/types.js';

describe('SafetyEngine - Property-Based Verification (fast-check)', () => {

  // Property 1: CLEAR is NEVER emitted within 5 windows of a HAZARD state
  it('Property 1: CLEAR is NEVER emitted within 5 windows of a HAZARD state', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 20, maxLength: 80 }), (hazardFlags) => {
        const engine = new SafetyEngine();
        let lastHazardWindowIndex = -999;
        let windowIndex = 0;
        let baseTime = 1000;

        for (const shouldHaveHazard of hazardFlags) {
          windowIndex++;
          baseTime += 33;

          const detections: Detection[] = shouldHaveHazard
            ? [{
                id: 'critical_obs',
                class: 'vehicle',
                bbox: [0.3, 0.3, 0.4, 0.4],
                depth_m: 1.0, // well inside critical threshold (< 1.5m)
                depth_confidence: 0.95,
                lateral_offset_m: 0,
                height_m: 1.0,
                timestamp: baseTime
              }]
            : [];

          const input: SensingWindowInput = {
            timestamp: baseTime,
            detections,
            devicePose: { pitch: 0, roll: 0, yaw: 0 },
            walkingSpeedEstimate_mps: 1.2,
            ambient: { lux: 200, noise_dB: 55 }
          };

          const output = engine.processWindow(input);

          if (output.state === 'HAZARD') {
            lastHazardWindowIndex = windowIndex;
          }

          if (output.state === 'CLEAR') {
            const windowsSinceHazard = windowIndex - lastHazardWindowIndex;
            // Must be at least 5 clean windows (hysteresis) since the hazard
            expect(windowsSinceHazard).toBeGreaterThanOrEqual(5);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 2: Purity & Determinism
  it('Property 2: The SafetyEngine is 100% deterministic and pure across identical input streams', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            hasHazard: fc.boolean(),
            depth: fc.double({ min: 0.5, max: 4.0, noNaN: true }),
            lateral: fc.double({ min: -0.8, max: 0.8, noNaN: true }),
            walkSpeed: fc.double({ min: 0.8, max: 2.0, noNaN: true }),
            lux: fc.double({ min: 10, max: 500, noNaN: true }),
            noise: fc.double({ min: 45, max: 85, noNaN: true })
          }),
          { minLength: 10, maxLength: 40 }
        ),
        (stream) => {
          const engineA = new SafetyEngine();
          const engineB = new SafetyEngine();

          let t = 100;
          for (const item of stream) {
            t += 33;
            const input: SensingWindowInput = {
              timestamp: t,
              detections: item.hasHazard
                ? [{
                    id: 'obs',
                    class: 'e-rickshaw',
                    bbox: [0.2, 0.2, 0.5, 0.5],
                    depth_m: item.depth,
                    depth_confidence: 0.9,
                    lateral_offset_m: item.lateral,
                    height_m: 1.0,
                    timestamp: t
                  }]
                : [],
              devicePose: { pitch: 0, roll: 0, yaw: 0 },
              walkingSpeedEstimate_mps: item.walkSpeed,
              ambient: { lux: item.lux, noise_dB: item.noise }
            };

            const outA = engineA.processWindow(input);
            const outB = engineB.processWindow(input);

            expect(outA.state).toBe(outB.state);
            expect(outA.latestReason).toBe(outB.latestReason);
            expect(outA.earconRecommendation).toEqual(outB.earconRecommendation);
            expect(outA.hapticRecommendation).toEqual(outB.hapticRecommendation);
            expect(outA.cameraAdjustment).toEqual(outB.cameraAdjustment);
            expect(outA.recoveryCount).toBe(outB.recoveryCount);
          }
        }
      ),
      { numRuns: 80 }
    );
  });

  // Property 3: State Domain Invariant
  it('Property 3: Engine state is always strictly one of CLEAR, CAUTION, HAZARD, RECOVERING', () => {
    const validStates = new Set(['CLEAR', 'CAUTION', 'HAZARD', 'RECOVERING']);
    const engine = new SafetyEngine();
    let time = 100;

    for (let i = 0; i < 50; i++) {
      time += 33;
      const input: SensingWindowInput = {
        timestamp: time,
        detections: Math.random() > 0.5 ? [{
          id: `obs_${i}`,
          class: 'person',
          bbox: [0, 0, 1, 1],
          depth_m: Math.random() * 3.0 + 0.5,
          depth_confidence: 0.9,
          lateral_offset_m: (Math.random() - 0.5) * 1.5,
          height_m: 1.5,
          timestamp: time
        }] : [],
        devicePose: { pitch: 0, roll: 0, yaw: 0 },
        walkingSpeedEstimate_mps: 1.2,
        ambient: { lux: 200, noise_dB: 60 }
      };

      const out = engine.processWindow(input);
      expect(validStates.has(out.state)).toBe(true);
      expect(out.recoveryCount).toBeGreaterThanOrEqual(0);
      expect(out.recoveryCount).toBeLessThanOrEqual(5);
    }
  });
});
