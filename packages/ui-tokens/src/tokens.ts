/**
 * வழித்துணை (Vazhithunai) – UI Tokens ("Kolam Night")
 * Low-vision first design language with AAA / 7:1 contrast.
 */

export const COLORS = {
  // Brand Palette
  indigoNight: '#0B1B3A',
  turmeric: '#FFB300',
  kolamWhite: '#FFFFFF',

  // Safety State Colors
  neemGreen: '#1FA45B',     // CLEAR
  amber: '#FFB300',         // CAUTION
  chilliRed: '#E5322D',     // HAZARD
  peacockTeal: '#00A6A6',   // RECOVERING

  // Neutral tones
  deepNavy: '#060F22',
  cardSurface: '#12244A',
  cardBorder: '#233868',
  subtleText: '#CBD5E1',
  highContrastYellow: '#FFE500',
  highContrastBlack: '#000000'
} as const;

export const STATE_SHAPES = {
  CLEAR: {
    shape: 'circle',
    svgPath: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z',
    tamilLabel: 'தெளிவு',
    englishLabel: 'CLEAR'
  },
  CAUTION: {
    shape: 'triangle',
    svgPath: 'M 50 15 L 90 85 L 10 85 Z',
    tamilLabel: 'எச்சரிக்கை',
    englishLabel: 'CAUTION'
  },
  HAZARD: {
    shape: 'octagon',
    svgPath: 'M 30 10 L 70 10 L 90 30 L 90 70 L 70 90 L 30 90 L 10 70 L 10 30 Z',
    tamilLabel: 'ஆபத்து',
    englishLabel: 'HAZARD'
  },
  RECOVERING: {
    shape: 'ring',
    svgPath: 'M 50 20 A 30 30 0 1 0 50 80 A 30 30 0 1 0 50 20 Z',
    tamilLabel: 'சீராகிறது',
    englishLabel: 'RECOVERING'
  }
} as const;

export const TYPOGRAPHY = {
  fontFamily: "'Anek Tamil', 'Noto Sans Tamil', system-ui, -apple-system, sans-serif",
  fontSize: {
    minimum: '16px',
    body: '18px',
    large: '22px',
    title: '28px',
    headline: '36px',
    hero: '48px'
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    loose: 1.75
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    bold: '700',
    black: '900'
  }
} as const;

export const TOUCH_TARGETS = {
  minWidth: '56px',
  minHeight: '56px',
  padding: '16px',
  spacing: '16px'
} as const;

export const MOTION = {
  earconSyncToleranceMs: 10,
  maxFlashHz: 3.0, // Photosensitive seizure safe ceiling (< 3 Hz)
  cautionPulseDurationMs: 500, // 2 Hz
  hazardPulseDurationMs: 167   // 6 Hz
} as const;

