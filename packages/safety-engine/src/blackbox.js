/**
 * வழித்துணை (Vazhithunai) - Black-Box Ring Buffer Recorder
 * Deterministic local ring-buffer of engine inputs and outputs for the last 60 seconds.
 * 100% On-device, privacy-preserving (no camera frames stored).
 */
export class BlackBoxRecorder {
    buffer;
    maxCapacity;
    head;
    count;
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
    record(input, output) {
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
    getChronologicalRecords() {
        const result = [];
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
    getRecentSeconds(seconds = 60) {
        const all = this.getChronologicalRecords();
        if (all.length === 0)
            return [];
        const latestTimestamp = all[all.length - 1].timestamp;
        const cutoff = latestTimestamp - (seconds * 1000);
        return all.filter(r => r.timestamp >= cutoff);
    }
    /**
     * Exports sanitized JSON trace string.
     */
    exportTraceJson() {
        return JSON.stringify(this.getChronologicalRecords(), null, 2);
    }
    /**
     * Clears the recorder buffer.
     */
    clear() {
        this.buffer = new Array(this.maxCapacity);
        this.head = 0;
        this.count = 0;
    }
    get size() {
        return this.count;
    }
}
//# sourceMappingURL=blackbox.js.map