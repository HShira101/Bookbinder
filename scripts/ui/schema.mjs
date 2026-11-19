import { TYPES, applyType, getPath, setPath } from "../theme/design.mjs";

export const HEX = /^#[0-9a-f]{6}$/i;
export const PALETTE_KEYS = ["ink", "inkSoft", "accent", "accentSoft", "metal", "paper", "cover", "glow"];
const SHEET_PARTS = ["paper", "typography", "elements", "ornaments"];
const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"];
const TEXTURES = {
  ruled: { type: "ruled", color: "rgba(70,110,170,.33)", size: 26, offset: 0, margin: 21, marginColor: "rgba(200,70,70,.45)" },
  grid: { type: "grid", color: "rgba(60,120,170,.22)", size: 18 }
};

const lastSegment = path => path.split(".").at(-1);
export const labelKey = field => (field.type === "heading" ? `Headings.${field.id}` : `Fields.${field.id ?? lastSegment(field.path)}`);
export const optionKey = (field, value) => `Options.${field.group}.${value}`;
export const hintKey = field => `Hints.${field.id}`;

export const isSheetPath = path => SHEET_PARTS.includes(path.split(".")[0]);
export const sheetPath = (path, sheet) => (sheet === "main" ? `styles.${path.startsWith("paper.") ? "surfaces." : ""}${path}` : `styles.sheets.${sheet}.${path}`);
export const fullPath = (path, sheet) => (isSheetPath(path) ? sheetPath(path, sheet) : path);
export const inSubSheet = (ctx, path) => ctx.sheet !== "main" && isSheetPath(path);
export const read = (ctx, path) => getPath(ctx.files, fullPath(path, ctx.sheet)) ?? (inSubSheet(ctx, path) ? getPath(ctx.files, sheetPath(path, "main")) : undefined);
export const write = (ctx, path, value) => setPath(ctx.files, fullPath(path, ctx.sheet), value);
export const orClear = (ctx, path, value) => (inSubSheet(ctx, path) ? value : undefined);
export const imageOf = (ctx, key) => (key && key !== "none" ? ctx.files.theme.resources.images?.[key] : null);

const typeIs = (...ids) => ctx => ids.includes(TYPES.find(type => type.transition === ctx.files.effect.transition.type)?.id);
const onSubSheet = ctx => ctx.sheet !== "main";
const hasImage = path => ctx => Boolean(imageOf(ctx, read(ctx, path)));
const valueIs = (path, ...values) => ctx => values.includes(read(ctx, path));
const both = (...tests) => ctx => tests.every(test => test(ctx));
const defaults = (base, values) => ctx => {
  for (const [name, value] of Object.entries(values)) if (read(ctx, `${base}.${name}`) === undefined) write(ctx, `${base}.${name}`, value);
};

const heading = (id, extra) => ({ type: "heading", id, ...extra });
const range = (path, min, max, step, extra) => ({ path, type: "range", min, max, step, ...extra });
const colorField = (path, extra) => ({ path, type: "color", ...extra });
const choice = (path, group, values, extra) => ({ path, type: "select", group, values, required: true, ...extra });
const toggle = (path, extra) => ({ path, type: "toggle", ...extra });
const text = (path, extra) => ({ path, type: "text", ...extra });
const imageField = (path, extra) => ({ path, type: "image", ...extra });
const fontField = (path, id, extra) => ({ path, id, type: "font", ...extra });

const NUMERIC = new Set(["number", "range"]);

export function parseValue(field, raw, checked = false) {
  if (field.type === "toggle") return checked;
  if (raw === "") return field.type === "text" || field.type === "swatch" ? raw : undefined;
  return NUMERIC.has(field.type) || (field.type === "select" && field.numeric) ? Number(raw) : raw;
}

function textureField(base, values, extra) {
  return {
    id: "texture", type: "select", group: "texture", values, required: true, rerender: true, paths: ["image", "pattern", "noise"].map(key => `${base}.${key}`), ...extra,
    get: ctx => {
      const pattern = read(ctx, `${base}.pattern`)?.type;
      if (imageOf(ctx, read(ctx, `${base}.image`))) return "image";
      return TEXTURES[pattern] || pattern === "dots" ? pattern : read(ctx, `${base}.noise`) > 0.05 ? "grain" : "blank";
    },
    set: (ctx, value) => {
      if (value === "image") return ctx.pickImage(`${base}.image`);
      write(ctx, `${base}.pattern`, TEXTURES[value] ? structuredClone(TEXTURES[value]) : value === "dots" ? { type: "dots", color: "rgba(0,0,0,.25)", size: 14 } : orClear(ctx, `${base}.pattern`, { type: "none" }));
      write(ctx, `${base}.image`, orClear(ctx, `${base}.image`, "none"));
      write(ctx, `${base}.noise`, value === "blank" ? 0 : value === "grain" ? 0.5 : read(ctx, `${base}.noise`) ?? 0.25);
    }
  };
}

