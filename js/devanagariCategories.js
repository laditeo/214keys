/**
 * Группы слогов деванагари (таблица + фильтры канваса).
 */

export const DEVANAGARI_CATEGORIES = [
  { id: "short", label: "Короткие", color: "#e8b45c", hint: "अ इ उ" },
  { id: "long", label: "Длинные", color: "#6aaef0", hint: "आ ई ऊ" },
  { id: "diphthong", label: "Дифтонги", color: "#5ec98a", hint: "ए ऐ ओ औ" },
  { id: "nasal", label: "Назальные", color: "#c07bd4", hint: "अं अः" },
];

const CATEGORY_ORDER = DEVANAGARI_CATEGORIES.map((c) => c.id);
const CATEGORY_BY_ID = Object.fromEntries(DEVANAGARI_CATEGORIES.map((c) => [c.id, c]));

export function getDevanagariCategory(item) {
  return CATEGORY_BY_ID[item.category] ? item.category : "short";
}

export function getDevanagariCategoryMeta(id) {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.short;
}

export function listDevanagariCategoryIds() {
  return CATEGORY_ORDER.slice();
}