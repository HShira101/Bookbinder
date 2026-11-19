import { MODULE_ID, escapeHTML, localize, modulePath } from "../constants.mjs";
import { setting } from "../settings.mjs";
import { buildCss } from "../theme/css.mjs";
import { findAnchor, renderPageBody } from "./page-content.mjs";

const PW = 470, PH = 650, STRIPS = 8, NAV = 56, RAD = Math.PI / 180;
const FIXED = { dragThreshold: 0.25, coverThickness: 5 };
const LAYOUTS = {
  book: { sides: spread => [2 * spread - 1, 2 * spread], spreadOf: index => (index + 1) >> 1, min: -1, count: pages => (pages >> 1) + 1 },
  pad: { sides: spread => [2 * spread, 2 * spread + 1], spreadOf: index => index >> 1, min: 0, count: pages => Math.max(1, Math.ceil(pages / 2)) }
};
const MODES = { slide: "pad" };
const CORNER_SPOTS = ["tl", "tr", "br", "bl"];
let viewCounter = 0;
const KEYS = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 };
const EASE = {
  linear: u => u,
  smooth: u => u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2,
  easeOut: u => 1 - (1 - u) ** 3
};
const LIGHT = { x: -0.2, z: 0.98, ambient: 0.55 };

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = u => u * u * (3 - 2 * u);
const ROMAN = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
const roman = number => ROMAN.reduce((out, [value, glyph]) => {
  while (number >= value) {
    out += glyph;
    number -= value;
  }
  return out;
}, "");
const lit = angle => (-Math.sin(angle * RAD) * LIGHT.x + Math.cos(angle * RAD) * LIGHT.z) / LIGHT.z;

function tint(light, strength) {
  const r = LIGHT.ambient + (1 - LIGHT.ambient) * Math.max(0, light);
  return r < 1 ? `rgba(0,0,0,${((1 - r) * strength).toFixed(3)})` : `rgba(255,255,255,${((r - 1) * 3).toFixed(3)})`;
}

function bundleLines(leaves, { lineRatio, maxLines }) {
  const count = clamp(Math.round(leaves * lineRatio), 2, maxLines);
  return Array.from({ length: count }, (_, k) => {
    const at = (((k + 0.5 + 0.28 * Math.sin(k * 2.7 + leaves)) / count) * 100).toFixed(2);
    const color = `rgba(70,48,26,${(0.3 + 0.15 * Math.sin(k * 1.9 + 1)).toFixed(2)})`;
    return `linear-gradient(90deg,transparent ${at}%,${color} ${at}%,${color} calc(${at}% + 1px),transparent calc(${at}% + 1px))`;
  }).join(",");
}

const control = (kind, dir, content = "") => `<button type="button" class="bookbinder-${kind} bookbinder-${kind}-${dir < 0 ? "l" : "r"}"`
  + ` data-bookbinder-${kind}="${dir}" aria-label="${localize(dir < 0 ? "Book.Previous" : "Book.Next")}">${content}</button>`;

const PAPER_LAYERS = '<i class="bookbinder-im"></i><i class="bookbinder-fr"></i><i class="bookbinder-wm"></i>';

const face = side => `<div class="bookbinder-face bookbinder-${side}"><div class="bookbinder-slot"></div><i class="bookbinder-shade"></i></div>`;

const SHELL = (uid, mode, cw) => `<div class="bookbinder-view" data-uid="${uid}" data-mode="${mode}">${control("nav", -1, "‹")}`
  + `<div class="bookbinder-fit"><div class="bookbinder-scaler"><div class="bookbinder-shift">`
  + `<div class="bookbinder-book" data-mode="${mode}" style="--bb-pw:${PW}px;--bb-ph:${PH}px;--bb-cw:${cw}px">`
  + `<div class="bookbinder-board bookbinder-board-r"></div><div class="bookbinder-board bookbinder-board-l"></div>`
  + `<i class="bookbinder-block bookbinder-block-l"></i><i class="bookbinder-block bookbinder-block-r"></i>`
  + `<div class="bookbinder-screen"><section class="bookbinder-page bookbinder-page-l"></section><section class="bookbinder-page bookbinder-page-r"></section></div>`
  + `<i class="bookbinder-spine"></i><i class="bookbinder-cast"></i><div class="bookbinder-cover-static"></div>`
  + `<div class="bookbinder-leaf">${`<div class="bookbinder-strip">${face("front")}${face("back")}</div>`.repeat(STRIPS)}</div>`
  + `${control("hot", -1)}${control("hot", 1)}</div></div></div></div>${control("nav", 1, "›")}</div>`;

