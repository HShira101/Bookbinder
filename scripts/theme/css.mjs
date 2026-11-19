const TEXT_SHADOW = { none: "none", soft: "0 1px 1px rgba(0,0,0,.28)", medium: "0 1px 3px rgba(0,0,0,.5)", strong: "0 2px 5px rgba(0,0,0,.75)", glow: "0 0 5px currentColor,0 0 15px currentColor", emboss: "0 1px 0 rgba(255,255,255,.3),0 -1px 0 rgba(0,0,0,.45)" };
const BOX_SHADOW = { none: "none", soft: "0 1px 4px rgba(0,0,0,.28)", medium: "0 3px 9px rgba(0,0,0,.42)", strong: "0 16px 38px rgba(0,0,0,.65),0 3px 8px rgba(0,0,0,.5)", glow: "0 0 12px var(--bb-pal-accent)", emboss: "none" };
const SELECTORS = {
  h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", p: "p", strong: "strong", em: "em", u: "u", s: "s", a: "a:not([class])", code: "code",
  blockquote: "blockquote", cite: "cite", ul: "ul", ol: "ol", li: "li", hr: "hr", table: "table", contentLink: "a.content-link", inlineRoll: "a.inline-roll",
  secret: "section.secret", img: "img", figcaption: "figcaption"
};
const BOXED = new Set(["img", "blockquote", "secret", "contentLink", "inlineRoll", "table"]);
const NUMBERING = { decimal: "decimal", roman: "upper-roman", alpha: "lower-alpha" };
const TEXTURES = {
  leather: asset => [`url(${asset("img/common/leather.svg")})`, "overlay"],
  metal: asset => [`url(${asset("img/common/metal.svg")})`, "overlay"],
  cloth: () => ["repeating-linear-gradient(0deg,rgba(255,255,255,.055) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px)", "normal"],
  none: () => ["none", "normal"]
};
const CORNER_POSITIONS = ["left top", "right top", "left bottom", "right bottom"];

const str = value => JSON.stringify(String(value));
const numberList = list => [].concat(list).map(n => `${n}px`).join(" ");
const hasKeys = object => object && Object.keys(object).length > 0;

function parseColor(value) {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d).join("") : hex[1];
    return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value);
  return rgb ? rgb.slice(1, 4).map(Number) : [128, 128, 128];
}

export function createStyler(theme, assets) {
  const { palette } = theme;
  const baseColor = theme.sheets.main.typography.base.color;
  const color = (value, fallback = true) => {
    if (typeof value !== "string" || value[0] !== "$") return value;
    if (palette[value.slice(1)]) return `var(--bb-pal-${value.slice(1)})`;
    return fallback ? color(baseColor, false) : "#000";
  };
  const resolved = value => typeof value === "string" && value[0] === "$" ? palette[value.slice(1)] ?? "#808080" : value;
  const tone = (value, amount) => `rgb(${parseColor(resolved(value)).map(c => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)).join(",")})`;
  const image = keyName => {
    const url = keyName && assets.resource(keyName);
    return url ? `url(${str(url)})` : "none";
  };
  const line = border => `${border.width}px ${border.style ?? "solid"} ${color(border.color ?? "$inkSoft")}`;
  const mapping = {
    tilt: v => `transform:rotate(${v}deg)`,
    size: v => `font-size:${v}px`, weight: v => `font-weight:${v}`, style: v => `font-style:${v}`,
    color: v => `color:${color(v)}`, background: v => `background:${color(v)}`,
    transform: v => v === "smallCaps" ? "font-variant:small-caps" : `text-transform:${v}`,
    letterSpacing: v => `letter-spacing:${v}em`, lineHeight: v => `line-height:${v}`, align: v => `text-align:${v}`,
    indent: v => `text-indent:${v}em`, hanging: v => `padding-left:${v}em;text-indent:-${v}em`,
    marginTop: v => `margin-top:${v}px`, marginBottom: v => `margin-bottom:${v}px`,
    border: v => `border:${line(v)}`, borderTop: v => `border-top:${line(v)}`, borderBottom: v => `border-bottom:${line(v)}`, borderLeft: v => `border-left:${line(v)}`,
    underline: v => v === "none" ? "text-decoration:none" : `text-decoration:underline ${v};text-underline-offset:.16em`,
    radius: v => `border-radius:${v}px`, padding: v => `padding:${numberList(v)}`
  };
  const stack = props => props.fallback ? `${str(props.fallback)},${props.generic ?? "sans-serif"}` : "var(--bb-fallback)";
  const declarations = (props = {}, boxed = false) => Object.entries(props).map(([name, value]) => {
    if (name === "font") return `font-family:${str(value)},${stack(props)}`;
    if (name === "shadow") return boxed ? `box-shadow:${BOX_SHADOW[value]}` : `text-shadow:${TEXT_SHADOW[value]}`;
    return mapping[name]?.(value) ?? "";
  }).filter(Boolean).join(";");
  return { color, tone, image, line, declarations, stack, str };
}

