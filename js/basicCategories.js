/**
 * Семантические группы basic-словаря (таблица + фильтры канваса).
 *
 * @typedef {{ id: string, label: string, color: string, hint: string }} BasicCategory
 */

/** @type {BasicCategory[]} */
export const BASIC_CATEGORIES = [
  { id: "number", label: "Числа", color: "#e8b45c", hint: "〇 一 二 … 億" },
  { id: "color", label: "Цвета", color: "#e87878", hint: "赤 青 黄 緑" },
  { id: "direction", label: "Стороны", color: "#6aaef0", hint: "東西南北 上下" },
  { id: "time", label: "Время", color: "#c07bd4", hint: "年 月 日 時" },
  { id: "size", label: "Размер", color: "#a894f0", hint: "大 小 多 少" },
  { id: "nature", label: "Природа", color: "#5ec98a", hint: "人 山 川 雨" },
];

const CATEGORY_ORDER = BASIC_CATEGORIES.map((c) => c.id);
const CATEGORY_BY_ID = Object.fromEntries(BASIC_CATEGORIES.map((c) => [c.id, c]));

/** @param {{ category?: string }} item */
export function getBasicCategory(item) {
  return CATEGORY_BY_ID[item.category] ? item.category : "nature";
}

export function getCategoryMeta(id) {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.nature;
}

export function listCategoryIds() {
  return CATEGORY_ORDER.slice();
}
