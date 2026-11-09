/**
 * வழித்துணை (Vazhithunai) - Threat Taxonomy Normalization
 * Strictly filters and maps threats to real-world Indian street threat classes.
 */
import { ThreatClass } from './types.js';
/**
 * Normalizes input detection class name.
 * Returns valid ThreatClass or null if the object is peripheral clutter or unapproved class.
 */
export declare function normalizeThreatClass(rawClass: string): ThreatClass | null;
/**
 * Checks whether a class is a valid threat.
 */
export declare function isValidThreatClass(rawClass: string): boolean;
//# sourceMappingURL=taxonomy.d.ts.map