/**
 * வழித்துணை (Vazhithunai) - Spoken Explainability ("ஏன்?" / "Why?")
 * Deterministic generation of natural Tamil and English safety verdict explanations.
 */

import { ReasonCode, Detection, ThreatClass } from './types.js';

const TAMIL_CLASS_NAMES: Record<ThreatClass, string> = {
  'vehicle': 'வாகனம்',
  'two-wheeler': 'இருசக்கர வாகனம்',
  'e-rickshaw': 'ஆட்டோ',
  'pole': 'மின் கம்பம்',
  'pit/open manhole': 'திறந்த குழி',
  'stairs-down': 'கீழ்நோக்கி இறங்கும் படிகள்',
  'scaffolding': 'கட்டுமான சாரக்கட்டு',
  'low-hanging object': 'தாழ்வான பொருள்',
  'cattle': 'மாடு',
  'person': 'மனிதர்',
  'wire': 'தொங்கும் கம்பி'
};

const ENGLISH_CLASS_NAMES: Record<ThreatClass, string> = {
  'vehicle': 'Vehicle',
  'two-wheeler': 'Two-wheeler',
  'e-rickshaw': 'E-rickshaw',
  'pole': 'Pole',
  'pit/open manhole': 'Open manhole or pit',
  'stairs-down': 'Stairs going down',
  'scaffolding': 'Scaffolding',
  'low-hanging object': 'Low-hanging object',
  'cattle': 'Cattle',
  'person': 'Person',
  'wire': 'Hanging wire'
};

function getDirectionDescription(lateral_m: number): { ta: string; en: string } {
  if (lateral_m > 0.15) {
    return { ta: 'வலப்புறம் இருந்து', en: 'from the right' };
  } else if (lateral_m < -0.15) {
    return { ta: 'இடப்புறம் இருந்து', en: 'from the left' };
  }
  return { ta: 'நேராக முன்னால்', en: 'directly ahead' };
}

export function generateExplanation(
  reason: ReasonCode,
  hazard?: Detection,
  closingVelocity_mps?: number
): { ta: string; en: string } {
  if (reason === 'CORRIDOR_CLEAR') {
    return {
      ta: 'பாதை முற்றிலும் பாதுகாப்பாக உள்ளது.',
      en: 'Path is clear ahead.'
    };
  }

  if (reason === 'RECOVERING_HYSTERESIS') {
    return {
      ta: 'பாதை சீராகிறது, அமைதியாக தொடருங்கள்.',
      en: 'Path is stabilizing, proceed with care.'
    };
  }

  if (reason === 'SYSTEM_DEGRADED_CAMERA_STALL') {
    return {
      ta: 'கணினி எச்சரிக்கை: கேமரா இயக்கம் தடைபட்டது!',
      en: 'System degraded: Camera feed stalled!'
    };
  }

  if (reason === 'SYSTEM_DEGRADED_SENSOR_FAULT' || reason === 'SYSTEM_DEGRADED_INVALID_DEPTH') {
    return {
      ta: 'கணினி எச்சரிக்கை: சென்சார் தரவு பிழை ஏற்பட்டது!',
      en: 'System degraded: Sensor data corrupted!'
    };
  }

  if (!hazard) {
    return {
      ta: 'முன்னால் ஆபத்து கண்டறியப்பட்டது.',
      en: 'Hazard detected ahead.'
    };
  }

  const rawClass = (hazard.class as ThreatClass) || 'vehicle';
  const taClass = TAMIL_CLASS_NAMES[rawClass] || rawClass;
  const enClass = ENGLISH_CLASS_NAMES[rawClass] || rawClass;
  const dist = hazard.depth_m.toFixed(1);
  const dir = getDirectionDescription(hazard.lateral_offset_m);

  if (reason === 'SKY_GUARD_HEAD_HAZARD') {
    return {
      ta: `தலைக்கு மேலே ${taClass} ${dist} மீட்டரில் உள்ளது. குனிந்து செல்லவும்.`,
      en: `Overhead ${enClass.toLowerCase()} detected at ${dist} meters. Watch your head.`
    };
  }

  if (reason === 'DROP_OFF_HAZARD') {
    return {
      ta: `கவனம்! ${dir.ta} ${taClass} ${dist} மீட்டரில் உள்ளது. நில்லுங்கள்.`,
      en: `Caution! Drop-off: ${enClass} ${dist} meters ${dir.en}. Stop.`
    };
  }

  if (closingVelocity_mps && closingVelocity_mps > 0.5) {
    return {
      ta: `${dir.ta} ${taClass} ${dist} மீட்டரில் வேகமாக நெருங்குகிறது.`,
      en: `${enClass} rapidly approaching ${dir.en} at ${dist} meters.`
    };
  }

  return {
    ta: `${dir.ta} ${taClass} ${dist} மீட்டரில் உள்ளது.`,
    en: `${enClass} detected ${dist} meters ${dir.en}.`
  };
}

