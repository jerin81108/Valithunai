/**
 * வழித்துணை (Vazhithunai) - Haptics Engine
 * Web Vibration API and tactile patterns for non-visual hazard perception.
 */

import { HapticRecommendation } from '@vazhithunai/safety-engine';

export const HAPTIC_PATTERNS = {
  // Two light taps
  CAUTION_TWO_TAPS: [60, 80, 60],

  // Strong rapid pulses
  HAZARD_PULSES: [120, 50, 120, 50, 120],

  // Asymmetric directional pulses
  ASYMMETRIC_LEFT: [200, 50, 80],
  ASYMMETRIC_RIGHT: [80, 50, 200],

  // Rising ramp for overhead (Sky Guard)
  SKY_GUARD_RAMP: [30, 40, 60, 40, 100, 30, 150],

  // Long descending buzz for drop-offs
  DROP_OFF_BUZZ: [300, 80, 150],

  // Slow fading pulse for recovery
  RECOVERING_FADE: [90, 120, 40],

  // Triple-pulse repeated for system degradation
  SYSTEM_DEGRADED_TRIPLE: [250, 100, 250, 100, 250]
} as const;

export class HapticsEngine {
  private isEnabled = true;

  public vibrate(rec: HapticRecommendation): boolean {
    if (!this.isEnabled) return false;
    if (typeof window === 'undefined' || !navigator.vibrate) return false;

    let pattern: number[] = [];

    switch (rec.pattern) {
      case 'CAUTION_TWO_TAPS':
        pattern = [...HAPTIC_PATTERNS.CAUTION_TWO_TAPS];
        break;
      case 'HAZARD_PULSES':
        pattern = [...HAPTIC_PATTERNS.HAZARD_PULSES];
        break;
      case 'ASYMMETRIC_LEFT':
        pattern = [...HAPTIC_PATTERNS.ASYMMETRIC_LEFT];
        break;
      case 'ASYMMETRIC_RIGHT':
        pattern = [...HAPTIC_PATTERNS.ASYMMETRIC_RIGHT];
        break;
      case 'SKY_GUARD_RAMP':
        pattern = [...HAPTIC_PATTERNS.SKY_GUARD_RAMP];
        break;
      case 'DROP_OFF_BUZZ':
        pattern = [...HAPTIC_PATTERNS.DROP_OFF_BUZZ];
        break;
      case 'RECOVERING_FADE':
        pattern = [...HAPTIC_PATTERNS.RECOVERING_FADE];
        break;
      case 'SYSTEM_DEGRADED_TRIPLE':
        pattern = [...HAPTIC_PATTERNS.SYSTEM_DEGRADED_TRIPLE];
        break;
      default:
        pattern = [50];
    }

    // Scale duration with intensity (0.5 to 1.0)
    const scaled = pattern.map((ms, idx) => (idx % 2 === 0 ? Math.round(ms * Math.max(0.4, rec.intensity)) : ms));

    try {
      return navigator.vibrate(scaled);
    } catch {
      return false;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
  }

  public stop(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
  }
}