const FRAME = {
  id: "frame", type: "select", group: "frame", required: true, rerender: true, w: 1, paths: ["paper.frame"], values: ["none", "simple", "double", "brackets"],
  get: ctx => {
    const frame = read(ctx, "paper.frame") ?? {};
    return !frame.enabled ? "none" : frame.style === "brackets" ? "brackets" : frame.double ? "double" : "simple";
  },
  set: (ctx, value) => write(ctx, "paper.frame", { color: "$metal", inset: 12, ...read(ctx, "paper.frame"), enabled: value !== "none", double: value === "double", style: value === "brackets" ? "brackets" : "solid" })
};

const TITLE_FONT = {
  id: "titleFont", type: "font", paths: HEADINGS.map(name => `elements.${name}.font`),
  get: ctx => read(ctx, "elements.h1.font") ?? read(ctx, "typography.base.font"),
  set: (ctx, value) => HEADINGS.forEach(name => write(ctx, `elements.${name}.font`, value))
};

const TYPE_FIELD = {
  id: "type", type: "cards", w: 1, rerender: true,
  options: TYPES.map(type => ({ id: type.id, disabled: !type.available })),
  get: ctx => TYPES.find(type => type.transition === ctx.files.effect.transition.type)?.id ?? "book",
  set: (ctx, value) => applyType(ctx.files, value)
};

