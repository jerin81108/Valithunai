/**
 * வழித்துணை (Vazhithunai) - Ambient Adaptation Engine
 * Regulates audio loudness safety floor/ceiling and camera low-light auto-torch.
 */
const SAFETY_FLOOR_DB = 65;
const SAFETY_CEILING_DB = 80;
const SIGNAL_TO_NOISE_OFFSET_DB = 5;
/**
 * Computes safe earcon volume and camera exposure based on ambient acoustics and illumination.
 */
export function evaluateAmbient(ambient) {
    const noise = Number.isFinite(ambient?.noise_dB) ? ambient.noise_dB : 55;
    const lux = Number.isFinite(ambient?.lux) ? ambient.lux : 200;
    // Earcon volume target: ambient noise + 5dB, clamped between 65 dB and 80 dB SPL
    let earconVolumeDb = Math.max(SAFETY_FLOOR_DB, noise + SIGNAL_TO_NOISE_OFFSET_DB);
    earconVolumeDb = Math.min(SAFETY_CEILING_DB, earconVolumeDb);
    // Camera exposure gain & auto-torch
    let exposureGain = 1.0;
    let autoTorch = false;
    if (lux < 15) {
        exposureGain = 2.5;
        autoTorch = true;
    }
    else if (lux < 60) {
        exposureGain = 1.6;
        autoTorch = false;
    }
    else if (lux < 150) {
        exposureGain = 1.2;
        autoTorch = false;
    }
    return {
        earconVolumeDb: Number(earconVolumeDb.toFixed(1)),
        cameraAdjustment: {
            exposureGainRecommendation: exposureGain,
            autoTorch
        }
    };
}
//# sourceMappingURL=ambient.js.map