export class BookView {
  #pages = [];
  #cache = new Map();
  #spread = -1;
  #busy = false;
  #dirty = false;
  #destroyed = false;
  #pending = null;
  #ctx = null;
  #scale = 1;
  #el;
  #strips;
  #observer;
  #layout;
  #fx;
  #cw;
  #uid = ++viewCounter;

  constructor({ host, journal, theme, assets, onSpread, onSheet }) {
    this.host = host;
    this.journal = journal;
    this.theme = theme;
    this.assets = assets;
    this.onSpread = onSpread;
    this.onSheet = onSheet;
    this.mode = MODES[theme.effect.transition.type] ?? "book";
    this.#layout = LAYOUTS[this.mode];
    this.#fx = { ...FIXED, ...theme.effect.transition };
    this.#cw = theme.surfaces.cover.width;
    this.#build(host);
  }

  get pageIds() {
    return this.#spread < this.#layout.min ? [] : this.#sides(this.#spread).map(index => this.#pages[index]?.id).filter(Boolean);
  }

  get #book() {
    return this.mode === "book";
  }

  get #count() {
    return this.#layout.count(this.#pages.length);
  }

  get #reduced() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches || !setting("animation");
  }

  get #ms() {
    return this.#reduced ? 0 : this.#fx.durationMs / setting("speed");
  }

  #sides(spread) {
    return this.#layout.sides(Math.max(spread, 0));
  }

  #sheetOf(page) {
    const id = page?.getFlag(MODULE_ID, "sheet");
    return id && this.theme.sheets[id] ? id : "main";
  }

  #build(host) {
    const shadow = setting("isolation") === "shadow";
    const root = shadow ? host.attachShadow({ mode: "open" }) : host;
    const scope = `.bookbinder-view[data-uid="${this.#uid}"]`;
    root.innerHTML = (shadow ? `<link rel="stylesheet" href="${modulePath("styles/bookbinder.css")}">` : "")
      + `<style>${buildCss(this.theme, scope, this.assets)}</style>` + SHELL(this.#uid, this.mode, this.#cw);
    const $ = selector => root.querySelector(`.bookbinder-${selector}`);
    this.#el = {
      root, book: $("book"), fit: $("fit"), scaler: $("scaler"), shift: $("shift"), cast: $("cast"), leaf: $("leaf"),
      pageL: $("page-l"), pageR: $("page-r")
    };
    $("board-r").innerHTML = this.#coverHTML(false, "r");
    $("board-l").innerHTML = this.#coverHTML(false, "l");
    $("cover-static").innerHTML = this.#coverHTML(true, "r");
    this.#strips = [...this.#el.leaf.children].map(el => {
      const [front, back] = el.children;
      return { el, fi: front.firstElementChild, fs: front.lastElementChild, bi: back.firstElementChild, bs: back.lastElementChild };
    });
    this.#strips.at(-1).el.insertAdjacentHTML("beforeend", '<i class="bookbinder-edge"></i>');
    root.addEventListener("click", event => this.#onClick(event));
    root.addEventListener("pointerdown", event => this.#onPointerDown(event));
    this.#observer = new ResizeObserver(() => this.#fit());
    this.#observer.observe(host);
  }

  destroy() {
    this.#destroyed = true;
    this.#observer?.disconnect();
  }

  async open(pages, pageId, anchor) {
    this.#pages = pages;
    const index = this.#indexOf(pageId);
    this.#spread = index < 0 ? this.#layout.min : this.#layout.spreadOf(index);
    await this.#show();
    if (anchor && index >= 0) this.#scrollTo(index, anchor);
  }

  invalidate(pageId) {
    this.#cache.delete(pageId);
    this.#dirty = true;
  }

  async refresh(pages, pageId, anchor) {
    if (this.#busy) {
      this.#pending = [pages, pageId, anchor];
      return;
    }
    const changed = this.#dirty || pages.map(page => page.id).join() !== this.#pages.map(page => page.id).join();
    this.#pages = pages;
    this.#dirty = false;
    this.#spread = Math.min(this.#spread, this.#count - 1);
    this.#el.root.querySelectorAll(".bookbinder-cv-title").forEach(title => { title.textContent = this.journal.name; });
    if (changed) await this.#show();
    if (pageId) await this.goToPage(pageId, anchor);
  }

  async goToPage(pageId, anchor) {
    const index = this.#indexOf(pageId);
    if (index < 0) return;
    const spread = this.#layout.spreadOf(index);
    if (spread !== this.#spread && !(await this.goTo(spread))) return;
    if (anchor) this.#scrollTo(index, anchor);
  }

  async goTo(to) {
    if (this.#busy || to === this.#spread || !this.#valid(to)) return false;
    if (!this.#book) return this.#slide(to);
    if ((this.#spread < 0 || to < 0) && Math.abs(to - this.#spread) > 1) return (await this.goTo(0)) && this.goTo(to);
    this.#busy = true;
    await this.#load(this.#spread, to);
    if (this.#destroyed) return false;
    this.#begin(this.#spread, to);
    return this.#animate(0, 1, this.#ms * (this.#ctx.cover ? 1.25 : 1), true);
  }

  onKey(event) {
    const dir = KEYS[event.key];
    if (!dir || event.target.closest?.("input, textarea, select, video, [contenteditable], .bookbinder-menu")) return;
    event.preventDefault();
    event.stopPropagation();
    this.goTo(this.#spread + dir);
  }

  #indexOf(pageId) {
    return pageId ? this.#pages.findIndex(page => page.id === pageId) : -1;
  }

  #valid(spread) {
    return spread >= this.#layout.min && spread < this.#count;
  }

  async #load(...spreads) {
    const pages = spreads.flatMap(spread => this.#sides(spread))
      .map(index => this.#pages[index])
      .filter(page => page && !this.#cache.has(page.id));
    await Promise.all(pages.map(async page => this.#cache.set(page.id, await renderPageBody(page))));
  }

  async #show() {
    await this.#load(this.#spread);
    if (this.#busy || this.#destroyed) return;
    this.#render();
    await this.#settle();
  }

  async #settle() {
    this.#load(this.#spread - 1, this.#spread + 1);
    if (!this.#pending) return;
    const pending = this.#pending;
    this.#pending = null;
    await this.refresh(...pending);
  }

  async #slide(to) {
    this.#busy = true;
    await this.#load(to);
    if (this.#destroyed) return false;
    const { pageL, pageR } = this.#el, dir = Math.sign(to - this.#spread), duration = this.#ms * 0.6;
    const outgoing = document.createElement("div");
    outgoing.className = "bookbinder-slide-out";
    outgoing.append(pageL.cloneNode(true), pageR.cloneNode(true));
    pageL.parentElement.append(outgoing);
    this.#spread = to;
    this.#render();
    this.#playTurn();
    if (duration > 0) {
      const options = { duration, easing: "cubic-bezier(.3,.7,.2,1)" };
      await Promise.all([
        ...[pageL, pageR].map(page => page.animate([{ transform: `translateX(${dir * 60}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], options).finished),
        outgoing.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${-dir * 60}%)`, opacity: 0 }], options).finished
      ]);
    }
    outgoing.remove();
    this.#busy = false;
    await this.#settle();
    return true;
  }

  #playTurn() {
    const { enabled, resource, volume } = this.theme.effect.sound;
    const src = enabled && !this.#reduced && setting("sound") ? this.assets.resource(resource) : null;
    if (src) foundry.audio.AudioHelper.play({ src, volume: volume * setting("volume") }, false);
  }

  #render() {
    const closed = this.#spread < 0, [left, right] = this.#sides(this.#spread);
    const { book, pageL, pageR, leaf, cast, root } = this.#el;
    book.dataset.closed = Number(closed);
    book.dataset.cover = 0;
    this.#setPage(pageL, closed ? -1 : left, "l");
    this.#setPage(pageR, right, "r");
    this.#setShift(closed ? 0 : 1);
    leaf.classList.remove("bookbinder-on");
    cast.style.background = "none";
    root.querySelectorAll("[data-bookbinder-nav], [data-bookbinder-hot]").forEach(button => {
      button.disabled = !this.#valid(this.#spread + Number(button.dataset.bookbinderNav ?? button.dataset.bookbinderHot));
    });
    this.onSpread?.();
  }

  #coverHTML(front, side) {
    const layout = this.theme.sheets.main.ornaments.coverTitle.layout ?? "center";
    const inner = front
      ? `<div class="bookbinder-cv-art"></div><div class="bookbinder-cv-title" data-layout="${layout}">${escapeHTML(this.journal.name)}</div>`
      : `<div class="bookbinder-endpaper">${PAPER_LAYERS}</div>`;
    return `<div class="bookbinder-cv" data-side="${side}">${inner}</div>`;
  }

  #cornersHTML(corners) {
    if (!corners || corners.style === "none") return "";
    if (corners.style === "fold") return '<i class="bookbinder-cn bookbinder-fold"></i>';
    const triangle = corners.style === "triangle" ? " bookbinder-tri" : "";
    return CORNER_SPOTS.map(spot => `<i class="bookbinder-cn bookbinder-${spot}${triangle}">${corners.style === "symbol" ? escapeHTML(corners.symbol ?? "") : ""}</i>`).join("");
  }

  #folioHTML(folio, index) {
    if (!folio?.format) return "";
    const number = folio.numbering === "roman" ? roman(index + 1) : index + 1;
    return `<div class="bookbinder-folio" data-pos="${folio.position ?? "center"}">${escapeHTML(folio.format.replace("{n}", number))}</div>`;
  }

  #controlsHTML(page) {
    const button = (kind, label, glyph) => `<button type="button" class="bookbinder-${kind}" data-bookbinder-${kind === "edit" ? "open" : kind}="${page.id}"`
      + ` aria-label="${localize(label)}" data-tooltip="${localize(label)}">${glyph}</button>`;
    return button("edit", "Book.Edit", "✎") + (Object.keys(this.theme.sheetNames).length ? button("sheet", "Book.PageStyle", "Aa") : "");
  }

  #pageHTML(index, side, live) {
    const page = this.#pages[index], id = this.#sheetOf(page), { paper, ornaments } = this.theme.sheets[id];
    const empty = this.#pages.length ? "" : `<p class="bookbinder-empty">${localize("Book.NoPages")}</p>`;
    const body = page ? this.#cache.get(page.id)?.[live ? "live" : "still"] ?? "" : empty;
    const loose = paper.inset > 0;
    const header = page && ornaments.header?.enabled ? `<div class="bookbinder-rhead">${escapeHTML(side === "l" ? this.journal.name : page.name)}</div>` : "";
    const attach = loose && paper.attach ? `<i class="bookbinder-att bookbinder-att-${paper.attach}"></i>` : "";
    const stamp = page && ornaments.stamp ? '<i class="bookbinder-st"></i>' : "";
    const fill = page?.type === "image" ? " bookbinder-fill" : "";
    return `<div class="bookbinder-pg" data-sheet="${id}" data-side="${side}"${loose ? " data-loose" : ""}${header ? " data-head" : ""}>`
      + `<div class="bookbinder-paper">${PAPER_LAYERS}</div><div class="bookbinder-loose">${loose ? `<div class="bookbinder-paper">${PAPER_LAYERS}</div>` : ""}`
      + `<div class="bookbinder-content${fill}">${body}</div>${attach}${stamp}</div>`
      + `${page ? this.#cornersHTML(ornaments.corners) + header + this.#folioHTML(ornaments.folio, index) : ""}${live && page?.isOwner ? this.#controlsHTML(page) : ""}</div>`;
  }

  #setPage(element, index, side) {
    element.hidden = index < 0;
    element.innerHTML = index < 0 ? "" : this.#pageHTML(index, side, true);
  }

  #setShift(open) {
    this.#el.shift.style.setProperty("--bb-shift", `${(-(1 - open) * (PW + this.#cw)) / 2}px`);
  }

  #fit() {
    const { fit, scaler } = this.#el;
    const width = 2 * PW + 2 * this.#cw, height = PH + 2 * this.#cw;
    this.#scale = Math.max(0.1, Math.min((this.host.clientWidth - 2 * NAV) / width, (this.host.clientHeight - 24) / height));
    fit.style.width = `${width * this.#scale}px`;
    fit.style.height = `${height * this.#scale}px`;
    scaler.style.transform = `scale(${this.#scale})`;
  }

  #scrollTo(index, anchor) {
    const page = index === this.#sides(this.#spread)[0] ? this.#el.pageL : this.#el.pageR;
    const content = page.querySelector(".bookbinder-content");
    const heading = content && findAnchor(content, anchor);
    if (heading) content.scrollTop += (heading.getBoundingClientRect().top - content.getBoundingClientRect().top) / this.#scale;
  }

  #onClick(event) {
    const nav = event.target.closest("[data-bookbinder-nav]");
    if (nav) return this.goTo(this.#spread + Number(nav.dataset.bookbinderNav));
    const open = event.target.closest("[data-bookbinder-open]");
    if (open) this.journal.pages.get(open.dataset.bookbinderOpen)?.sheet.render({ force: true });
    const sheet = event.target.closest("[data-bookbinder-sheet]");
    if (sheet) this.onSheet?.(this.journal.pages.get(sheet.dataset.bookbinderSheet), sheet);
  }

  #onPointerDown(event) {
    const hot = event.target.closest("[data-bookbinder-hot]");
    if (!hot || event.button !== 0) return;
    const dir = Number(hot.dataset.bookbinderHot);
    if (this.#book) this.#grab(event, hot, dir);
    else this.goTo(this.#spread + dir);
  }

  #dress(front, back, { width, height, top, thick, kind, leaves }) {
    const stripWidth = width / STRIPS, { leaf } = this.#el;
    leaf.style.cssText = `top:${top}px;width:${width}px;height:${height}px;--bb-thick:${thick}px`;
    leaf.dataset.kind = kind;
    if (kind === "bundle") leaf.style.setProperty("--bb-lines", bundleLines(leaves, this.#fx.bundle));
    this.#strips.forEach((strip, i) => {
      strip.el.style.width = `${stripWidth}px`;
      strip.fi.style.cssText = `width:${width}px;left:${1.5 - i * stripWidth}px`;
      strip.bi.style.cssText = `width:${width}px;left:${1.5 - (STRIPS - 1 - i) * stripWidth}px`;
      strip.fi.innerHTML = front;
      strip.bi.innerHTML = back;
    });
    return stripWidth;
  }

  #begin(from, to) {
    const dir = Math.sign(to - from), lo = Math.min(from, to), hi = Math.max(from, to), leaves = hi - lo, cover = lo < 0;
    const { book, pageL, pageR, leaf } = this.#el;
    const moving = dir > 0 ? pageR : pageL, scroll = moving.querySelector(".bookbinder-content")?.scrollTop ?? 0;
    const kind = cover ? "cover" : leaves > 1 ? "bundle" : "leaf";
    const width = cover ? PW + this.#cw : PW, { bundle } = this.#fx;
    const thick = cover ? this.#fx.coverThickness : kind === "bundle" ? Math.min(leaves * bundle.pxPerLeaf, bundle.maxThickness) : 0;
    const stripWidth = this.#dress(
      cover ? this.#coverHTML(true, "r") : this.#pageHTML(this.#sides(lo)[1], "r", false),
      cover ? this.#coverHTML(false, "l") : this.#pageHTML(this.#sides(hi)[0], "l", false),
      { width, height: cover ? PH + 2 * this.#cw : PH, top: cover ? 0 : this.#cw, thick, kind, leaves }
    );
    this.#ctx = { to, dir, cover, width, stripWidth, t: 0, bend: kind === "leaf" ? 1 + clamp(this.#fx.bend) : 1 };
    this.#busy = true;
    book.dataset.closed = 0;
    book.dataset.cover = Number(cover);
    if (dir > 0) this.#setPage(pageR, this.#sides(to)[1], "r");
    else this.#setPage(pageL, to >= 0 ? this.#sides(to)[0] : -1, "l");
    this.#pose(0);
    leaf.classList.add("bookbinder-on");
    if (!cover) this.#strips.forEach(strip => {
      const content = (dir > 0 ? strip.fi : strip.bi).querySelector(".bookbinder-content");
      if (content) content.scrollTop = scroll;
    });
  }

  #drawStrips(a0, a1, stripWidth, strength) {
    const step = (a1 - a0) / (STRIPS - 1);
    let x = 0, z = 0;
    this.#strips.forEach((strip, i) => {
      const angle = a0 + step * i, l0 = lit(angle - step / 2), l1 = lit(angle + step / 2);
      strip.el.style.transform = `translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) rotateY(${-angle}deg)`;
      strip.el.style.zIndex = 100 + Math.round(z + (stripWidth * Math.sin(angle * RAD)) / 2);
      strip.fs.style.background = `linear-gradient(90deg,${tint(l0, strength)},${tint(l1, strength)})`;
      strip.bs.style.background = `linear-gradient(90deg,${tint(-l1, strength)},${tint(-l0, strength)})`;
      x += stripWidth * Math.cos(angle * RAD);
      z += stripWidth * Math.sin(angle * RAD);
    });
    return [x, z];
  }

  #pose(t) {
    const ctx = this.#ctx, shadow = this.#fx.leafShadow;
    ctx.t = t;
    let outer = 180 * (1 - (1 - t) ** ctx.bend), inner = 180 * t ** ctx.bend;
    if (ctx.dir < 0) [outer, inner] = [180 - outer, 180 - inner];
    const [x, z] = this.#drawStrips(inner, outer, ctx.stripWidth, shadow * 2.5);
    const u = z / ctx.width, alpha = (shadow * 1.7 * smooth(clamp(u / 0.1)) * (1 - 0.4 * u)).toFixed(3);
    const reach = x + 0.42 * z, soft = 14 + 0.34 * z, start = PW + Math.min(x, 0), fade = 9 + 0.22 * z;
    this.#el.cast.style.background = `linear-gradient(90deg,transparent ${start - fade}px,rgba(0,0,0,${alpha}) ${start}px,`
      + `rgba(0,0,0,${alpha}) ${PW + reach - soft / 2}px,transparent ${PW + reach + soft / 2}px)`;
    if (ctx.cover) this.#setShift(smooth(ctx.dir > 0 ? t : 1 - t));
  }

  #run(fn, from, to, ms) {
    return new Promise(resolve => {
      if (ms <= 0) {
        fn(to);
        return resolve();
      }
      const ease = EASE[this.#fx.easing], start = performance.now();
      const tick = now => {
        if (this.#destroyed) return resolve();
        const u = clamp((now - start) / ms);
        fn(from + (to - from) * ease(u));
        if (u < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  async #animate(from, to, ms, ok) {
    if (ok) this.#playTurn();
    await this.#run(t => this.#pose(t), from, to, ms);
    if (ok) this.#spread = this.#ctx.to;
    this.#ctx = null;
    this.#busy = false;
    await this.#show();
    return ok;
  }

  #grab(event, target, dir) {
    const to = this.#spread + dir;
    if (this.#busy || !this.#valid(to)) return;
    this.#load(to);
    target.setPointerCapture(event.pointerId);
    const x0 = event.clientX;
    let dragging = false;
    const travel = clientX => {
      const box = this.#el.book.getBoundingClientRect(), ctx = this.#ctx;
      const offset = clamp((clientX - box.left - box.width / 2) / (ctx.width * this.#scale), -1, 1);
      const lead = Math.acos(offset) / Math.PI;
      return 1 - (1 - clamp(ctx.dir > 0 ? lead : 1 - lead)) ** (1 / ctx.bend);
    };
    const move = moveEvent => {
      if (!dragging && Math.abs(moveEvent.clientX - x0) > 5 && !this.#busy) {
        dragging = true;
        this.#begin(this.#spread, to);
      }
      if (dragging) this.#pose(travel(moveEvent.clientX));
    };
    const release = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", release);
      target.removeEventListener("pointercancel", release);
      if (!dragging) return this.goTo(to);
      const t = this.#ctx.t, ok = t > this.#fx.dragThreshold;
      this.#animate(t, Number(ok), this.#ms && 160 + this.#ms * 0.6 * (ok ? 1 - t : t), ok);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", release);
    target.addEventListener("pointercancel", release);
  }
}
