import { describe, it, expect } from './vitest-shim.js';
import { BlackBoxRecorder } from '../src/blackbox.js';
import { SafetyEngine } from '../src/state-machine.js';
import { SensingWindowInput } from '../src/types.js';

describe('BlackBoxRecorder - Deterministic 60-second Ring Buffer', () => {
  it('records entries within bounded capacity and maintains chronological order', () => {
    const recorder = new BlackBoxRecorder(5); // small test buffer
    const engine = new SafetyEngine();

    for (let i = 0; i < 10; i++) {
      const input: SensingWindowInput = {
        timestamp: 1000 + i * 100,
        detections: [],
        devicePose: { pitch: 0, roll: 0, yaw: 0 },
        walkingSpeedEstimate_mps: 1.0,
        ambient: { lux: 200, noise_dB: 50 }
      };
      const output = engine.processWindow(input);
      recorder.record(input, output);
    }

    expect(recorder.size).toBe(5);
    const records = recorder.getChronologicalRecords();
    expect(records.length).toBe(5);
    // Oldest should be index 5 (timestamp 1500)
    expect(records[0].timestamp).toBe(1500);
    // Newest should be index 9 (timestamp 1900)
    expect(records[4].timestamp).toBe(1900);
  });

  it('slices recent seconds accurately', () => {
    const recorder = new BlackBoxRecorder(100);
    const engine = new SafetyEngine();

    for (let s = 0; s < 10; s++) {
      const input: SensingWindowInput = {
        timestamp: 10000 + s * 1000, // 10s spread
        detections: [],
        devicePose: { pitch: 0, roll: 0, yaw: 0 },
        walkingSpeedEstimate_mps: 1.0,
        ambient: { lux: 200, noise_dB: 50 }
      };
      const output = engine.processWindow(input);
      recorder.record(input, output);
    }

    // Last 3 seconds (timestamps >= 16000)
    const recent = recorder.getRecentSeconds(3);
    expect(recent.length).toBe(4); // 16000, 17000, 18000, 19000
    expect(recent[recent.length - 1].timestamp).toBe(19000);
  });

  it('exports valid deterministic JSON', () => {
    const recorder = new BlackBoxRecorder(10);
    const engine = new SafetyEngine();
    const input: SensingWindowInput = {
      timestamp: 1000,
      detections: [],
      devicePose: { pitch: 0, roll: 0, yaw: 0 },
      walkingSpeedEstimate_mps: 1.0,
      ambient: { lux: 200, noise_dB: 50 }
    };
    const output = engine.processWindow(input);
    recorder.record(input, output);

    const json = recorder.exportTraceJson();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed[0].timestamp).toBe(1000);
    expect(parsed[0].output.state).toBe('CLEAR');
  });
});
