import type { TrailUse } from './trails';

export interface UseEntry {
  uses: TrailUse[];
  /** Something a visitor should know about who may use the trail. */
  note?: string;
}

const HB: TrailUse[] = ['hike', 'bike'];
const HBH: TrailUse[] = ['hike', 'bike', 'horse'];

/**
 * Who may use each trail, researched by hand in November 2026 because the Forest Service data
 * leaves these fields blank. Sources: the San Bernardino National Forest trail pages and its
 * Big Bear Valley Hiking Trails handout, the Big Bear visitor bureau trail guide (bigbear.com),
 * Big Bear Mountain Resort's cross-country trail list, and the Big Bear Cycling Association.
 * Horses are listed only where a source names them, although the Forest Service allows horses
 * on its trails in general, nature trails excepted. Keyed by trail number.
 */
export const KNOWN_USES: Record<string, UseEntry> = {
  // South shore, around Snow Summit and Aspen Glen
  '1E01': { uses: HBH, note: 'Hikers share the first mile and a half with bikes and horses.' },
  '1E01.1': { uses: HBH },
  '1E24': { uses: HB, note: 'Steep and rocky in places. A hard ride in either direction.' },
  '1E24.1': { uses: HB },
  '1E27': { uses: HB },
  '1E40': { uses: HB },
  '1E25': { uses: HB, note: 'Short and steep. Popular with mountain bikers.' },
  '1E29': { uses: HB },
  '1E30': { uses: HB, note: 'A popular downhill bike trail. Riders can come fast, so hikers should keep watch.' },
  '1E30.1': { uses: HB },
  '1E31': { uses: HB },
  '1E32': { uses: HBH },
  '1E32.1': { uses: HBH },
  '1E32.2': { uses: HBH },
  '1E12': { uses: HBH, note: 'Built for hikers, mountain bikers and horse riders.' },
  '1W12': { uses: HB },
  '0E01': { uses: HBH },
  // North shore
  '1E22': { uses: HB, note: 'Bikes must turn around at the top: no bicycles on the Pacific Crest Trail.' },
  '1E23': { uses: ['hike'], note: 'A nature trail with 16 numbered stops.' },
  '1E50': { uses: HB, note: 'Paved. Good for strollers, wheelchairs and skates. No horses.' },
  '1E50.1': { uses: HB, note: 'Paved. No horses.' },
  '1E51': { uses: ['hike'], note: 'A short nature loop behind the Discovery Center.' },
  '1W06': { uses: HB },
  '1W05': { uses: HB },
  // West end
  '1W03': { uses: ['hike'], note: 'No bikes on this trail.' },
  '1W11': { uses: ['hike'], note: 'A nature trail. Please stay out of the meadow.' },
  '1W16': { uses: ['hike'], note: 'No bikes on this trail.' },
  '1W04': { uses: ['hike'], note: 'Only the first mile and a half is maintained.' },
  // East
  '2E18': { uses: ['hike'] },
};

/** The Pacific Crest Trail is numbered 2000.xx. It is open to hikers and horses; bikes are not allowed. */
const PCT: UseEntry = { uses: ['hike', 'horse'], note: 'Pacific Crest Trail: hikers and horses only. No bicycles.' };
/** The Santa Ana River Trail is numbered 2E03.x. */
const SART: UseEntry = { uses: HBH };

/** What we know about a trail's uses, or null when it has not been researched. */
export function knownUses(trailNumber: string): UseEntry | null {
  const no = trailNumber.toUpperCase();
  if (KNOWN_USES[no]) return KNOWN_USES[no];
  if (/^2000(\.|$)/.test(no)) return PCT;
  if (/^2E03(\.|$)/.test(no)) return SART;
  return null;
}

export type Level = 'easy' | 'moderate' | 'hard';
export interface Difficulty {
  level: Level;
  /** The rating as the source words it. */
  label: string;
}

const d = (level: Level, label: string): Difficulty => ({ level, label });

/**
 * Difficulty as published by the Forest Service on its trail pages and in its Big Bear Valley
 * Hiking Trails handout, November 2026. Cabin 89 and Skyline have no Forest Service rating, so
 * theirs come from the Big Bear visitor bureau trail guide. Where a source gives a range, the
 * level used for filtering is the harder end. Keyed by trail number.
 */
export const KNOWN_DIFFICULTY: Record<string, Difficulty> = {
  '1E23': d('easy', 'Easy'),
  '1E51': d('easy', 'Easy'),
  '1E50.1': d('easy', 'Easy'),
  '1E32': d('easy', 'Easy'),
  '1E31': d('easy', 'Easy'),
  '1W11': d('easy', 'Easy'),
  '1W16': d('easy', 'Easy'),
  '1E25': d('moderate', 'Easy to moderate'),
  '1E29': d('moderate', 'Easy to moderate'),
  '1E30': d('moderate', 'Easy to moderate'),
  '1W12': d('moderate', 'Easy to moderate'),
  '1E12': d('moderate', 'Beginner to intermediate'),
  '1E27': d('moderate', 'Moderate'),
  '1W06': d('moderate', 'Moderate'),
  '1W05': d('moderate', 'Moderate'),
  '0E01': d('moderate', 'Moderate'),
  '1E01': d('hard', 'Moderate to difficult'),
  '1E22': d('hard', 'Moderate to difficult'),
  '1W03': d('hard', 'Moderate to difficult'),
  '1E40': d('hard', 'Moderate to difficult'),
  '1E24': d('hard', 'Intermediate to difficult'),
  '2E18': d('hard', 'Difficult'),
  '1W04': d('hard', 'Strenuous'),
};

export const knownDifficulty = (trailNumber: string): Difficulty | null => KNOWN_DIFFICULTY[trailNumber.toUpperCase()] ?? null;
