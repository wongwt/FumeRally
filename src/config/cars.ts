export type CarId = 'sedan' | 'sport' | 'armor' | 'offroad' | 'tanker' | 'scout' | 'police' | 'moto';

/** Gameplay stats of a car. Names, notes and intros live in the i18n tables as `car.<id>.*`. */
export interface CarDef {
  id: CarId;
  /** Stage (cleared in any mode) that unlocks it. */
  unlock: number;
  /** Tiles per second. */
  speed: number;
  /** Fuel use relative to the sedan. */
  drain: number;
  /** Hits absorbed per life. */
  armor: number;
  /** Smashes rocks without being damaged. */
  crush?: boolean;
  /** Camera window scale in follow view; above 1 sees further. */
  view?: number;
  /** Periodically stuns nearby chasers on its own. */
  siren?: boolean;
  /** Paint colour. */
  color: number;
}

export const CARS: Record<CarId, CarDef> = {
  sedan: { id: 'sedan', unlock: 0, speed: 5.3, drain: 1.0, armor: 0, color: 0x37c6ff },
  sport: { id: 'sport', unlock: 5, speed: 6.3, drain: 1.3, armor: 0, color: 0xa98bff },
  armor: { id: 'armor', unlock: 10, speed: 4.5, drain: 1.0, armor: 1, color: 0x9fc46a },
  offroad: { id: 'offroad', unlock: 15, speed: 5.1, drain: 1.0, armor: 0, crush: true, color: 0xe0903c },
  tanker: { id: 'tanker', unlock: 20, speed: 4.7, drain: 0.6, armor: 0, color: 0xdfe6ea },
  scout: { id: 'scout', unlock: 25, speed: 5.6, drain: 1.0, armor: 0, view: 1.3, color: 0x4fd6a8 },
  police: { id: 'police', unlock: 30, speed: 5.3, drain: 1.1, armor: 0, siren: true, color: 0x3a5bff },
  moto: { id: 'moto', unlock: 35, speed: 7.2, drain: 1.7, armor: 0, color: 0xff6fd8 }
};

/**
 * Unlock order alternates roles (speed, defence, rocks, economy, vision, crowd control) and saves
 * the extreme or complex cars for last.
 */
export const CAR_ORDER: readonly CarId[] = [
  'sedan',
  'sport',
  'armor',
  'offroad',
  'tanker',
  'scout',
  'police',
  'moto'
];

/**
 * Every car starts a run a little slower and works up to its rated speed: ×0.85 on level 1,
 * +0.02 per level, full speed from level 9.
 */
export const levelSpeedFactor = (level: number): number =>
  Math.min(1, 0.85 + 0.02 * (Math.max(1, level) - 1));

export const isCarId = (v: unknown): v is CarId => typeof v === 'string' && v in CARS;

export const carUnlocked = (id: CarId, carLv: number): boolean => carLv >= CARS[id].unlock;

export const unlockedCars = (carLv: number): CarId[] => CAR_ORDER.filter((id) => carUnlocked(id, carLv));

/** The next car still locked at this progress, if any. */
export const nextLockedCar = (carLv: number): CarId | undefined =>
  CAR_ORDER.find((id) => !carUnlocked(id, carLv));

/** The car unlocked by raising progress from `before` to `after`, if any (the newest if several). */
export function newlyUnlockedCar(before: number, after: number): CarId | null {
  const was = unlockedCars(before).length;
  const now = unlockedCars(after);
  return now.length > was ? (now[now.length - 1] as CarId) : null;
}
