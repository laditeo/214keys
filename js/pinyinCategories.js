/**
 * Группы слогов пиньиня (таблица + фильтры канваса).
 */

/** @type {{ id: string, label: string, color: string, hint: string }[]} */
export const PINYIN_CATEGORIES = [
  { id: "a", label: "Группа a", color: "#e8b45c", hint: "a o e ai ei ao ou an en ang eng er" },
  { id: "i", label: "Группа i", color: "#6aaef0", hint: "i ia ie iao iu ian in iang ing" },
  { id: "u", label: "Группа u", color: "#5ec98a", hint: "u ua uo uai ui uan un uang ong" },
  { id: "ü", label: "Группа ü", color: "#c07bd4", hint: "ü üe üan ün iong" },
  { id: "special", label: "Целые слоги", color: "#f4efe6", hint: "zhi chi shi ri zi ci si" },
];

const CATEGORY_ORDER = PINYIN_CATEGORIES.map((c) => c.id);
const CATEGORY_BY_ID = Object.fromEntries(PINYIN_CATEGORIES.map((c) => [c.id, c]));

/** @param {{ category?: string }} item */
export function getPinyinCategory(item) {
  return CATEGORY_BY_ID[item.category] ? item.category : "a";
}

export function getPinyinCategoryMeta(id) {
  return CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.a;
}

export function listPinyinCategoryIds() {
  return CATEGORY_ORDER.slice();
}
