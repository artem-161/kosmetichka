import { db } from './db.js';
import { APP_VERSION, CATEGORIES, STATUSES, SOON_DAYS, PAO_OPTIONS } from './config.js';

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

const TITLES = { home: 'Косметичка', soon: 'Сроки годности', wish: 'Хочу купить', settings: 'Ещё' };

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

function expiryBadge(p) {
  if (!tracksExpiry(p)) return '';
  const d = daysLeft(p);
  if (d === null) return '';
  if (d < 0) return '<span class="badge bad">Истёк</span>';
  if (d <= SOON_DAYS) return `<span class="badge warn">${d} ${plural(d, 'день', 'дня', 'дней')}</span>`;
  return `<span class="badge ok">до ${fmtDate(expiryOf(p))}</span>`;
}

/* ───────────── Отрисовка ───────────── */

function card(p, extra = '') {
  const cat = catOf(p.category);
  const thumb = p.photo ? `<img src="${p.photo}" alt="">` : cat.emoji;
  const sub = [p.brand, p.rating ? '★'.repeat(p.rating) : ''].filter(Boolean).join(' · ') || cat.name;
  return `
    <div class="card" data-action="edit" data-id="${p.id}" role="button" tabindex="0">
      <div class="thumb">${thumb}</div>
      <div class="info">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${esc(sub)}</div>
      </div>
      <div class="side">${extra || expiryBadge(p)}</div>
    </div>`;
}

function empty(emoji, text) {
  return `<div class="empty"><div class="empty-emoji">${emoji}</div><p>${text}</p></div>`;
}

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
      ? empty('🔍', 'Ничего не нашлось')
      : empty('🌷', 'Здесь пока пусто.<br>Нажми «+», чтобы добавить первое средство.');
  }
  return items.map((p) => card(p)).join('');
}

function homeView() {
  const counts = Object.fromEntries(Object.keys(STATUSES).map((s) =>
    [s, state.products.filter((p) => p.status === s).length]));
  const opt = (id, label) => `<option value="${id}" ${state.category === id ? 'selected' : ''}>${label}</option>`;
  return `
    <div class="filters">
      <input id="q" class="search" type="search" placeholder="Поиск" value="${esc(state.query)}">
      <select id="cat" class="cat-select ${state.category !== 'all' ? 'on' : ''}" aria-label="Категория">
        ${opt('all', 'Все')}${CATEGORIES.map((c) => opt(c.id, `${c.emoji} ${c.name}`)).join('')}
      </select>
    </div>
    <div class="segmented">
      ${['active', 'stock', 'finished'].map((s) => `
        <button data-action="status" data-value="${s}" class="${state.status === s ? 'on' : ''}">
          ${STATUSES[s].short}${counts[s] ? ` <small>${counts[s]}</small>` : ''}
        </button>`).join('')}
    </div>
    <div id="list" class="list">${homeList()}</div>`;
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
    ? `<h2 class="section">${title}</h2><div class="list">${list.map((p) => card(p)).join('')}</div>` : '');

  if (!items.length && !noDate.length) return empty('⏳', 'Добавь даты вскрытия или сроки годности — и здесь появится напоминалка.');
  return section('Истёк срок', expired)
    + section(`Скоро истекает (≤ ${SOON_DAYS} дн.)`, soon)
    + section('Всё в порядке', later)
    + section('Без срока', noDate);
}

function wishView() {
  const items = state.products.filter((p) => p.status === 'wish').sort(byName);
  if (!items.length) return empty('🛍️', 'Список желаний пуст.<br>Добавь средство со статусом «Хочу купить».');
  const total = items.reduce((s, p) => s + (Number(p.price) || 0), 0);
  return `
    ${total ? `<p class="hint">Всего примерно ${fmtMoney(total)}</p>` : ''}
    <div class="list">${items.map((p) => card(p,
      `<button class="pill" data-action="bought" data-id="${p.id}">Купила</button>`)).join('')}</div>`;
}

