import radicals from "./radicals.js";
import basicItems from "./basicItems.js";
import pinyinItems from "./pinyinItems.js?v=198";
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
import {
  PINYIN_CATEGORIES,
  getPinyinCategoryMeta as getPinyinCategoryMeta,
  getPinyinCategory,
} from "./pinyinCategories.js?v=198";
import { getRadicalEmoji as getKangxiEmoji } from "./radicalEmoji.js";
import { getBasicEmoji, getBasicInkColor, getBasicInkContrast } from "./basicEmoji.js?v=198";

export function getCatalogId() {
  try {
    if (document.documentElement.dataset.catalog === "basic") return "basic";
    if (document.documentElement.dataset.catalog === "pinyin") return "pinyin";
    const path = window.location.pathname.replace(/\/index\.html$/i, "");
    if (/(?:^|\/)basic\/?$/.test(path) || path.includes("/basic/")) return "basic";
    if (/(?:^|\/)pynpinyin\/?$/.test(path) || path.includes("/pynpinyin/")) return "pinyin";
  } catch {
    /* ignore */
  }
  return "radicals";
}

export const catalogId = getCatalogId();
export const isBasicCatalog = catalogId === "basic";
export const isPinyinCatalog = catalogId === "pinyin";
export const hasSpeechAudio = true;
export const hasSfxAudio = !isPinyinCatalog;
export const hasLocalAudio = hasSpeechAudio;
export const speechAudioDir = isPinyinCatalog
  ? "audio/pinyin"
  : (isBasicCatalog ? "audio/basic" : "audio");
export const sfxAudioDir = isBasicCatalog ? "audio/basic/sfx" : "audio/sfx";

export const items = isPinyinCatalog ? pinyinItems : (isBasicCatalog ? basicItems : radicals);
export const CATEGORIES = isPinyinCatalog ? PINYIN_CATEGORIES : (isBasicCatalog ? BASIC_CATEGORIES : RADICAL_CATEGORIES);
export const RADICAL_CATEGORIES_FOR_UI = CATEGORIES;

export const canvasStorageKey = isPinyinCatalog
  ? "214keys-pinyin-spatial-v1"
  : (isBasicCatalog
    ? "214keys-basic-spatial-v1"
    : "214keys-spatial-canvas-v12");

export function getItemCategory(item) {
  if (isPinyinCatalog) return getPinyinCategory(item);
  return isBasicCatalog ? getBasicCategory(item) : getRadicalItemCategory(item);
}

export function getCategoryMeta(id) {
  if (isPinyinCatalog) return getPinyinCategoryMeta(id);
  return isBasicCatalog ? getBasicCategoryMeta(id) : getRadicalCategoryMeta(id);
}

export function getItemEmoji(id) {
  if (isPinyinCatalog) return "";
  return isBasicCatalog ? getBasicEmoji(id) : getKangxiEmoji(id);
}

export function getItemInkColor(id) {
  if (isPinyinCatalog) return "";
  return isBasicCatalog ? getBasicInkColor(id) : "";
}

export function getItemInkContrast(id) {
  if (isPinyinCatalog) return "";
  return isBasicCatalog ? getBasicInkContrast(id) : "";
}

export function itemGroupKey(item) {
  return item.group ?? `strokes:${item.strokes}`;
}

export function itemGroupLabel(item) {
  return item.groupLabel || null;
}

export function searchHitWord(count) {
  if (isPinyinCatalog) {
    if (count === 1) return "слог";
    if (count >= 2 && count <= 4) return "слога";
    return "слогов";
  }
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
  if (isPinyinCatalog) {
    return `${item.cn} · ${item.char}`;
  }
  if (isBasicCatalog) {
    const group = item.groupLabel ? `${item.groupLabel} · ` : "";
    return `${group}#${item.id}`;
  }
  return `#${item.id} · 部首 ${item.id}`;
}

export { items as default };
export { getItemCategory as getRadicalCategory };
export { getItemEmoji as getRadicalEmoji };
