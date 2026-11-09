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
export declare class BlackBoxRecorder {
    private buffer;
    private maxCapacity;
    private head;
    private count;
    /**
     * @param maxCapacity Maximum number of entries to retain (default 3600 = 60s @ 60 FPS)
     */
    constructor(maxCapacity?: number);
    /**
     * Records a single tick into the ring buffer.
     */
    record(input: SensingWindowInput, output: EngineOutput): void;
    /**
     * Returns all recorded entries chronologically.
     */
    getChronologicalRecords(): BlackBoxRecord[];
    /**
     * Returns the last N seconds of records based on injected timestamps.
     */
    getRecentSeconds(seconds?: number): BlackBoxRecord[];
    /**
     * Exports sanitized JSON trace string.
     */
    exportTraceJson(): string;
    /**
     * Clears the recorder buffer.
     */
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=blackbox.d.ts.map