import { bool, color, family, int, key, list, map, num, object, oneOf, padding, path, text } from "../schema.mjs";

const border = object({ width: num(0, 20), color, style: oneOf("solid", "dashed", "dotted", "double") });
const shadows = oneOf("none", "soft", "medium", "strong", "glow", "emboss");

const PROPS = {
  font: family, fallback: family, generic: oneOf("serif", "sans-serif", "monospace", "cursive"),
  size: num(4, 400), weight: int(100, 900), style: oneOf("normal", "italic"), color, background: color,
  transform: oneOf("none", "uppercase", "lowercase", "smallCaps"), letterSpacing: num(-0.5, 3), lineHeight: num(0.7, 4),
  align: oneOf("left", "center", "right", "justify"), indent: num(0, 20), hanging: num(0, 20),
  marginTop: num(0, 300), marginBottom: num(0, 300),
  border, borderTop: border, borderBottom: border, borderLeft: border,
  underline: oneOf("none", "solid", "dotted", "wavy"), shadow: shadows, radius: num(0, 200), padding, tilt: num(-45, 45)
};

const element = (extra = {}) => object({ ...PROPS, ...extra });
const place = oneOf("top left", "top right", "bottom left", "bottom right");

const ELEMENTS = {
  ...Object.fromEntries(["h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "u", "s", "a", "code", "cite", "li",
    "contentLink", "inlineRoll", "secret", "img", "figcaption"].map(name => [name, element()])),
  blockquote: element({ variant: oneOf("plain", "tape", "seal") }),
  ul: element({ bullet: text(4), bulletColor: color }),
  ol: element({ numbering: oneOf("decimal", "roman", "alpha"), bulletColor: color }),
  hr: element({ type: oneOf("line", "double", "dashed", "fade", "ornament"), symbol: text(8), symbolSize: num(0.4, 4), symbolFont: family, width: num(0, 12), length: num(5, 100) }),
  table: element({ header: element(), cell: element(), stripedRows: color }),
  dropCap: element({ enabled: bool, lines: int(2, 8), scale: num(0.3, 2) })
};

const WATERMARK = object({ type: oneOf("none", "text", "image"), resource: key, opacity: num(0, 1), size: num(1, 600), text: text(40), color, font: family, weight: int(100, 900), tilt: num(-90, 90) });
const ORNAMENTS = {
  coverTitle: element({ layout: oneOf("center", "plate", "sticker", "label", "low"), top: num(0, 90) }),
  watermark: WATERMARK,
  folio: element({ format: text(40), position: oneOf("center", "outer"), numbering: oneOf("decimal", "roman") }),
  corners: object({ style: oneOf("none", "fold", "triangle", "symbol"), color, symbol: text(4), font: family, size: num(4, 80) }),
  header: element({ enabled: bool }),
  stamp: element({ text: text(30), resource: key, position: place, offsetX: num(-200, 400), offsetY: num(-200, 400), opacity: num(0, 1) })
};

const FRAME = object({ enabled: bool, color, double: bool, style: oneOf("solid", "brackets"), inset: num(0, 80), width: num(0, 12) });
const PATTERN = object({ type: oneOf("none", "ruled", "grid", "scanlines", "dots"), color, size: num(2, 200), margin: num(0, 200), marginColor: color, offset: num(-200, 200) });
const PAPER = object({
  color, image: key, imageOpacity: num(0, 1), fit: oneOf("cover", "contain", "repeat"), noise: num(0, 1), vignette: num(0, 1), vignetteColor: color,
  frame: FRAME, pattern: PATTERN, edge: oneOf("straight", "deckle", "torn"), seed: int(1, 99999), columns: int(1, 4),
  inset: num(0, 120), tilt: num(-20, 20), attach: oneOf("tape", "clip", "seal")
});

const TYPOGRAPHY = object({ base: element() });
const SHEET_PARTS = { paper: PAPER, typography: TYPOGRAPHY, elements: object(ELEMENTS), ornaments: object(ORNAMENTS) };

export const values = {
  theme: object({
    name: text(80), author: object({ id: text(40), name: text(80) }), visibility: oneOf("all", "author"), moduleVersion: text(20),
    importedFrom: text(80), updatedBy: text(40), updatedAt: num(0, Number.MAX_SAFE_INTEGER),
    resources: object({
      images: map(object({ path, status: oneOf("ready", "pending") })),
      fonts: map(object({ status: oneOf("ready", "pending") }), family),
      sounds: map(object({ path, status: oneOf("ready", "pending") }))
    })
  }),
  styles: object({
    palette: map(color),
    surfaces: object({
      background: object({ color, highlight: color, image: key, fit: oneOf("cover", "contain", "repeat") }),
      cover: object({ color, image: key, fit: oneOf("cover", "contain", "repeat"), texture: oneOf("leather", "cloth", "metal", "none"), width: num(0, 60), radius: num(0, 60), shadow: oneOf("none", "soft", "medium", "strong", "glow") }),
      endpaper: PAPER,
      paper: PAPER,
      spine: object({ shadow: num(0, 1), width: num(0, 200) }),
      mount: object({ color, image: key, line: color, rod: color })
    }),
    typography: TYPOGRAPHY,
    elements: object(ELEMENTS),
    ornaments: object(ORNAMENTS),
    sheets: map(object({ name: text(60), ...SHEET_PARTS })),
    retiredSheets: list(key, 200)
  }),
  effect: object({
    transition: object({
      type: oneOf("flip3d", "roll", "shuffle", "slide", "none"), durationMs: int(200, 2000), easing: oneOf("linear", "smooth", "easeOut"),
      leafShadow: num(0, 1), bend: num(0, 1),
      bundle: object({ pxPerLeaf: num(0.1, 10), maxThickness: num(0, 100), lineRatio: num(0, 2), maxLines: int(2, 30) })
    }),
    sound: object({ enabled: bool, resource: key, volume: num(0, 1) }),
    layout: object({ mode: oneOf("auto", "double", "single", "scroll", "stack"), minSpreadWidth: int(300, 4000) }),
    navigation: object({ sideArrows: bool, corners: bool, keyboard: bool, mouseWheel: bool, dragCorner: bool }),
    toc: object({ visible: bool, startCollapsed: bool, position: oneOf("left", "right") }),
    pagination: object({ mode: oneOf("perPage", "columns") })
  })
};

export const structure = {
  theme: { required: { name: "string", resources: "object" }, optional: { author: "object", visibility: "string", moduleVersion: "string", importedFrom: "string", updatedBy: "string", updatedAt: "number" } },
  styles: { required: { palette: "object", surfaces: "object", typography: "object", elements: "object", ornaments: "object" }, optional: { sheets: "object", retiredSheets: "array" } },
  effect: { required: { transition: "object" }, optional: { sound: "object", layout: "object", navigation: "object", toc: "object", pagination: "object" } }
};
