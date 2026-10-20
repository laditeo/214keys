export function getAppBase() {
  try {
    const path = window.location.pathname.replace(/\/index\.html$/i, "");
    const up = [];
    if (isBetaChannel(path)) up.push("..");
    if (isBasicChannel(path)) up.push("..");
    if (isPinyinChannel(path)) up.push("..");
    return up.length ? `${up.join("/")}/` : "";
  } catch {
    /* ignore */
  }
  return "";
}

export function isBetaChannel(pathname = window.location.pathname) {
  const path = pathname.replace(/\/index\.html$/i, "");
  return path.includes("/beta/") || /\/beta\/?$/.test(path);
}

export function isBasicChannel(pathname = window.location.pathname) {
  const path = pathname.replace(/\/index\.html$/i, "");
  return path.includes("/basic/") || /\/basic\/?$/.test(path);
}

export function isPinyinChannel(pathname = window.location.pathname) {
  const path = pathname.replace(/\/index\.html$/i, "");
  return path.includes("/pynpinyin/") || /\/pynpinyin\/?$/.test(path);
}

export function appAssetUrl(relativePath) {
  return `${getAppBase()}${relativePath}`;
}
