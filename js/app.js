import { db } from './db.js';
import { APP_VERSION, CATEGORIES, STATUSES, SOON_DAYS, PAO_OPTIONS } from './config.js';
import { icon, hydrateIcons } from './icons.js';

/* ───────────── Состояние ───────────── */

const state = {
  products: [],
  tab: 'home',        // home | soon | wish | settings
  status: 'active',   // фильтр на вкладке «Косметичка»
  category: 'all',
  query: '',
};

let editing = null;        // средство, которое сейчас редактируется (null — новое)
let pendingPhoto;          // undefined — фото не меняли, null — удалили, string — новое

/* ───────────── Утилиты ───────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2));

const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

function todayDate() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const parseISO = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
const fmtDate = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
const fmtMoney = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ───────────── Сроки годности ───────────── */

// Итоговый срок = самое раннее из «годен до» и «дата вскрытия + PAO»
function expiryOf(p) {
  const dates = [];
  if (p.expiresAt) dates.push(parseISO(p.expiresAt));
  if (p.openedAt && p.paoMonths) dates.push(addMonths(parseISO(p.openedAt), Number(p.paoMonths)));
  return dates.length ? new Date(Math.min(...dates)) : null;
}

function daysLeft(p) {
  const e = expiryOf(p);
  return e ? Math.round((e - todayDate()) / 864e5) : null;
}

const tracksExpiry = (p) => p.status === 'active' || p.status === 'stock';

function expiryBadge(p, cls = '') {
  if (!tracksExpiry(p)) return '';
  const d = daysLeft(p);
  if (d === null) return '';
  if (d < 0) return `<span class="badge bad ${cls}">Истёк</span>`;
  if (d <= SOON_DAYS) return `<span class="badge soon ${cls}">${d} ${plural(d, 'день', 'дня', 'дней')}</span>`;
  return `<span class="badge ${cls}">до ${fmtShort(expiryOf(p))}</span>`;
}

/* ───────────── Отрисовка: элементы ───────────── */

// Фото средства или мягкий градиент с иконкой категории
function visual(p, cls) {
  if (p.photo) return `<div class="pv ${cls}"><img src="${p.photo}" alt="" loading="lazy"></div>`;
  const cat = catOf(p.category);
  return `<div class="pv pv-empty ${cls}" style="--a:${cat.tint[0]};--b:${cat.tint[1]}">${icon(cat.icon)}</div>`;
}

const subline = (p) => [p.brand, p.rating ? '★'.repeat(p.rating) : ''].filter(Boolean).join(' · ') || catOf(p.category).name;

function gridCard(p) {
  return `
    <div class="p-card" data-action="edit" data-id="${p.id}" role="button" tabindex="0">
      ${visual(p, 'pv-card')}
      ${expiryBadge(p)}
      <div class="p-card-text"><b>${esc(p.name)}</b><small>${esc(subline(p))}</small></div>
    </div>`;
}

function rowCard(p) {
  return `
    <div class="card row-item" data-action="edit" data-id="${p.id}" role="button" tabindex="0">
      ${visual(p, 'pv-sm')}
      <div class="txt"><b>${esc(p.name)}</b><small>${esc(subline(p))}</small></div>
      ${expiryBadge(p, 'inline')}
    </div>`;
}

function empty({ ic, title, text, button }) {
  return `
    <div class="empty">
      <div class="empty-ico">${icon(ic)}</div>
      <h3>${title}</h3>
      ${text ? `<p>${text}</p>` : ''}
      ${button ? `<button class="btn btn-primary" data-action="add">${button}</button>` : ''}
    </div>`;
}

function pageHead(eyebrow, title) {
  return `<header class="page-head"><p class="eyebrow">${eyebrow}</p><h1 class="title">${title}</h1></header>`;
}

/* ───────────── Экраны ───────────── */

function matchesQuery(p) {
  const q = state.query.trim().toLowerCase();
  return !q || `${p.name} ${p.brand || ''} ${p.notes || ''}`.toLowerCase().includes(q);
}

const byName = (a, b) => a.name.localeCompare(b.name, 'ru');

