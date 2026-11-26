// Настройки приложения. Чтобы добавить категорию или статус — правь здесь,
// остальной код подхватит изменения сам.

export const APP_VERSION = '0.2.0';

// За сколько дней до окончания срока подсвечивать средство как «скоро истекает»
export const SOON_DAYS = 30;

export const CATEGORIES = [
  // icon — имя иконки из js/icons.js, tint — градиент заглушки без фото
  { id: 'face',    name: 'Уход за лицом', icon: 'jar',      tint: ['#f6d6dc', '#d98a9c'] },
  { id: 'makeup',  name: 'Макияж',        icon: 'lipstick', tint: ['#f3cfd6', '#c25d78'] },
  { id: 'hair',    name: 'Волосы',        icon: 'hair',     tint: ['#f2dccb', '#c99272'] },
  { id: 'body',    name: 'Тело',          icon: 'pump',     tint: ['#e6dcef', '#a48bc2'] },
  { id: 'nails',   name: 'Ногти',         icon: 'polish',   tint: ['#f6d2cf', '#d9786e'] },
  { id: 'perfume', name: 'Парфюм',        icon: 'perfume',  tint: ['#efd9e8', '#b8739e'] },
  { id: 'other',   name: 'Другое',        icon: 'sparkle',  tint: ['#f1e2d6', '#c9a27f'] },
];

export const STATUSES = {
  active:   { name: 'Пользуюсь',   short: 'В деле' },
  stock:    { name: 'В запасе',    short: 'Запас' },
  finished: { name: 'Закончилось', short: 'Закончились' },
  wish:     { name: 'Хочу купить', short: 'Хочу' },
};

// Варианты PAO — срок годности после вскрытия (значок открытой баночки «12M»)
export const PAO_OPTIONS = [3, 6, 9, 12, 18, 24, 36];
