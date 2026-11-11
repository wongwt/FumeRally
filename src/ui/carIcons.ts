import { CARS, type CarId } from '../config/cars';

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/** Side-view icon of a car as an SVG string; a "?" plate when it is still locked. */
export function carIcon(kind: CarId, locked = false): string {
  if (locked) {
    return (
      '<svg viewBox="0 0 72 40" aria-hidden="true"><rect x="5" y="3" width="62" height="34" rx="7" fill="#0b1d29" stroke="#1f4156" stroke-width="1.5"/>' +
      '<text x="36" y="29" text-anchor="middle" font-size="24" font-weight="900" fill="#46667a" font-family="sans-serif">?</text></svg>'
    );
  }
  const c = hex((CARS[kind] ?? CARS.sedan).color);
  const g = '#0f3446';
  const w = (x: number, y: number, r: number): string =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#0b0f14" stroke="#9db4c2" stroke-width="1.5"/>`;
  const lamp = '<rect x="64" y="24" width="3" height="3" fill="#ffe9a8"/>';
  const sedan =
    `<rect x="6" y="21" width="60" height="11" rx="3" fill="${c}"/><path d="M20 21l6-9h20l8 9z" fill="${c}"/>` +
    `<path d="M25 20l3.5-6.5H36V20zM38.5 20v-6.5H46L50.5 20z" fill="${g}"/>` +
    w(20, 32, 5.5) +
    w(52, 32, 5.5) +
    lamp;
  let b: string;
  switch (kind) {
    case 'sport':
      b =
        `<path d="M5 32v-6l14-3 9-6h17l13 6 9 2v7z" fill="${c}"/><path d="M30 22l6-4.5h8l7 4.5z" fill="${g}"/>` +
        `<rect x="3" y="16" width="11" height="2.5" fill="${c}"/><rect x="7" y="18" width="2.5" height="6" fill="${c}"/>` +
        w(19, 32, 5) +
        w(53, 32, 5) +
        lamp;
      break;
    case 'armor':
      b =
        `<rect x="6" y="19" width="60" height="13" rx="2" fill="${c}"/><rect x="26" y="10" width="20" height="9" rx="2" fill="${c}"/>` +
        `<rect x="44" y="12" width="24" height="3" fill="${g}"/><rect x="10" y="23" width="52" height="3" fill="${g}" opacity="0.5"/>` +
        w(16, 32, 6) +
        w(36, 32, 6) +
        w(56, 32, 6);
      break;
    case 'offroad':
      b =
        `<rect x="8" y="17" width="56" height="11" rx="3" fill="${c}"/><path d="M20 17l5-8h22l6 8z" fill="${c}"/>` +
        `<path d="M26 16l3-5.5h7V16zM38 16v-5.5h8L49 16z" fill="${g}"/><rect x="21" y="5" width="24" height="2" fill="#0b0f14"/>` +
        '<rect x="64" y="21" width="4" height="6" fill="#0b0f14"/>' +
        w(19, 30, 8) +
        w(53, 30, 8);
      break;
    case 'tanker':
      b =
        `<rect x="4" y="28" width="62" height="4" fill="#27414f"/><rect x="6" y="13" width="42" height="15" rx="7" fill="#8da2af"/><rect x="12" y="19" width="30" height="3" fill="${c}"/>` +
        `<rect x="48" y="17" width="18" height="12" rx="2" fill="${c}"/><path d="M52 17l3-5h9v5z" fill="${c}"/><path d="M54 16.5l2-3.5h6v3.5z" fill="${g}"/>` +
        w(14, 32, 5) +
        w(30, 32, 5) +
        w(56, 32, 5);
      break;
    case 'scout':
      b =
        sedan +
        '<rect x="32" y="2" width="2" height="10" fill="#9db4c2"/><rect x="26" y="2" width="14" height="2.5" fill="#f2fbff"/>';
      break;
    case 'police':
      b =
        sedan +
        '<rect x="12" y="25" width="48" height="2.5" fill="#f2fbff" opacity="0.8"/><rect x="29" y="8" width="7" height="3.5" fill="#ff3030"/><rect x="36" y="8" width="7" height="3.5" fill="#3060ff"/>';
      break;
    case 'moto':
      b =
        `<path d="M20 26l12-8h12l9 5-8 4H28z" fill="${c}"/><rect x="25" y="7" width="9" height="12" rx="3" fill="${g}"/><circle cx="31" cy="5" r="4" fill="#dfeaf0"/>` +
        '<path d="M50 14l6 2-3 9M32 26l-14 3M44 27l9 2" stroke="#9db4c2" stroke-width="2" fill="none"/>' +
        w(15, 29, 8) +
        w(57, 29, 8);
      break;
    default:
      b = sedan;
  }
  return `<svg viewBox="0 0 72 40" aria-hidden="true">${b}</svg>`;
}
