/**
 * வழித்துணை (Vazhithunai) - Black-Box Ring Buffer Recorder
 * Deterministic local ring-buffer of engine inputs and outputs for the last 60 seconds.
 * 100% On-device, privacy-preserving (no camera frames stored).
 */

import { SensingWindowInput, EngineOutput } from './types.js';

export interface BlackBoxRecord {
  timestamp: number;
  input: SensingWindowInput;
  output: EngineOutput;
}

export class BlackBoxRecorder {
  private buffer: BlackBoxRecord[];
  private maxCapacity: number;
  private head: number;
  private count: number;

  /**
   * @param maxCapacity Maximum number of entries to retain (default 3600 = 60s @ 60 FPS)
   */
  constructor(maxCapacity = 3600) {
    this.maxCapacity = Math.max(1, maxCapacity);
    this.buffer = new Array(this.maxCapacity);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Records a single tick into the ring buffer.
   */
  public record(input: SensingWindowInput, output: EngineOutput): void {
    this.buffer[this.head] = {
      timestamp: input.timestamp,
      input,
      output
    };
    this.head = (this.head + 1) % this.maxCapacity;
    if (this.count < this.maxCapacity) {
      this.count++;
    }
  }

  /**
   * Returns all recorded entries chronologically.
   */
  public getChronologicalRecords(): BlackBoxRecord[] {
    const result: BlackBoxRecord[] = [];
    const start = this.count === this.maxCapacity ? this.head : 0;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.maxCapacity;
      if (this.buffer[idx]) {
        result.push(this.buffer[idx]);
      }
    }
    return result;
  }

  /**
   * Returns the last N seconds of records based on injected timestamps.
   */
  public getRecentSeconds(seconds = 60): BlackBoxRecord[] {
    const all = this.getChronologicalRecords();
    if (all.length === 0) return [];
    const latestTimestamp = all[all.length - 1].timestamp;
    const cutoff = latestTimestamp - (seconds * 1000);
    return all.filter(r => r.timestamp >= cutoff);
  }

  /**
   * Exports sanitized JSON trace string.
   */
  public exportTraceJson(): string {
    return JSON.stringify(this.getChronologicalRecords(), null, 2);
  }

  /**
   * Clears the recorder buffer.
   */
  public clear(): void {
    this.buffer = new Array(this.maxCapacity);
    this.head = 0;
    this.count = 0;
  }

  public get size(): number {
    return this.count;
  }
}
