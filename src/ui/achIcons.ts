import type { AchDef, AchIcon, AchTier } from '../config/achievements';

const TIER_COL: Record<AchTier, string> = {
  bronze: '#c98a52',
  silver: '#b9c6cf',
  gold: '#ffc83d',
  fun: '#37c6ff'
};

/** Stroke paths for each icon, drawn in a 24×24 box. */
const ICONS: Record<AchIcon, string> = {
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4',
  rock: 'M4 18l3-8 5-4 6 4 2 8z',
  cloud: 'M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1A3.5 3.5 0 0 1 16 18z',
  burst: 'M12 3l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z',
  bolt: 'M13 3L6 14h5l-1 7 7-11h-5z',
  drop: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  flag: 'M6 21V4M6 5h11l-2 4 2 4H6',
  rainbow: 'M3 18a9 9 0 0 1 18 0M7 18a5 5 0 0 1 10 0M10.5 18a1.5 1.5 0 0 1 3 0',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  ghost: 'M6 20V11a6 6 0 0 1 12 0v9l-3-2-3 2-3-2zM9.5 11h.01M14.5 11h.01',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  wheel: 'M12 3a9 9 0 1 0 .01 0zM12 9a3 3 0 1 0 .01 0zM12 3v6M12 15v6M3 12h6M15 12h6'
};

/** Round badge icon for an achievement, coloured by tier; a "?" badge while locked. */
export function achIcon(a: Pick<AchDef, 'icon' | 'tier'>, locked = false): string {
  if (locked) {
    return (
      '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#0b1d29" stroke="#1f4156" stroke-width="2"/>' +
      '<text x="20" y="27" text-anchor="middle" font-size="20" font-weight="900" fill="#46667a" font-family="sans-serif">?</text></svg>'
    );
  }
  const col = TIER_COL[a.tier];
  return (
    `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#0b1d29" stroke="${col}" stroke-width="2"/>` +
    `<g transform="translate(8 8)" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[a.icon]}"/></g></svg>`
  );
}

export const ACH_ICON_NAMES = Object.keys(ICONS) as AchIcon[];