function paperRules(selector, paper, ornaments, styler) {
  const { color, image, str: quote } = styler;
  const pattern = paper.pattern && PATTERNS[paper.pattern.type]?.(paper.pattern, color);
  const frame = paper.frame ?? {};
  const rules = [`${selector}{background-color:${paper.color ? color(paper.color) : "transparent"};background-image:${pattern?.image ?? "none"};background-size:${pattern?.size ?? "auto"};background-position:${pattern?.position ?? "0 0"};`
    + `clip-path:${edgePath(paper.edge, paper.seed)}${paper.vignetteColor ? `;--bb-vignette-color:${color(paper.vignetteColor)}` : ""}}`];
  rules.push(`${selector}>.bookbinder-im{background:${paper.image ? image(paper.image) : "none"} center/${paper.fit === "repeat" ? "auto" : "100% 100%"};opacity:${paper.imageOpacity ?? 1}}`);
  rules.push(`${selector}::before{opacity:${paper.noise ?? 0}}${selector}::after{opacity:${paper.vignette ?? 0}}`);
  if (frame.enabled) {
    const frameColor = color(frame.color ?? "$metal"), inset = frame.inset ?? 12, width = frame.width ?? 1;
    if (frame.style === "brackets") {
      const gradient = `linear-gradient(${frameColor},${frameColor})`;
      const corners = CORNER_POSITIONS.map(at => `${gradient} ${at}/20px ${width}px no-repeat,${gradient} ${at}/${width}px 20px no-repeat`).join(",");
      rules.push(`${selector}>.bookbinder-fr{display:block;inset:${inset}px;background:${corners}}`);
    } else {
      rules.push(`${selector}>.bookbinder-fr{display:block;inset:${inset}px;border:${width}px solid ${frameColor}${frame.double ? `;outline:1px solid ${frameColor};outline-offset:3px` : ""}}`);
    }
  }
  const mark = ornaments?.watermark;
  if (mark?.type === "image") rules.push(`${selector}>.bookbinder-wm{opacity:${mark.opacity ?? 0.1};background-image:${image(mark.resource)};background-size:${mark.size ?? 62}%}`);
  if (mark?.type === "text") {
    rules.push(`${selector}>.bookbinder-wm{opacity:${mark.opacity ?? 0.1};--bb-wm-text:${quote(mark.text ?? "")};color:${color(mark.color ?? "$ink")};`
      + `font:${mark.weight ?? 400} ${mark.size ?? 170}px/1 ${mark.font ? `${quote(mark.font)},` : ""}serif${mark.tilt ? `;transform:rotate(${mark.tilt}deg)` : ""}}`);
  }
  return rules.join("");
}

