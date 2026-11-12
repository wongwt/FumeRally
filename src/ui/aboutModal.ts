import {
  AUTHOR,
  COPYRIGHT_YEAR,
  REPO_URL,
  SHIPPED,
  TOOLS,
  appVersion,
  versionOf,
  type Credit
} from '../config/about';
import { t } from '../i18n';

const link = (href: string, text: string): string =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

function creditRow(c: Credit): string {
  const v = c.pkg ? versionOf(c.pkg) : '';
  const detail = [v && `v${v}`, c.note, c.license].filter(Boolean).join(' · ');
  return `<li>${link(c.url, c.name)}<span>${detail}</span></li>`;
}

/** The About dialog: version, copyright and the third-party software and tools behind the game. */
export function aboutHtml(): string {
  const v = appVersion();
  return (
    `<div class="mcard wide about"><p class="eyebrow">ABOUT</p><h2>${t('app.title')}</h2>` +
    `<p class="lead">${t('about.version', { v: v || '—' })}</p>` +
    `<p>${t('about.copyright', { year: COPYRIGHT_YEAR, author: AUTHOR })}</p>` +
    `<p class="hint">${t('about.original')} ${link(REPO_URL, t('about.source'))}</p>` +
    `<p class="board-sub">${t('about.shipped')}</p><ul class="credits">${SHIPPED.map(creditRow).join('')}</ul>` +
    `<p class="board-sub">${t('about.tools')}</p><ul class="credits">${TOOLS.map(creditRow).join('')}</ul>` +
    `<button type="button" class="start-btn" data-close="1" data-autofocus>${t('btn.close')}</button></div>`
  );
}