export const SECTIONS = {
  base: [
    text("theme.name", { id: "name", w: 1 }),
    choice("theme.visibility", "visibility", ["all", "author"], { w: 1 }),
    TYPE_FIELD,
    heading("palette"),
    ...PALETTE_KEYS.map(name => ({ path: `styles.palette.${name}`, type: "swatch", id: `palette.${name}`, when: ctx => HEX.test(ctx.files.styles.palette[name] ?? "") }))
  ],
  background: [
    colorField("styles.surfaces.background.color", { id: "color", w: 1 }),
    colorField("styles.surfaces.background.highlight", { id: "highlight" }),
    imageField("styles.surfaces.background.image", { id: "image", w: 1 })
  ],
  cover: [
    colorField("styles.surfaces.cover.color", { id: "color", w: 1, when: typeIs("book", "pad") }),
    choice("styles.surfaces.cover.texture", "coverTexture", ["none", "leather", "cloth", "metal"], { id: "texture", w: 1, when: typeIs("book", "pad") }),
    imageField("styles.surfaces.cover.image", { id: "image", w: 1, when: typeIs("book", "pad") }),
    range("styles.surfaces.cover.radius", 0, 30, 1, { id: "radius", when: typeIs("book", "pad") }),
    choice("styles.ornaments.coverTitle.layout", "coverTitle", ["center", "plate", "sticker", "label", "low"], { id: "titlePosition", w: 1, when: typeIs("book"), hint: true }),
    fontField("styles.ornaments.coverTitle.font", "coverFont", { w: 1, when: typeIs("book") }),
    colorField("styles.ornaments.coverTitle.color", { id: "titleColor", when: typeIs("book") }),
    { path: "styles.ornaments.coverTitle.size", type: "number", min: 10, max: 60, step: 1, id: "titleSize", when: typeIs("book") },
    heading("endpaper", { w: 1, when: typeIs("book") }),
    colorField("styles.surfaces.endpaper.color", { id: "color", w: 1, when: typeIs("book") }),
    textureField("styles.surfaces.endpaper", ["blank", "grain", "dots", "image"], { w: 1, when: typeIs("book") }),
    imageField("styles.surfaces.endpaper.image", { id: "endpaperImage", w: 1, when: both(typeIs("book"), hasImage("styles.surfaces.endpaper.image")) }),
    range("styles.surfaces.spine.shadow", 0, 1, 0.05, { id: "spineShadow", when: typeIs("book") })
  ],
  paper: [
    colorField("paper.color", { id: "color", w: 2 }),
    textureField("paper", ["blank", "grain", "ruled", "grid", "image"], { w: 2 }),
    imageField("paper.image", { id: "paperImage", w: 2, when: hasImage("paper.image") }),
    range("paper.imageOpacity", 0, 1, 0.05, { id: "imageOpacity", when: hasImage("paper.image") }),
    range("paper.noise", 0, 1, 0.05, { id: "noise" }),
    range("paper.vignette", 0, 1, 0.05, { id: "vignette" }),
    choice("paper.edge", "edge", ["straight", "deckle", "torn"], { w: 1 }),
    FRAME,
    colorField("paper.frame.color", { id: "frameColor", when: ctx => read(ctx, "paper.frame")?.enabled }),
    choice("paper.columns", "columns", [1, 2, 3], { numeric: true }),
    heading("loose", { when: onSubSheet }),
    range("paper.inset", 0, 40, 1, { id: "inset", when: onSubSheet, hint: true }),
    range("paper.tilt", -4, 4, 0.1, { id: "tilt", when: onSubSheet }),
    choice("paper.attach", "attach", ["none", "tape", "clip", "seal"], { when: onSubSheet })
  ],
  ornaments: [
    heading("folio"),
    text("ornaments.folio.format", { id: "folioFormat", hint: true }),
    choice("ornaments.folio.position", "folioPosition", ["center", "outer"], { id: "folioPosition" }),
    choice("ornaments.folio.numbering", "numbering", ["decimal", "roman"]),
    fontField("ornaments.folio.font", "folioFont"),
    colorField("ornaments.folio.color", { id: "color" }),
    heading("corners"),
    choice("ornaments.corners.style", "corners", ["none", "fold", "triangle", "symbol"], { id: "cornerStyle", rerender: true, after: defaults("ornaments.corners", { color: "$metal", symbol: "✦" }) }),
    colorField("ornaments.corners.color", { id: "color", when: valueIs("ornaments.corners.style", "fold", "triangle", "symbol") }),
    text("ornaments.corners.symbol", { id: "symbol", when: valueIs("ornaments.corners.style", "symbol") }),
    heading("watermark"),
    choice("ornaments.watermark.type", "watermark", ["none", "text", "image"], { id: "watermarkType", rerender: true, after: defaults("ornaments.watermark", { opacity: 0.08, text: "❦" }) }),
    text("ornaments.watermark.text", { id: "watermarkText", when: valueIs("ornaments.watermark.type", "text") }),
    fontField("ornaments.watermark.font", "watermarkFont", { when: valueIs("ornaments.watermark.type", "text") }),
    imageField("ornaments.watermark.resource", { id: "image", when: valueIs("ornaments.watermark.type", "image") }),
    range("ornaments.watermark.opacity", 0, 0.5, 0.01, { id: "opacity", when: valueIs("ornaments.watermark.type", "text", "image") }),
    heading("header"),
    toggle("ornaments.header.enabled", { id: "enabled" }),
    fontField("ornaments.header.font", "headerFont"),
    colorField("ornaments.header.color", { id: "color" })
  ],
  effect: [
    range("effect.transition.durationMs", 200, 2000, 50, { id: "duration" }),
    choice("effect.transition.easing", "easing", ["linear", "smooth", "easeOut"]),
    range("effect.transition.leafShadow", 0, 1, 0.05, { id: "leafShadow", when: typeIs("book") }),
    range("effect.transition.bend", 0, 1, 0.05, { id: "bend", when: typeIs("book", "stack") }),
    heading("sound"),
    toggle("effect.sound.enabled", { id: "soundEnabled" }),
    range("effect.sound.volume", 0, 1, 0.05, { id: "volume" }),
    heading("layout", { when: typeIs("book", "pad") }),
    choice("effect.layout.mode", "layout", ["auto", "double", "single"], { id: "layoutMode", when: typeIs("book", "pad") }),
    { path: "effect.layout.minSpreadWidth", type: "number", min: 400, max: 2000, step: 50, id: "minSpreadWidth", when: typeIs("book", "pad") },
    heading("navigation"),
    toggle("effect.navigation.sideArrows", { id: "sideArrows" }),
    toggle("effect.navigation.corners", { id: "cornerNav" }),
    toggle("effect.navigation.keyboard", { id: "keyboard" }),
    toggle("effect.navigation.mouseWheel", { id: "mouseWheel" })
  ]
};

