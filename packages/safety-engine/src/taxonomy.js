/**
 * வழித்துணை (Vazhithunai) - Threat Taxonomy Normalization
 * Strictly filters and maps threats to real-world Indian street threat classes.
 */
import { THREAT_TAXONOMY } from './types.js';
const ALIAS_MAP = {
    // Vehicle family
    'vehicle': 'vehicle',
    'car': 'vehicle',
    'truck': 'vehicle',
    'bus': 'vehicle',
    'van': 'vehicle',
    'ev': 'vehicle',
    // Two-wheeler family
    'two-wheeler': 'two-wheeler',
    'motorcycle': 'two-wheeler',
    'scooter': 'two-wheeler',
    'bicycle': 'two-wheeler',
    'bike': 'two-wheeler',
    // Auto / e-rickshaw
    'e-rickshaw': 'e-rickshaw',
    'auto': 'e-rickshaw',
    'autorickshaw': 'e-rickshaw',
    'tuk-tuk': 'e-rickshaw',
    'erickshaw': 'e-rickshaw',
    // Pole
    'pole': 'pole',
    'post': 'pole',
    'street_light': 'pole',
    'lamp_post': 'pole',
    'bollard': 'pole',
    'pillar': 'pole',
    // Pit / Open Manhole
    'pit/open manhole': 'pit/open manhole',
    'manhole': 'pit/open manhole',
    'open_manhole': 'pit/open manhole',
    'pit': 'pit/open manhole',
    'pothole': 'pit/open manhole',
    'trench': 'pit/open manhole',
    'open_drain': 'pit/open manhole',
    // Stairs-down / Drop-off
    'stairs-down': 'stairs-down',
    'stairs': 'stairs-down',
    'staircase_down': 'stairs-down',
    'drop_off': 'stairs-down',
    'curb': 'stairs-down',
    // Scaffolding
    'scaffolding': 'scaffolding',
    'scaffold': 'scaffolding',
    'construction_bar': 'scaffolding',
    // Low-hanging object (head/chest level)
    'low-hanging object': 'low-hanging object',
    'branch': 'low-hanging object',
    'tree_branch': 'low-hanging object',
    'signboard': 'low-hanging object',
    'awning': 'low-hanging object',
    'hanging_board': 'low-hanging object',
    // Cattle
    'cattle': 'cattle',
    'cow': 'cattle',
    'buffalo': 'cattle',
    'bull': 'cattle',
    'ox': 'cattle',
    // Person
    'person': 'person',
    'pedestrian': 'person',
    // Wire
    'wire': 'wire',
    'cable': 'wire',
    'hanging_wire': 'wire',
    'hanging_cable': 'wire',
    'electric_wire': 'wire'
};
/**
 * Normalizes input detection class name.
 * Returns valid ThreatClass or null if the object is peripheral clutter or unapproved class.
 */
export function normalizeThreatClass(rawClass) {
    if (!rawClass || typeof rawClass !== 'string')
        return null;
    const cleaned = rawClass.trim().toLowerCase();
    // Direct taxonomy check
    if (THREAT_TAXONOMY.includes(cleaned)) {
        return cleaned;
    }
    // Alias lookup
    if (cleaned in ALIAS_MAP) {
        return ALIAS_MAP[cleaned];
    }
    return null;
}
/**
 * Checks whether a class is a valid threat.
 */
export function isValidThreatClass(rawClass) {
    return normalizeThreatClass(rawClass) !== null;
}
//# sourceMappingURL=taxonomy.js.map