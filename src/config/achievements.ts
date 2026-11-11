export type AchTier = 'bronze' | 'silver' | 'gold' | 'fun';
export type AchIcon =
  | 'trophy'
  | 'rock'
  | 'cloud'
  | 'burst'
  | 'bolt'
  | 'drop'
  | 'shield'
  | 'flag'
  | 'rainbow'
  | 'star'
  | 'ghost'
  | 'calendar'
  | 'wheel';
/** Lifetime counters that some achievements are earned from. */
export type StatKey = 'hits' | 'rocks' | 'puff' | 'stun' | 'crush';

interface AchBase {
  id: string;
  icon: AchIcon;
  tier: AchTier;
  /** Earned by clearing this stage (in any mode). */
  lvl?: number;
  /** Earned when this lifetime counter reaches `need`. */
  stat?: StatKey;
  need?: number;
}

/** Names and descriptions live in the i18n tables as `ach.<id>.name` / `ach.<id>.desc`. */
const DEFS = [
  { id: 't3', icon: 'trophy', tier: 'bronze', lvl: 3 },
  { id: 't5', icon: 'trophy', tier: 'bronze', lvl: 5 },
  { id: 't10', icon: 'trophy', tier: 'silver', lvl: 10 },
  { id: 't15', icon: 'trophy', tier: 'silver', lvl: 15 },
  { id: 't20', icon: 'trophy', tier: 'silver', lvl: 20 },
  { id: 't30', icon: 'trophy', tier: 'gold', lvl: 30 },
  { id: 't40', icon: 'trophy', tier: 'gold', lvl: 40 },
  { id: 'first_catch', icon: 'burst', tier: 'fun' },
  { id: 'first_rock', icon: 'rock', tier: 'fun' },
  { id: 'no_fuel', icon: 'drop', tier: 'fun' },
  { id: 'hits_10', icon: 'burst', tier: 'fun', stat: 'hits', need: 10 },
  { id: 'hits_50', icon: 'burst', tier: 'fun', stat: 'hits', need: 50 },
  { id: 'rocks_5', icon: 'rock', tier: 'fun', stat: 'rocks', need: 5 },
  { id: 'first_puff', icon: 'cloud', tier: 'fun', stat: 'puff', need: 1 },
  { id: 'puff_100', icon: 'cloud', tier: 'fun', stat: 'puff', need: 100 },
  { id: 'first_stun', icon: 'star', tier: 'fun', stat: 'stun', need: 1 },
  { id: 'stun_50', icon: 'star', tier: 'fun', stat: 'stun', need: 50 },
  { id: 'first_power', icon: 'rainbow', tier: 'fun' },
  { id: 'knock3', icon: 'bolt', tier: 'fun' },
  { id: 'combo5', icon: 'star', tier: 'fun' },
  { id: 'flawless3', icon: 'flag', tier: 'fun' },
  { id: 'run5', icon: 'flag', tier: 'fun' },
  { id: 'bonus_perfect', icon: 'star', tier: 'fun' },
  { id: 'low_fuel', icon: 'drop', tier: 'fun' },
  { id: 'beat_ghost', icon: 'ghost', tier: 'fun' },
  { id: 'code_clear', icon: 'calendar', tier: 'fun' },
  { id: 'armor_block', icon: 'shield', tier: 'fun' },
  { id: 'crush_10', icon: 'rock', tier: 'fun', stat: 'crush', need: 10 },
  { id: 'siren_1', icon: 'bolt', tier: 'fun' },
  { id: 'moto_clear', icon: 'bolt', tier: 'fun' },
  { id: 'garage_full', icon: 'wheel', tier: 'fun' },
  { id: 'score_10k', icon: 'star', tier: 'fun' }
] as const satisfies readonly AchBase[];

export type AchId = (typeof DEFS)[number]['id'];
export interface AchDef extends AchBase {
  id: AchId;
}

export const ACHS: readonly AchDef[] = DEFS;
export const ACH_BY_ID: Readonly<Record<string, AchDef>> = Object.fromEntries(ACHS.map((a) => [a.id, a]));
export const isAchId = (v: unknown): v is AchId => typeof v === 'string' && v in ACH_BY_ID;
