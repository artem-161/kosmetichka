// Тонкие линейные иконки (24×24). Новую иконку — просто допиши путь сюда.
const P = {
  jar: '<rect x="5" y="9.5" width="14" height="11" rx="3"/><rect x="6.5" y="4.5" width="11" height="5" rx="1.6"/><path d="M8.5 14h7"/>',
  pump: '<path d="M8 10.5h8v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19.5z"/><path d="M10 10.5V7.5h4v3M12 7.5V4.5H8.5"/>',
  lipstick: '<rect x="8" y="13" width="8" height="8" rx="1.2"/><path d="M9.5 13V8.6L14.5 5v8"/>',
  hair: '<rect x="3.5" y="5.5" width="17" height="4.5" rx="2"/><path d="M6.5 10v8.5M9.5 10v8.5M12.5 10v8.5M15.5 10v8.5M18.5 10v6"/>',
  polish: '<rect x="7" y="11" width="10" height="10" rx="2.5"/><path d="M10 11V7.5h4V11M10.6 7.5V3.5h2.8v4"/>',
  perfume: '<rect x="5.5" y="9" width="13" height="12" rx="3.2"/><path d="M10 9V6.5h4V9M12 6.5V4M14 4h3"/><circle cx="12" cy="15" r="2.4"/>',
  sparkle: '<path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5Z"/><path d="M18.5 15.5c.3 1.8.9 2.4 2.5 2.7-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.7Z"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 4.2 4 5.5 4 8.5s-4 4.3-4 8.5M16 3.5c0 4.2-4 5.5-4 8.5s4 4.3 4 8.5"/>',
  bag: '<path d="M5 8.5h14l-1 12H6z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2.2h5.6L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.4"/>',
  star: '<path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.8 7 9 4-1.2 7-4.6 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  chevronRight: '<path d="m9.5 5 7 7-7 7"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/** Заменяет <i data-icon="..."> на SVG внутри контейнера. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
}
