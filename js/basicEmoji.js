/** Semantic emoji for the basic kanji/hanzi set. */
export const basicEmoji = {
  1: "⭕",
  2: "0️⃣",
  3: "1️⃣",
  4: "2️⃣",
  5: "3️⃣",
  6: "4️⃣",
  7: "5️⃣",
  8: "6️⃣",
  9: "7️⃣",
  10: "8️⃣",
  11: "9️⃣",
  12: "🔟",
  13: "💯",
  14: "🔢",
  15: "🔟",
  16: "🏦",
  17: "🌗",
  18: "❤️",
  19: "🧡",
  20: "💛",
  21: "💚",
  22: "💙",
  23: "💜",
  24: "🤍",
  25: "🖤",
  26: "🌫️",
  27: "🤎",
  28: "💗",
  29: "💙",
  30: "🥇",
  31: "🥈",
  32: "🌅",
  33: "🌇",
  34: "🌴",
  35: "🧊",
  36: "🔝",
  37: "🔽",
  38: "◀️",
  39: "▶️",
  40: "🎯",
  41: "⏩",
  42: "⏪",
  43: "📥",
  44: "📤",
  45: "📅",
  46: "🌙",
  47: "☀️",
  48: "⏰",
  49: "✂️",
  50: "⏱️",
  51: "✨",
  52: "📆",
  53: "🐘",
  54: "🐭",
  55: "📚",
  56: "🌱",
  57: "📏",
  58: "📌",
  59: "🏔️",
  60: "📉",
  61: "🧑",
  62: "⛰️",
  63: "〰️",
  64: "🌌",
  65: "☁️",
  66: "🌊",
  67: "🌸",
  68: "🌧️",
  69: "🌬️",
  70: "❄️",
  71: "🔥",
  72: "💧",
  73: "🌳",
  74: "🌍",
};

export function getBasicEmoji(id) {
  return basicEmoji[id] || "🔹";
}

/** Ink color for the kanji itself when "свои цвета" is on. */
export const basicInkColors = {
  18: "#e23b3b",
  19: "#e8872a",
  20: "#e2c12a",
  21: "#3aa35c",
  22: "#3b7ed4",
  23: "#8a4ec8",
  24: "#f7f3eb",
  25: "#1a1815",
  26: "#8a8278",
  27: "#8b5724",
  28: "#e889ab",
  29: "#3a4ea3",
  30: "#d4a017",
  31: "#b7b7c0",
};

const PALE_INK_IDS = new Set([20, 24, 30, 31]);
const DARK_INK_IDS = new Set([25]);

export function getBasicInkColor(id) {
  return basicInkColors[id] || "";
}

export function getBasicInkContrast(id) {
  if (PALE_INK_IDS.has(id)) return "pale";
  if (DARK_INK_IDS.has(id)) return "dark";
  return "";
}