const PROPS = {
  font: { type: "font" },
  fallback: { type: "font" },
  size: { type: "number", min: 6, max: 96, step: 0.5 },
  weight: { type: "select", group: "weight", values: [400, 500, 600, 700, 800, 900], numeric: true },
  style: { type: "select", group: "style", values: ["normal", "italic"] },
  color: { type: "color" },
  background: { type: "color" },
  transform: { type: "select", group: "transform", values: ["none", "uppercase", "lowercase", "smallCaps"] },
  letterSpacing: { type: "number", min: -0.1, max: 1, step: 0.01 },
  lineHeight: { type: "number", min: 0.8, max: 3, step: 0.05 },
  align: { type: "select", group: "align", values: ["left", "center", "right", "justify"] },
  indent: { type: "number", min: 0, max: 4, step: 0.1 },
  marginBottom: { type: "number", min: 0, max: 60, step: 1 },
  underline: { type: "select", group: "underline", values: ["none", "solid", "dotted", "wavy"] },
  shadow: { type: "select", group: "shadow", values: ["none", "soft", "medium", "strong", "glow"] },
  "borderBottom.width": { type: "number", min: 0, max: 8, step: 0.5 },
  "borderBottom.color": { type: "color" },
  "borderLeft.width": { type: "number", min: 0, max: 12, step: 0.5 },
  "borderLeft.color": { type: "color" },
  "border.width": { type: "number", min: 0, max: 8, step: 0.5 },
  "border.color": { type: "color" },
  bullet: { type: "text" },
  bulletColor: { type: "color" },
  numbering: { type: "select", group: "numbering", values: ["decimal", "roman", "alpha"] },
  type: { type: "select", group: "hrType", values: ["line", "double", "dashed", "fade", "ornament"], required: true },
  symbol: { type: "text" },
  length: { type: "range", min: 10, max: 100, step: 5 },
  variant: { type: "select", group: "variant", values: ["plain", "tape", "seal"] },
  enabled: { type: "toggle", rerender: true },
  lines: { type: "number", min: 2, max: 6, step: 1 },
  tilt: { type: "number", min: -6, max: 6, step: 0.1 },
  "header.color": { type: "color" },
  "header.background": { type: "color" },
  "header.transform": { type: "select", group: "transform", values: ["none", "uppercase", "smallCaps"] },
  stripedRows: { type: "color" }
};

const HEADING_PROPS = "font size weight style color transform letterSpacing lineHeight align marginBottom borderBottom.width borderBottom.color shadow";
const AFTER = { "elements.hr.type": defaults("elements.hr", { symbol: "❦" }) };

export const ELEMENTS = [
  { id: "base", root: "typography.base", props: "font fallback size lineHeight color" },
  ...HEADINGS.map(id => ({ id, props: HEADING_PROPS })),
  { id: "p", props: "font align indent marginBottom" },
  { id: "strong", props: "font weight color" },
  { id: "em", props: "font style color" },
  { id: "u", props: "underline color" },
  { id: "s", props: "color" },
  { id: "a", props: "font color underline" },
  { id: "code", props: "font size color background" },
  { id: "blockquote", props: "font variant style color background borderLeft.width borderLeft.color" },
  { id: "ul", props: "bullet bulletColor" },
  { id: "ol", props: "numbering bulletColor" },
  { id: "hr", props: "type symbol color length" },
  { id: "table", props: "header.color header.background header.transform stripedRows" },
  { id: "contentLink", props: "font color background border.color" },
  { id: "inlineRoll", props: "font color background border.color" },
  { id: "secret", props: "font style color background" },
  { id: "img", props: "border.width border.color shadow tilt" },
  { id: "dropCap", props: "enabled lines font weight color" }
];

export const elementRoot = element => element.root ?? `elements.${element.id}`;

export const allFields = () => [...Object.values(SECTIONS).flat(), ...ELEMENTS.flatMap(element => elementFields(element)), ...QUICK_TYPE, COVER_TITLE_FONT, { id: "base", type: "select", group: null, hint: true }];

export const elementFields = element => element.props.split(" ").map(prop => ({
  ...PROPS[prop], path: `${elementRoot(element)}.${prop}`, id: prop.replace(".", "-"), after: AFTER[`${elementRoot(element)}.${prop}`]
}));

export const wizardFields = (section, level = 1) => SECTIONS[section].filter(field => field.w >= level);

export const sectionIds = sheet => (sheet === "main" ? ["base", "background", "cover", "paper", "type", "ornaments", "effect", "resources"] : ["paper", "type", "ornaments"]);

export const QUICK_TYPE = [
  { ...PROPS.font, id: "textFont", path: "typography.base.font" },
  TITLE_FONT,
  { ...PROPS.enabled, id: "dropCap", path: "elements.dropCap.enabled" },
  { ...PROPS.font, id: "dropCapFont", path: "elements.dropCap.font", when: ctx => read(ctx, "elements.dropCap.enabled") }
];

export const COVER_TITLE_FONT = { ...PROPS.font, id: "coverFont", path: "styles.ornaments.coverTitle.font" };

export const fieldPaths = field => field.paths ?? (field.path ? [field.path] : []);
export const isInheritable = (field, ctx) => fieldPaths(field).length > 0 && fieldPaths(field).every(path => inSubSheet(ctx, path));
export const isOwn = (field, ctx) => fieldPaths(field).some(path => getPath(ctx.files, sheetPath(path, ctx.sheet)) !== undefined);
export const fieldValue = (field, ctx) => (field.get ? field.get(ctx) : read(ctx, field.path));
export const clearField = (field, ctx) => fieldPaths(field).forEach(path => setPath(ctx.files, sheetPath(path, ctx.sheet), undefined));
