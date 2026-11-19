const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function merge(base, extra) {
  const out = { ...base };
  for (const [name, value] of Object.entries(extra ?? {})) out[name] = isObject(value) && isObject(base?.[name]) ? merge(base[name], value) : value;
  return out;
}

export const DEFAULT_STYLES = {
  palette: { ink: "#2b2118", inkSoft: "#6b5a45", accent: "#7a1f17", accentSoft: "#a4533d", metal: "#a17c32", paper: "#ecdfc0", cover: "#4c2c19" },
  surfaces: {
    background: { color: "#0f0b08", highlight: "#33261c" },
    cover: { color: "$cover", texture: "none", width: 14, radius: 8, shadow: "strong" },
    paper: { color: "$paper", noise: 0.3, vignette: 0.1, edge: "straight" },
    spine: { shadow: 0.5, width: 90 }
  },
  typography: { base: { fallback: "Signika", generic: "sans-serif", size: 15.5, lineHeight: 1.45, color: "$ink" } },
  elements: {},
  ornaments: {
    coverTitle: { layout: "center", size: 26, weight: 700, color: "#dcbc6a", transform: "uppercase", shadow: "emboss" },
    folio: { format: "· {n} ·", color: "$inkSoft" }
  }
};

export const DEFAULT_EFFECT = {
  transition: { type: "flip3d", durationMs: 900, easing: "smooth", leafShadow: 0.35, bend: 0.35, bundle: { pxPerLeaf: 0.6, maxThickness: 24, lineRatio: 0.3, maxLines: 14 } },
  sound: { enabled: false, volume: 0.5 },
  layout: { mode: "auto", minSpreadWidth: 900 },
  navigation: { sideArrows: true, corners: true, keyboard: true, mouseWheel: false, dragCorner: true },
  toc: { visible: true, startCollapsed: false, position: "left" },
  pagination: { mode: "perPage" }
};

const SHEET_PARTS = ["paper", "typography", "elements", "ornaments"];

export function resolveTheme(files) {
  const styles = merge(DEFAULT_STYLES, files.styles);
  const main = { paper: styles.surfaces.paper, typography: styles.typography, elements: styles.elements, ornaments: styles.ornaments };
  const sheets = { main };
  const names = {};
  for (const [id, sub] of Object.entries(files.styles.sheets ?? {})) {
    sheets[id] = merge(main, Object.fromEntries(SHEET_PARTS.filter(part => sub[part]).map(part => [part, sub[part]])));
    names[id] = sub.name ?? id;
  }
  return {
    meta: files.theme,
    resources: files.theme.resources ?? {},
    palette: styles.palette,
    surfaces: styles.surfaces,
    sheets,
    sheetNames: names,
    effect: merge(DEFAULT_EFFECT, files.effect)
  };
}