function settingsView() {
  const owned = state.products.filter((p) => p.status === 'active' || p.status === 'stock');
  const sum = owned.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  return `
    <div class="stats">
      <div><b>${owned.length}</b><span>в косметичке</span></div>
      <div><b>${state.products.filter((p) => p.status === 'finished').length}</b><span>закончилось</span></div>
      <div><b>${sum ? fmtMoney(sum) : '—'}</b><span>стоимость</span></div>
    </div>

    ${standalone ? '' : `
    <h2 class="section">Установить на iPhone</h2>
    <div class="group text">
      Открой эту страницу в Safari → кнопка «Поделиться» → «На экран „Домой“».
      Приложение будет открываться как обычное, без адресной строки.
    </div>`}

    <h2 class="section">Резервная копия</h2>
    <div class="group">
      <button class="row-btn" data-action="export">Сохранить копию данных</button>
      <label class="row-btn">Загрузить из копии<input type="file" id="import-file" accept="application/json,.json" hidden></label>
    </div>
    <p class="hint">Все данные хранятся только на этом телефоне. Время от времени сохраняй копию в «Файлы» — так ничего не потеряется при смене телефона или очистке Safari.</p>

    <h2 class="section">Опасная зона</h2>
    <div class="group"><button class="row-btn danger-text" data-action="wipe">Удалить все данные</button></div>

    <p class="hint center">Косметичка v${APP_VERSION} · сделано с любовью для Юли 💗</p>`;
}

const views = { home: homeView, soon: soonView, wish: wishView, settings: settingsView };

function render() {
  $('#title').textContent = TITLES[state.tab];
  $('#main').innerHTML = views[state.tab]();
  $$('.tabbar [data-action="tab"]').forEach((b) => b.classList.toggle('active', b.dataset.value === state.tab));
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
    `<button type="button" data-action="star" data-value="${i}" class="${i <= n ? 'on' : ''}">★</button>`).join('');
}

function setPhotoPreview(src) {
  $('#photo-preview').innerHTML = src ? `<img src="${src}" alt="">` : '<span>📷<br>Фото</span>';
}

function openForm(product = null) {
  editing = product;
  pendingPhoto = undefined;
  const p = product || {
    category: state.category !== 'all' ? state.category : 'face',
    status: state.tab === 'wish' ? 'wish' : state.status,
  };
  const form = $('#form');
  form.reset();
  $('#sheet-title').textContent = product ? 'Редактировать' : 'Новое средство';
  form.name.value = p.name || '';
  form.brand.value = p.brand || '';
  fillSelect($('#f-category'), CATEGORIES.map((c) => [c.id, `${c.emoji} ${c.name}`]), p.category);
  fillSelect($('#f-status'), Object.entries(STATUSES).map(([id, s]) => [id, s.name]), p.status);
  fillSelect($('#f-pao'), [['', '—'], ...PAO_OPTIONS.map((m) => [m, `${m} мес.`])], p.paoMonths);
  form.openedAt.value = p.openedAt || '';
  form.expiresAt.value = p.expiresAt || '';
  form.price.value = p.price ?? '';
  form.notes.value = p.notes || '';
  setStars(p.rating || 0);
  setPhotoPreview(p.photo);
  $('#delete-btn').hidden = !product;
  $('#sheet').showModal();
}

function closeForm() { $('#sheet').close(); }

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
  toast(editing ? 'Сохранено' : 'Добавлено 💗');
}

// Сжимаем фото, чтобы не раздувать хранилище
function resizeImage(file, max = 640) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
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
  tab: (el) => { state.tab = el.dataset.value; render(); window.scrollTo(0, 0); },
  status: (el) => { state.status = el.dataset.value; render(); },
  category: (el) => { state.category = el.dataset.value; render(); },
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
    toast('Перенесено в запас 🎉');
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

// Закрытие шторки тапом по затемнению
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeForm(); });

/* ───────────── Тост ───────────── */

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ───────────── Старт ───────────── */

async function load() {
  state.products = await db.all();
  render();
}

load();

// Просим браузер не удалять данные при нехватке места
navigator.storage?.persist?.();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