const PATTERNS = {
  ruled: (p, color) => ({
    image: `linear-gradient(90deg,transparent ${p.margin ?? 0}px,${color(p.marginColor ?? "transparent")} ${p.margin ?? 0}px ${(p.margin ?? 0) + 1}px,transparent ${(p.margin ?? 0) + 1}px),`
      + `repeating-linear-gradient(transparent 0 ${p.size - 1}px,${color(p.color)} ${p.size - 1}px ${p.size}px)`,
    position: `0 0,0 ${p.offset ?? 0}px`
  }),
  grid: (p, color) => ({ image: `repeating-linear-gradient(${color(p.color)} 0 1px,transparent 1px ${p.size}px),repeating-linear-gradient(90deg,${color(p.color)} 0 1px,transparent 1px ${p.size}px)` }),
  scanlines: (p, color) => ({ image: `repeating-linear-gradient(${color(p.color)} 0 1px,transparent 1px ${p.size}px)` }),
  dots: (p, color) => ({ image: `radial-gradient(${color(p.color)} 1px,transparent 1.6px)`, size: `${p.size}px ${p.size}px` })
};

function edgePath(kind, seed = 7) {
  if (!kind || kind === "straight") return "none";
  const [amplitude, step] = kind === "torn" ? [1.25, 2.3] : [0.42, 3.1];
  let state = seed;
  const jitter = () => ((state = (state * 16807) % 2147483647) / 2147483647) * amplitude;
  const points = [];
  for (let x = 0; x <= 100; x += step) points.push(`${x.toFixed(1)}% ${jitter().toFixed(2)}%`);
  for (let y = 0; y <= 100; y += step * 0.72) points.push(`${(100 - jitter() * 1.38).toFixed(2)}% ${y.toFixed(1)}%`);
  for (let x = 100; x >= 0; x -= step) points.push(`${x.toFixed(1)}% ${(100 - jitter()).toFixed(2)}%`);
  for (let y = 100; y >= 0; y -= step * 0.72) points.push(`${(jitter() * 1.38).toFixed(2)}% ${y.toFixed(1)}%`);
  return `polygon(${points.join(",")})`;
}

const QUOTE_VARIANTS = {
  tape: selector => `${selector}{position:relative;transform:rotate(-.7deg);box-shadow:0 2px 6px rgba(0,0,0,.3)}${selector}::before{content:"";position:absolute;top:-10px;left:50%;width:78px;height:21px;margin-left:-39px;background:rgba(236,224,164,.78);transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.25)}`,
  seal: (selector, styler, assets) => `${selector}{position:relative}${selector}::after{content:"";position:absolute;right:-9px;bottom:-14px;width:40px;height:40px;background:url(${assets.module("img/common/seal.svg")}) center/contain no-repeat;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}`
};

function extraRules(name, selector, props, styler, assets) {
  const { color, declarations, str: quote } = styler;
  switch (name) {
    case "ul": return props.bullet ? `${selector}{list-style:none}${selector}>li{position:relative}${selector}>li::before{content:${quote(props.bullet)};position:absolute;left:-1.25em;color:${color(props.bulletColor ?? "inherit")}}` : "";
    case "ol": return props.numbering ? `${selector}{list-style-type:${NUMBERING[props.numbering]}}${selector}>li::marker{color:${color(props.bulletColor ?? "inherit")}}` : "";
    case "table": return [props.header && `${selector} th{${declarations(props.header)}}`, props.cell && `${selector} td{${declarations(props.cell)}}`,
      props.stripedRows && `${selector} tbody tr:nth-child(even){background:${color(props.stripedRows)}}`].filter(Boolean).join("");
    case "blockquote": return QUOTE_VARIANTS[props.variant]?.(selector, styler, assets) ?? "";
    case "hr": return ruleRules(selector, props, styler);
    default: return "";
  }
}

