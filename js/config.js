// Настройки приложения. Чтобы добавить категорию или статус — правь здесь,
// остальной код подхватит изменения сам.

export const APP_VERSION = '0.1.1';

// За сколько дней до окончания срока подсвечивать средство как «скоро истекает»
export const SOON_DAYS = 30;

export const CATEGORIES = [
  { id: 'face',    name: 'Уход за лицом', emoji: '🧴' },
  { id: 'makeup',  name: 'Макияж',        emoji: '💄' },
  { id: 'hair',    name: 'Волосы',        emoji: '💇‍♀️' },
  { id: 'body',    name: 'Тело',          emoji: '🛁' },
  { id: 'nails',   name: 'Ногти',         emoji: '💅' },
  { id: 'perfume', name: 'Парфюм',        emoji: '🌸' },
  { id: 'other',   name: 'Другое',        emoji: '✨' },
];

export const STATUSES = {
  active:   { name: 'Пользуюсь',   short: 'В деле' },
  stock:    { name: 'В запасе',    short: 'Запас' },
  finished: { name: 'Закончилось', short: 'Закончились' },
  wish:     { name: 'Хочу купить', short: 'Хочу' },
};

// Варианты PAO — срок годности после вскрытия (значок открытой баночки «12M»)
export const PAO_OPTIONS = [3, 6, 9, 12, 18, 24, 36];