function homeList() {
  const items = state.products
    .filter((p) => p.status === state.status)
    .filter((p) => state.category === 'all' || p.category === state.category)
    .filter(matchesQuery)
    .sort(byName);
  if (!items.length) {
    return state.products.length
      ? empty({ ic: 'search', title: 'Ничего не нашлось', text: 'Попробуй другой запрос или категорию.' })
      : '';
  }
  return `<div class="grid">${items.map(gridCard).join('')}</div>`;
}

function hero() {
  const owned = state.products.filter(tracksExpiry);
  const active = owned.filter((p) => p.status === 'active').length;
  const tracked = owned.filter((p) => expiryOf(p));
  const soon = tracked.filter((p) => daysLeft(p) >= 0 && daysLeft(p) <= SOON_DAYS).length;
  const expired = tracked.filter((p) => daysLeft(p) < 0).length;
  const fresh = tracked.length ? (tracked.length - soon - expired) / tracked.length : 1;
  const C = 2 * Math.PI * 34;

  let text = 'Все сроки в порядке';
  if (expired || soon) {
    text = [expired && `${expired} ${plural(expired, 'истёк', 'истекли', 'истекли')}`,
      soon && `${soon} скоро ${plural(soon, 'истекает', 'истекают', 'истекают')}`].filter(Boolean).join(' · ');
  } else if (!tracked.length) text = 'Добавь даты вскрытия — я напомню о сроках';

  return `
    <div class="hero" data-action="tab" data-value="soon">
      <div class="hero-ring">
        <svg class="ring" viewBox="0 0 78 78"><circle class="ring-bg" cx="39" cy="39" r="34"/>
          <circle class="ring-fg" cx="39" cy="39" r="34" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - fresh)}"/></svg>
        <span>${active}</span>
      </div>
      <div class="hero-text">
        <b>${active} ${plural(active, 'средство', 'средства', 'средств')} в деле</b>
        <small>${text}</small>
      </div>
    </div>`;
}

function homeView() {
  const greet = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!state.products.length) {
    return pageHead(greet, 'Косметичка <em>Юли</em>') + empty({
      ic: 'sparkle', title: 'Здесь будет твоя косметичка',
      text: 'Добавь первое средство — и я подскажу, когда истекает срок годности.',
      button: 'Добавить средство',
    });
  }
  const counts = Object.fromEntries(Object.keys(STATUSES).map((s) =>
    [s, state.products.filter((p) => p.status === s).length]));
  const cat = state.category === 'all' ? null : catOf(state.category);
  const opt = (id, label) => `<option value="${id}" ${state.category === id ? 'selected' : ''}>${label}</option>`;
  return `
    ${pageHead(greet, 'Косметичка <em>Юли</em>')}
    ${hero()}
    <div class="filters">
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="Поиск" value="${esc(state.query)}"></label>
      <label class="cat-pick ${cat ? 'on' : ''}">
        ${cat ? icon(cat.icon) : ''}<span>${cat ? cat.name : 'Все'}</span>${icon('chevronDown')}
        <select id="cat" aria-label="Категория">${opt('all', 'Все категории')}${CATEGORIES.map((c) => opt(c.id, c.name)).join('')}</select>
      </label>
    </div>
    <div class="segmented">
      ${['active', 'stock', 'finished'].map((s) => `
        <button data-action="status" data-value="${s}" class="${state.status === s ? 'on' : ''}">
          ${STATUSES[s].short}${counts[s] ? ` <small>${counts[s]}</small>` : ''}
        </button>`).join('')}
    </div>
    <div id="list">${homeList()}</div>`;
}

