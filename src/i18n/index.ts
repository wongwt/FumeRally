import { en } from './en';
import { zhTW, type MessageKey, type Messages } from './zh-TW';

export type Lang = 'zh-TW' | 'en';
export type { MessageKey };

export const LANGS: readonly { id: Lang; label: string }[] = [
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' }
];

const TABLES: Record<Lang, Messages> = { 'zh-TW': zhTW, en };
const STORAGE_KEY = 'fumeRallyLang';
const DEFAULT_LANG: Lang = 'zh-TW';

let current: Lang = DEFAULT_LANG;
const listeners = new Set<(lang: Lang) => void>();

export const isLang = (v: unknown): v is Lang => v === 'zh-TW' || v === 'en';

/** Looks up a message and fills `{name}` placeholders. Falls back to zh-TW, then to the key. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = TABLES[current][key] ?? zhTW[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function getLang(): Lang {
  return current;
}

/** Switches language, remembers the choice and notifies subscribers. */
export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable (private mode, tests) */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Restores the saved language; zh-TW is the default when nothing was chosen. */
export function initLang(): Lang {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  current = isLang(saved) ? saved : DEFAULT_LANG;
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  return current;
}

/** Test helper: resets module state. */
export function resetLangForTests(): void {
  current = DEFAULT_LANG;
  listeners.clear();
}
