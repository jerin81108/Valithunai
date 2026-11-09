import { describe, it, expect } from './vitest-shim.js';
import { SafetyEngine } from '../src/state-machine.js';
import { sanitizeDetection } from '../src/validator.js';

describe('SafetyEngine - Fuzz Robustness & Fault Tolerance', () => {
  it('gracefully sanitizes NaN, null, negative depths without throwing', () => {
    const dirtyInputs = [
      { id: '1', class: 'vehicle', depth_m: NaN, depth_confidence: 0.9, lateral_offset_m: 0, height_m: 1 },
      { id: '2', class: 'vehicle', depth_m: null, depth_confidence: null, lateral_offset_m: NaN, height_m: undefined },
      { id: '3', class: 'vehicle', depth_m: -5.0, depth_confidence: -1.0, lateral_offset_m: null, height_m: NaN },
      { id: '4', class: null, depth_m: Infinity, depth_confidence: 2.5, lateral_offset_m: -Infinity, height_m: null },
      { id: null, class: undefined, depth_m: undefined, depth_confidence: NaN, lateral_offset_m: undefined, height_m: -10 },
      {}
    ];

    for (let i = 0; i < dirtyInputs.length; i++) {
      expect(() => {
        const result = sanitizeDetection(dirtyInputs[i], i);
        expect(Number.isFinite(result.detection.depth_m)).toBe(true);
        expect(result.detection.depth_m).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.detection.depth_confidence)).toBe(true);
        expect(result.detection.depth_confidence).toBeLessThanOrEqual(1.0);
        expect(Number.isFinite(result.detection.lateral_offset_m)).toBe(true);
        expect(Number.isFinite(result.detection.height_m)).toBe(true);
      }).not.toThrow();
    }
  });

  it('engine processes 500 rounds of extreme fuzz vectors without throwing', () => {
    const engine = new SafetyEngine();

    const fuzzTokens = [
      NaN,
      null,
      undefined,
      -Infinity,
      Infinity,
      -999999,
      999999,
      0,
      -0,
      "",
      {},
      [],
      "garbage_class_string",
      true,
      false
    ];

    for (let round = 0; round < 500; round++) {
      const pick = () => fuzzTokens[Math.floor(Math.random() * fuzzTokens.length)];

      const fuzzedInput: any = {
        timestamp: 1000 + round * 33,
        detections: [
          {
            id: pick(),
            class: pick(),
            bbox: [pick(), pick(), pick(), pick()],
            depth_m: pick(),
            depth_confidence: pick(),
            lateral_offset_m: pick(),
            height_m: pick(),
            timestamp: pick()
          }
        ],
        devicePose: {
          pitch: pick(),
          roll: pick(),
          yaw: pick()
        },
        walkingSpeedEstimate_mps: pick(),
        ambient: {
          lux: pick(),
          noise_dB: pick()
        },
        cameraStalled: pick(),
        sensorDegraded: pick()
      };

      expect(() => {
        const output = engine.processWindow(fuzzedInput);
        expect(output).toBeDefined();
        expect(typeof output.state).toBe('string');
        expect(output.earconRecommendation).toBeDefined();
        expect(output.hapticRecommendation).toBeDefined();
      }).not.toThrow();
    }
  });

  it('handles completely corrupt or null sensing window by degrading loudly', () => {
    const engine = new SafetyEngine();
    const result = engine.processWindow(null as any);

    expect(result.degraded).toBe(true);
    expect(result.state).toBe('HAZARD');
    expect(result.earconRecommendation.soundType).toBe('SYSTEM_DEGRADED');
  });
});
