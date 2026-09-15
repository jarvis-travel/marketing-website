// ============================================================================
// JARVISTRAVEL MARKETING - FATIGUE INDEX SCALE
//
// The scale as the app shows it (web-app src/app/utils/fi.ts): three bands in
// the words (1-3 Chill, 4-6 Balanced, 7-9 Packed), and four colour steps in the
// chips, because 7 and 8 are amber and only 9, the peak, is red.
//
// `color` is the app's light token, used for tints and rings. `ink` is that
// colour darkened toward Neverything until a digit or word set in it reaches
// 4.5:1 on the colour's own 10% tint, over white and over Moonlight: the app's
// colours themselves measure 2.2 to 3.6:1 there.
// ============================================================================

export interface FiTone {
  color: string;
  ink: string;
}

const CHILL: FiTone = { color: '#0EA5E9', ink: '#106B95' };
const BALANCED: FiTone = { color: '#059669', ink: '#097152' };
const ELEVATED: FiTone = { color: '#CA8A04', ink: '#835E0D' };
const PEAK: FiTone = { color: '#D35446', ink: '#A3453B' };

/** The colour for one day's rating (the app's fiColorKey). */
export function fiToneForDay(day: number): FiTone {
  if (day <= 3) return CHILL;
  if (day <= 6) return BALANCED;
  if (day <= 8) return ELEVATED;
  return PEAK;
}

/** The three bands, each in the colour the app gives the band as a whole (fiTone: Packed is red). */
export const FI_BANDS: { word: 'Chill' | 'Balanced' | 'Packed'; days: number[]; tone: FiTone }[] = [
  { word: 'Chill', days: [1, 2, 3], tone: CHILL },
  { word: 'Balanced', days: [4, 5, 6], tone: BALANCED },
  { word: 'Packed', days: [7, 8, 9], tone: PEAK },
];