function ruleRules(selector, props, { color, str: quote }) {
  const tint = color(props.color ?? "$inkSoft"), width = props.width ?? 1, length = `width:${props.length ?? 100}%;`;
  switch (props.type) {
    case "double": return `${selector}{${length}height:${width * 2 + 3}px;background:none;border-top:${width}px solid ${tint};border-bottom:${width}px solid ${tint}}`;
    case "dashed": return `${selector}{${length}height:0;background:none;border-top:${width}px dashed ${tint}}`;
    case "fade": return `${selector}{${length}height:${width}px;background:linear-gradient(90deg,transparent,${tint},transparent)}`;
    case "ornament": {
      const symbol = props.symbol ?? "❦", gap = `${([...symbol].length * 0.5 + 0.7).toFixed(1)}em`, bar = "linear-gradient(currentColor,currentColor)";
      return `${selector}{${length}height:1.3em;overflow:visible;text-align:center;color:${tint};background:${bar} left center/calc(50% - ${gap}) ${width}px no-repeat,${bar} right center/calc(50% - ${gap}) ${width}px no-repeat}`
        + `${selector}::before{content:${quote(symbol)};font-size:${props.symbolSize ?? 1.15}em;line-height:1.1;font-family:${props.symbolFont ? `${quote(props.symbolFont)},` : ""}serif}`;
    }
    default: return `${selector}{${length}height:${width}px;background:${tint}}`;
  }
}

function sheetRules(id, sheet, main, styler, assets) {
  const { declarations, color, tone, image, str: quote } = styler;
  const scope = `.bookbinder-pg[data-sheet="${id}"]`, content = `${scope} .bookbinder-content`;
  const { typography: { base }, elements, ornaments, paper } = sheet;
  const rules = [];
  if (paper.inset) {
    rules.push(paperRules(`${scope}>.bookbinder-paper`, main.paper, main.ornaments, styler), paperRules(`${scope}>.bookbinder-loose>.bookbinder-paper`, paper, ornaments, styler),
      `${scope}>.bookbinder-loose{inset:${paper.inset}px;transform:rotate(${paper.tilt ?? 0}deg)}`);
  } else {
    rules.push(`${scope}{--bb-stack-color:${tone(paper.color, -0.3)}}`, paperRules(`${scope}>.bookbinder-paper`, paper, ornaments, styler));
  }
  rules.push(`${content}{${declarations(base)}${base.font ? "" : ";font-family:var(--bb-fallback)"};--bb-fallback:${styler.stack(base)}${paper.columns ? `;column-count:${paper.columns};column-gap:22px;column-fill:balance` : ""}}`);
  for (const [name, props] of Object.entries(elements)) {
    if (!SELECTORS[name]) continue;
    const selector = `${content} ${SELECTORS[name]}`;
    rules.push(`${selector}{${declarations(props, BOXED.has(name))}}`, extraRules(name, selector, props, styler, assets));
  }
  const cap = elements.dropCap;
  if (cap?.enabled) {
    const size = ((cap.lines ?? 3) * base.size * base.lineHeight * (cap.scale ?? 0.86)).toFixed(1);
    rules.push(`${content}:not(.bookbinder-fill)>p:first-of-type::first-letter{float:left;font-size:${size}px;line-height:.84;margin:.05em .12em 0 0;${declarations(cap)}}`);
  }
  if (ornaments.folio) rules.push(`${scope} .bookbinder-folio{${declarations(ornaments.folio)}}`);
  if (ornaments.header?.enabled) rules.push(`${scope} .bookbinder-rhead{${declarations(ornaments.header)}}`);
  if (ornaments.stamp) rules.push(stampRule(scope, ornaments.stamp, styler));
  if (ornaments.corners && ornaments.corners.style !== "none") {
    rules.push(`${scope} .bookbinder-cn{color:${color(ornaments.corners.color ?? "$metal")};${declarations({ font: ornaments.corners.font, size: ornaments.corners.size, fallback: "serif", generic: "serif" })}}`);
  }
  return rules.filter(Boolean).join("\n");
}

