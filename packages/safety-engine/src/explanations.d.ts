/**
 * வழித்துணை (Vazhithunai) - Spoken Explainability ("ஏன்?" / "Why?")
 * Deterministic generation of natural Tamil and English safety verdict explanations.
 */
import { ReasonCode, Detection } from './types.js';
export declare function generateExplanation(reason: ReasonCode, hazard?: Detection, closingVelocity_mps?: number): {
    ta: string;
    en: string;
};
//# sourceMappingURL=explanations.d.ts.map