/**
 * வழித்துணை (Vazhithunai) - Web Audio Earcon Synthesizer
 * 80ms non-fatiguing earcons, spatial panning, hard safety limiter.
 */

import { EarconRecommendation } from '@vazhithunai/safety-engine';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private isMuted = false;
  private activeLoopInterval: any = null;

  constructor() {
    // Lazily initialized on first user gesture (browser requirement)
  }

  public async init(): Promise<void> {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // Hard limiter to guarantee loudness safety ceiling (< 80 dB SPL)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-6.0, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(3.0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(16.0, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.05, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Plays a single 80ms synthesized earcon based on engine recommendation.
   */
  public playEarcon(rec: EarconRecommendation): void {
    if (this.isMuted || !this.ctx || !this.limiter) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const duration = 0.080; // exactly 80 ms non-fatiguing pulse

    // Spatial Panner (-1.0 left to +1.0 right)
    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, rec.pan)), t);
    panner.connect(this.limiter);

    // Volume Gain Node (ambient noise adapted)
    const volumeGain = this.ctx.createGain();
    // Map volumeDb (65 to 80 dB) to gain 0.3 to 0.95
    const normalizedGain = Math.max(0.2, Math.min(0.95, (rec.volumeDb - 50) / 35));
    volumeGain.gain.setValueAtTime(normalizedGain, t);
    volumeGain.connect(panner);

    const pitch = Math.max(200, Math.min(2200, rec.pitchHz));

    switch (rec.soundType) {
      case 'VEHICLE': {
        // Low pulsed sawtooth with low-pass filter
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitch * 0.7, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t);

        osc.connect(filter);
        filter.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.001, t);
        volumeGain.gain.exponentialRampToValueAtTime(normalizedGain, t + 0.015);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
        break;
      }

      case 'SKY_GUARD': {
        // Overhead alert: rapid rising two-tone
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, t);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, t + duration);

        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.001, t);
        volumeGain.gain.exponentialRampToValueAtTime(normalizedGain, t + 0.01);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
        break;
      }

      case 'DROP_OFF': {
        // Drop-off / Pit alert: rapid descending chirp
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch * 1.3, t);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + duration);

        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.001, t);
        volumeGain.gain.exponentialRampToValueAtTime(normalizedGain, t + 0.01);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
        break;
      }

      case 'PERSON': {
        // Soft marimba-like warm sine
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, t);

        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(normalizedGain, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
        break;
      }

      case 'SETTLING': {
        // Recovery gentle falling tone
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);

        osc.connect(volumeGain);
        volumeGain.gain.setValueAtTime(0.3, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }

      case 'CLEAR_CHIME': {
        // Single gentle bell chime (D5 587.33Hz)
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t);

        osc.connect(volumeGain);
        volumeGain.gain.setValueAtTime(0.4, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.start(t);
        osc.stop(t + 0.25);
        break;
      }

      case 'SYSTEM_DEGRADED': {
        // Triple-pulse square degraded earcon
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);

        osc.connect(volumeGain);
        volumeGain.gain.setValueAtTime(0.6, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }

      default: {
        // Static click
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, t);
        osc.connect(volumeGain);

        volumeGain.gain.setValueAtTime(0.4, t);
        volumeGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
      }
    }
  }

  /**
   * Offline Tamil/English Text-to-Speech (speech synthesis API)
   */
  public speak(text: string, lang = 'ta-IN'): void {
    if (this.isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Duck previous narration
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick Tamil voice if installed
    const voices = window.speechSynthesis.getVoices();
    const tamilVoice = voices.find(v => v.lang.startsWith('ta'));
    if (tamilVoice) {
      utterance.voice = tamilVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  public stopAll(): void {
    if (this.activeLoopInterval) {
      clearInterval(this.activeLoopInterval);
      this.activeLoopInterval = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
