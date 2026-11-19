import { MODULE_ID } from "../constants.mjs";
import { BookView } from "../sheet/book-view.mjs";
import { SELECTORS } from "../theme/css.mjs";
import { resolveTheme } from "../theme/defaults.mjs";
import { typeOf } from "../theme/design.mjs";
import { makeAssets } from "../theme/store.mjs";
import { ELEMENTS } from "./schema.mjs";
import { SAMPLE_TITLE, samplePages } from "./sample.mjs";

const DEBOUNCE = 150;
const AREAS = [
  [".bookbinder-cv, .bookbinder-board, .bookbinder-endpaper, .bookbinder-edge, .bookbinder-rod, .bookbinder-band", "cover"],
  [".bookbinder-folio, .bookbinder-rhead, .bookbinder-cn, .bookbinder-wm, .bookbinder-st", "ornaments"],
  [".bookbinder-pg, .bookbinder-paper", "paper"]
];

const sheetOfPage = page => page.getFlag(MODULE_ID, "sheet") ?? "main";

const depthOf = node => {
  let depth = 0;
  for (let up = node; up; up = up.parentElement) depth++;
  return depth;
};

export function pickTarget(node) {
  if (node.closest(".bookbinder-content")) {
    const hits = ELEMENTS.filter(element => SELECTORS[element.id] && node.closest(SELECTORS[element.id]))
      .map(element => ({ id: element.id, depth: depthOf(node.closest(SELECTORS[element.id])) }));
    const specific = hits.length > 1 ? hits.filter(hit => hit.id !== "p") : hits;
    const best = specific.sort((a, b) => b.depth - a.depth)[0];
    return best ? { section: "type", element: best.id } : { section: "paper" };
  }
  const area = AREAS.find(([selector]) => node.closest(selector));
  return { section: area ? area[1] : "background" };
}

const readOnly = page => new Proxy(page, {
  get: (target, property) => {
    if (property === "isOwner") return false;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});

const journalPages = journal => journal.pages.contents.filter(page => page.testUserPermission(game.user, "OBSERVER")).sort((a, b) => a.sort - b.sort).map(readOnly);

export class PreviewPane {
  #container;
  #view = null;
  #host = null;
  #timer = null;
  #token = 0;
  #intent = null;

  constructor(container, { onPick, onSpread } = {}) {
    this.#container = container;
    this.onPick = onPick;
    this.onSpread = onSpread;
  }

  get view() {
    return this.#view;
  }

  show(files, { focus = "keep", sheet = "main", journal = null, immediate = false } = {}) {
    clearTimeout(this.#timer);
    if (focus !== "keep") this.#intent = { focus, sheet };
    const options = { journal };
    if (immediate) return this.#draw(files, options);
    this.#timer = setTimeout(() => this.#draw(files, options), DEBOUNCE);
  }

  turn(step) {
    return this.#view?.turn(step);
  }

  destroy() {
    clearTimeout(this.#timer);
    this.#token++;
    this.#view?.destroy();
    this.#host?.remove();
  }

  #target(intent, pages, book) {
    const visible = this.#view?.pageIds ?? [];
    const first = pages[0]?.id;
    if (intent.focus === "cover" && book) return undefined;
    if (intent.focus === "sheet") {
      const wanted = pages.filter(page => sheetOfPage(page) === intent.sheet);
      return visible.some(id => wanted.some(page => page.id === id)) ? visible[0] : (wanted[0]?.id ?? first);
    }
    if (book && this.#view && !visible.length) return undefined;
    return pages.some(page => page.id === visible[0]) ? visible[0] : first;
  }

  async #draw(files, { journal = null }) {
    const token = ++this.#token;
    const intent = this.#intent ?? { focus: "keep", sheet: "main" };
    const host = document.createElement("div");
    host.className = "bookbinder-preview-host loading";
    this.#container.append(host);
    const theme = resolveTheme(files);
    const source = journal ?? { name: SAMPLE_TITLE(), pages: new Map() };
    const view = new BookView({ host, journal: source, theme, assets: makeAssets(files.theme.resources), onSpread: () => this.onSpread?.(), intro: !this.#view });
    const pages = journal ? journalPages(journal) : samplePages(theme.sheetNames);
    await view.open(pages, this.#target(intent, pages, typeOf(files).id === "book"));
    if (token !== this.#token) {
      view.destroy();
      host.remove();
      return;
    }
    this.#view?.destroy();
    this.#host?.remove();
    this.#intent = null;
    host.classList.remove("loading");
    host.addEventListener("click", event => {
      const node = event.composedPath()[0];
      if (this.onPick && node instanceof Element && !node.closest("button")) this.onPick(pickTarget(node));
    });
    [this.#view, this.#host] = [view, host];
  }
}