function stampRule(scope, stamp, styler) {
  const [vertical, horizontal] = (stamp.position ?? "bottom right").split(" ");
  const placement = `${vertical}:${stamp.offsetY ?? 28}px;${horizontal}:${stamp.offsetX ?? 28}px;opacity:${stamp.opacity ?? 0.85};transform:rotate(${stamp.tilt ?? 0}deg);`;
  if (stamp.resource) return `${scope} .bookbinder-st{${placement}width:${stamp.size ?? 54}px;height:${stamp.size ?? 54}px;background-image:${styler.image(stamp.resource)}}`;
  const { tilt, ...look } = stamp;
  return `${scope} .bookbinder-st{${placement}--bb-st-text:${styler.str(stamp.text ?? "")};${styler.declarations(look)};padding:2px 10px;border:2px solid currentColor;border-radius:3px}`;
}

function rootVars(theme, styler, assets) {
  const { cover, paper, spine } = theme.surfaces;
  const [texture, blend] = (TEXTURES[cover.texture] ?? TEXTURES.none)(assets.module);
  const entries = {
    ...Object.fromEntries(Object.entries(theme.palette).map(([name, value]) => [`--bb-pal-${name}`, value])),
    "--bb-cv-color": styler.color(cover.color), "--bb-cv-c1": styler.tone(cover.color, 0.17), "--bb-cv-c3": styler.tone(cover.color, -0.45),
    "--bb-cv-radius": `${cover.radius}px`, "--bb-cv-texture": texture, "--bb-cv-blend": blend, "--bb-cv-image": styler.image(cover.image),
    "--bb-cv-shadow": BOX_SHADOW[cover.shadow ?? "strong"], "--bb-sp-shadow": spine.shadow, "--bb-sp-width": `${spine.width}px`,
    "--bb-stack-color": styler.tone(paper.color, -0.3), "--bb-stack-line": styler.tone(paper.color, -0.52), "--bb-grain": `url(${assets.module("img/common/grain.svg")})`,
    "--bb-seal": `url(${assets.module("img/common/seal.svg")})`
  };
  return Object.entries(entries).map(([name, value]) => `${name}:${value}`).join(";");
}

function backgroundRule(background, styler) {
  const { color, highlight, image: key, fit } = background;
  if (key) return `background:${styler.image(key)} center/${fit === "repeat" ? "auto" : fit ?? "cover"},${styler.color(color)}`;
  return highlight ? `background:radial-gradient(1200px 700px at 50% 42%,${styler.color(highlight)},${styler.color(color)} 78%)` : `background:${styler.color(color)}`;
}

export function buildCss(theme, scope, assets) {
  const styler = createStyler(theme, assets);
  const main = theme.sheets.main, { surfaces } = theme;
  const prefixed = css => css.replaceAll(".bookbinder-pg[", `${scope} .bookbinder-pg[`);
  const rules = [`${scope}{${rootVars(theme, styler, assets)};${backgroundRule(surfaces.background, styler)}}`,
    `${scope} .bookbinder-cv-title{${styler.declarations(main.ornaments.coverTitle)}${main.ornaments.coverTitle.top ? `;top:${main.ornaments.coverTitle.top}%` : ""}}`];
  if (hasKeys(surfaces.endpaper)) rules.push(paperRules(`${scope} .bookbinder-endpaper`, surfaces.endpaper, {}, styler));
  if (surfaces.mount) rules.push(`${scope} .bookbinder-band{background:${surfaces.mount.image ? `${styler.image(surfaces.mount.image)} center/auto,` : ""}${styler.color(surfaces.mount.color)}}`);
  for (const [id, sheet] of Object.entries(theme.sheets)) rules.push(prefixed(sheetRules(id, sheet, main, styler, assets)));
  return rules.filter(Boolean).join("\n");
}