function soonView() {
  const items = state.products
    .filter((p) => tracksExpiry(p) && expiryOf(p))
    .sort((a, b) => daysLeft(a) - daysLeft(b));
  const expired = items.filter((p) => daysLeft(p) < 0);
  const soon = items.filter((p) => daysLeft(p) >= 0 && daysLeft(p) <= SOON_DAYS);
  const later = items.filter((p) => daysLeft(p) > SOON_DAYS);
  const noDate = state.products.filter((p) => tracksExpiry(p) && !expiryOf(p));

  const section = (title, list) => (list.length
    ? `<h2 class="section-title">${title}<small>${list.length}</small></h2><div class="list">${list.map(rowCard).join('')}</div>` : '');

  const head = pageHead('Сроки годности', 'Что пора <em>проверить</em>');
  if (!items.length && !noDate.length) {
    return head + empty({ ic: 'hourglass', title: 'Пока нечего проверять', text: 'Укажи дату вскрытия или «годен до» — и средство появится здесь.' });
  }
  return head
    + section('Истёк срок', expired)
    + section('Скоро истекает', soon)
    + section('Всё в порядке', later)
    + section('Без срока', noDate);
}

function wishView() {
  const items = state.products.filter((p) => p.status === 'wish').sort(byName);
  const head = pageHead('Список желаний', 'Хочу <em>купить</em>');
  if (!items.length) {
    return head + empty({ ic: 'heart', title: 'Пока пусто', text: 'Сохраняй сюда то, что хочется попробовать.', button: 'Добавить желание' });
  }
  const total = items.reduce((s, p) => s + (Number(p.price) || 0), 0);
  return `
    ${head}
    ${total ? `<p class="hint">Всего примерно ${fmtMoney(total)}</p>` : ''}
    <div class="list">${items.map((p) => `
      <div class="card wish" data-action="edit" data-id="${p.id}" role="button" tabindex="0">
        ${visual(p, 'pv-wish')}
        <div class="wish-body">
          <b>${esc(p.name)}</b>
          ${p.brand ? `<span class="brand">${esc(p.brand)}</span>` : ''}
          ${p.notes ? `<p>${esc(p.notes)}</p>` : ''}
          <div class="wish-meta">
            <span class="price">${p.price ? fmtMoney(p.price) : ''}</span>
            <button class="pill" data-action="bought" data-id="${p.id}">${icon('check')}Купила</button>
          </div>
        </div>
      </div>`).join('')}</div>`;
}

function settingsView() {
  const owned = state.products.filter(tracksExpiry);
  const sum = owned.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const row = (action, ic, title, sub, cls = '') => `
    <button class="row ${cls}" data-action="${action}">
      <span class="row-ico">${icon(ic)}</span>
      <span class="row-text"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      ${icon('chevronRight', 'row-chev')}
    </button>`;
  return `
    ${pageHead('Настройки', 'Ещё')}
    <div class="stats">
      <div class="card stat"><b>${owned.length}</b><small>в косметичке</small></div>
      <div class="card stat"><b>${state.products.filter((p) => p.status === 'finished').length}</b><small>закончилось</small></div>
      <div class="card stat"><b>${sum ? `${Math.round(sum / 1000)}k` : '—'}</b><small>${sum ? fmtMoney(sum) : 'стоимость'}</small></div>
    </div>

    ${standalone ? '' : `
    <h2 class="section-title">Установить на iPhone</h2>
    <div class="card install">
      <p>Открой эту страницу <b>в Safari</b>, затем:</p>
      <ol><li>кнопка «Поделиться»</li><li>«На экран „Домой“»</li></ol>
    </div>`}

    <h2 class="section-title">Резервная копия</h2>
    <div class="card rows">
      ${row('export', 'download', 'Сохранить копию', 'Файл можно положить в «Файлы» или iCloud')}
      <label class="row">
        <span class="row-ico">${icon('upload')}</span>
        <span class="row-text"><b>Загрузить из копии</b><small>Восстановить данные из файла</small></span>
        ${icon('chevronRight', 'row-chev')}
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </label>
    </div>
    <p class="hint">${icon('shield')} Все данные хранятся только на этом телефоне. Время от времени сохраняй копию — так ничего не потеряется.</p>

    <div class="card rows" style="margin-top:22px">${row('wipe', 'trash', 'Удалить все данные', '', 'danger')}</div>

    <p class="colophon">Косметичка v${APP_VERSION} · сделано с любовью для Юли</p>`;
}

const views = { home: homeView, soon: soonView, wish: wishView, settings: settingsView };

