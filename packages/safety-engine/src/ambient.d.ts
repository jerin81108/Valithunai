/**
 * வழித்துணை (Vazhithunai) - Ambient Adaptation Engine
 * Regulates audio loudness safety floor/ceiling and camera low-light auto-torch.
 */
import { AmbientConditions, CameraAdjustment } from './types.js';
export interface AmbientAdaptationResult {
    earconVolumeDb: number;
    cameraAdjustment: CameraAdjustment;
}
/**
 * Computes safe earcon volume and camera exposure based on ambient acoustics and illumination.
 */
export declare function evaluateAmbient(ambient: AmbientConditions): AmbientAdaptationResult;
//# sourceMappingURL=ambient.d.ts.map