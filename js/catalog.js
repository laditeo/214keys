import radicals from "./radicals.js";
import basicItems from "./basicItems.js";
import {
  RADICAL_CATEGORIES,
  getCategoryMeta as getRadicalCategoryMeta,
  getRadicalCategory as getRadicalItemCategory,
} from "./radicalCategories.js";
import {
  BASIC_CATEGORIES,
  getCategoryMeta as getBasicCategoryMeta,
  getBasicCategory,
} from "./basicCategories.js";
import { getRadicalEmoji as getKangxiEmoji } from "./radicalEmoji.js";
import { getBasicEmoji } from "./basicEmoji.js";

export function getCatalogId() {
  try {
    if (document.documentElement.dataset.catalog === "basic") return "basic";
    const path = window.location.pathname.replace(/\/index\.html$/i, "");
    if (/(?:^|\/)basic\/?$/.test(path) || path.includes("/basic/")) return "basic";
  } catch {
    /* ignore */
  }
  return "radicals";
}

export const catalogId = getCatalogId();
export const isBasicCatalog = catalogId === "basic";
export const hasSpeechAudio = true;
export const hasSfxAudio = true;
export const hasLocalAudio = hasSpeechAudio;
export const speechAudioDir = isBasicCatalog ? "audio/basic" : "audio";
export const sfxAudioDir = isBasicCatalog ? "audio/basic/sfx" : "audio/sfx";

export const items = isBasicCatalog ? basicItems : radicals;
export const CATEGORIES = isBasicCatalog ? BASIC_CATEGORIES : RADICAL_CATEGORIES;
export const RADICAL_CATEGORIES_FOR_UI = CATEGORIES;

export const canvasStorageKey = isBasicCatalog
  ? "214keys-basic-spatial-v1"
  : "214keys-spatial-canvas-v12";

export function getItemCategory(item) {
  return isBasicCatalog ? getBasicCategory(item) : getRadicalItemCategory(item);
}

export function getCategoryMeta(id) {
  return isBasicCatalog ? getBasicCategoryMeta(id) : getRadicalCategoryMeta(id);
}

export function getItemEmoji(id) {
  return isBasicCatalog ? getBasicEmoji(id) : getKangxiEmoji(id);
}

export function itemGroupKey(item) {
  return item.group ?? `strokes:${item.strokes}`;
}

export function itemGroupLabel(item) {
  return item.groupLabel || null;
}

export function searchHitWord(count) {
  if (isBasicCatalog) {
    if (count === 1) return "знак";
    if (count >= 2 && count <= 4) return "знака";
    return "знаков";
  }
  if (count === 1) return "ключ";
  if (count >= 2 && count <= 4) return "ключа";
  return "ключей";
}

export function modalIndexLabel(item) {
  if (isBasicCatalog) {
    const group = item.groupLabel ? `${item.groupLabel} · ` : "";
    return `${group}#${item.id}`;
  }
  return `#${item.id} · 部首 ${item.id}`;
}

export { items as default };
export { getItemCategory as getRadicalCategory };
export { getItemEmoji as getRadicalEmoji };