function moveLens() {
  const tab = $(`.tab[data-value="${state.tab}"]`);
  const lens = $('#tab-lens');
  if (!tab || !lens) return;
  lens.style.width = `${tab.offsetWidth}px`;
  lens.style.transform = `translateX(${tab.offsetLeft}px)`;
}

function render(animate = false) {
  const main = $('#main');
  main.innerHTML = views[state.tab]();
  if (animate) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); }
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.value === state.tab));
  moveLens();
}

function renderList() {
  const list = $('#list');
  if (list) list.innerHTML = homeList();
}

/* ───────────── Форма ───────────── */

function fillSelect(select, options, value) {
  select.innerHTML = options.map(([v, label]) =>
    `<option value="${v}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${label}</option>`).join('');
}

function setStars(n) {
  const box = $('#f-stars');
  box.dataset.value = n || 0;
  box.innerHTML = [1, 2, 3, 4, 5].map((i) =>
    `<button type="button" data-action="star" data-value="${i}" class="${i <= n ? 'on' : ''}" aria-label="${i}">${icon('star')}</button>`).join('');
}

function setPhotoPreview(src) {
  const pick = $('#photo-pick');
  pick.querySelector('img')?.remove();
  pick.classList.toggle('has', !!src);
  if (src) pick.insertAdjacentHTML('afterbegin', `<img src="${src}" alt="">`);
  pick.querySelector('.photo-hint span').textContent = src ? 'Заменить' : 'Добавить фото';
}

function openForm(product = null) {
  editing = product;
  pendingPhoto = undefined;
  const p = product || {
    category: state.category !== 'all' ? state.category : 'face',
    status: state.tab === 'wish' ? 'wish' : (state.tab === 'home' ? state.status : 'active'),
  };
  const form = $('#form');
  form.reset();
  $('#sheet-title').textContent = product ? 'Редактировать' : 'Новое средство';
  form.name.value = p.name || '';
  form.brand.value = p.brand || '';
  fillSelect($('#f-category'), CATEGORIES.map((c) => [c.id, c.name]), p.category);
  fillSelect($('#f-status'), Object.entries(STATUSES).map(([id, s]) => [id, s.name]), p.status);
  fillSelect($('#f-pao'), [['', '—'], ...PAO_OPTIONS.map((m) => [m, `${m} мес.`])], p.paoMonths);
  form.openedAt.value = p.openedAt || '';
  form.expiresAt.value = p.expiresAt || '';
  form.price.value = p.price ?? '';
  form.notes.value = p.notes || '';
  setStars(p.rating || 0);
  setPhotoPreview(p.photo);
  $('#delete-btn').hidden = !product;
  document.body.classList.add('sheet-open');
  const sheet = $('#sheet');
  sheet.classList.remove('closing');
  sheet.showModal();
  $('.sheet-body', sheet).scrollTop = 0;
}

function closeForm() {
  const sheet = $('#sheet');
  if (!sheet.open) return;
  document.body.classList.remove('sheet-open');
  sheet.classList.add('closing');
  setTimeout(() => { sheet.close(); sheet.classList.remove('closing'); }, 280);
}

async function saveForm() {
  const form = $('#form');
  const name = form.name.value.trim();
  if (!name) { form.name.focus(); return; }
  const now = new Date().toISOString();
  const product = {
    ...(editing || { id: uid(), createdAt: now }),
    name,
    brand: form.brand.value.trim(),
    category: form.category.value,
    status: form.status.value,
    openedAt: form.openedAt.value || null,
    paoMonths: form.paoMonths.value ? Number(form.paoMonths.value) : null,
    expiresAt: form.expiresAt.value || null,
    price: form.price.value === '' ? null : Number(form.price.value),
    rating: Number($('#f-stars').dataset.value) || 0,
    notes: form.notes.value.trim(),
    updatedAt: now,
  };
  if (pendingPhoto !== undefined) product.photo = pendingPhoto;
  if (product.status === 'finished' && !product.finishedAt) product.finishedAt = todayISO();

  await db.put(product);
  await load();
  closeForm();
  toast(editing ? 'Сохранено' : 'Добавлено в косметичку');
}

// Сжимаем фото, чтобы не раздувать хранилище
function resizeImage(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ───────────── Резервная копия ───────────── */

async function exportData() {
  const data = JSON.stringify({ app: 'kosmetichka', version: APP_VERSION, exportedAt: new Date().toISOString(), products: state.products });
  const file = new File([data], `kosmetichka-${todayISO()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const json = JSON.parse(await file.text());
    const items = Array.isArray(json) ? json : json.products;
    if (!Array.isArray(items)) throw new Error('bad format');
    const valid = items.filter((p) => p && p.id && p.name);
    if (!confirm(`Загрузить ${valid.length} ${plural(valid.length, 'средство', 'средства', 'средств')}? Совпадающие записи будут заменены.`)) return;
    await db.putMany(valid);
    await load();
    toast('Данные загружены');
  } catch {
    alert('Не получилось прочитать файл. Это точно копия из Косметички?');
  }
}

/* ───────────── События ───────────── */

const actions = {
  tab: (el) => {
    if (state.tab === el.dataset.value) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    state.tab = el.dataset.value; render(true); window.scrollTo(0, 0);
  },
  status: (el) => { state.status = el.dataset.value; render(); },
  add: () => openForm(),
  edit: (el) => openForm(state.products.find((p) => p.id === el.dataset.id)),
  close: () => closeForm(),
  star: (el) => {
    const n = Number(el.dataset.value);
    setStars(Number($('#f-stars').dataset.value) === n ? 0 : n); // повторное нажатие сбрасывает
  },
  'opened-today': () => {
    const form = $('#form');
    form.openedAt.value = todayISO();
    if (form.status.value === 'stock' || form.status.value === 'wish') form.status.value = 'active';
    toast('Дата вскрытия — сегодня');
  },
  delete: async () => {
    if (!editing || !confirm(`Удалить «${editing.name}»?`)) return;
    await db.remove(editing.id);
    await load();
    closeForm();
    toast('Удалено');
  },
  bought: async (el) => {
    const p = state.products.find((x) => x.id === el.dataset.id);
    await db.put({ ...p, status: 'stock', updatedAt: new Date().toISOString() });
    await load();
    toast('Ура! Перенесено в запас');
  },
  export: () => exportData(),
  wipe: async () => {
    if (!confirm('Удалить ВСЕ средства? Это нельзя отменить.')) return;
    await db.clear();
    await load();
    toast('Все данные удалены');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  e.preventDefault();
  e.stopPropagation();
  actions[el.dataset.action](el);
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { state.query = e.target.value; renderList(); }
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'cat') { state.category = e.target.value; render(); }
  if (e.target.id === 'import-file' && e.target.files[0]) {
    await importData(e.target.files[0]);
    e.target.value = '';
  }
  if (e.target.name === 'photoFile' && e.target.files[0]) {
    pendingPhoto = await resizeImage(e.target.files[0]);
    setPhotoPreview(pendingPhoto);
  }
});

$('#form').addEventListener('submit', (e) => { e.preventDefault(); saveForm(); });

const sheet = $('#sheet');
// Закрытие тапом по затемнению, кнопкой Esc и свайпом вниз за шапку
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeForm(); });
sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeForm(); });
(() => {
  let startY = null, dy = 0;
  const zones = [$('.sheet-grab', sheet), $('.sheet-head', sheet)];
  zones.forEach((z) => {
    z.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
    z.addEventListener('touchmove', (e) => {
      if (startY == null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    z.addEventListener('touchend', () => {
      sheet.style.transform = '';
      sheet.style.transition = '';
      if (dy > 90) closeForm();
      startY = null;
    });
  });
})();

window.addEventListener('resize', moveLens);

/* ───────────── Тост ───────────── */

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ───────────── Старт ───────────── */

async function load() {
  state.products = await db.all();
  render();
}

hydrateIcons();
load().then(() => requestAnimationFrame(moveLens));

// Просим браузер не удалять данные при нехватке места
navigator.storage?.persist?.();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
