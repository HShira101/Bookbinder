import { BookView } from "../sheet/book-view.mjs";
import { SELECTORS } from "../theme/css.mjs";
import { resolveTheme } from "../theme/defaults.mjs";
import { makeAssets } from "../theme/store.mjs";
import { ELEMENTS } from "./schema.mjs";
import { SAMPLE_TITLE, samplePages } from "./sample.mjs";

const DEBOUNCE = 150;
const AREAS = [
  [".bookbinder-cv, .bookbinder-board, .bookbinder-endpaper, .bookbinder-edge", "cover"],
  [".bookbinder-folio, .bookbinder-rhead, .bookbinder-cn, .bookbinder-wm, .bookbinder-st", "ornaments"],
  [".bookbinder-pg, .bookbinder-paper", "paper"]
];

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

  constructor(container, { onPick, onSpread } = {}) {
    this.#container = container;
    this.onPick = onPick;
    this.onSpread = onSpread;
  }

  get view() {
    return this.#view;
  }

  show(files, options = {}) {
    clearTimeout(this.#timer);
    if (options.immediate) return this.#draw(files, options);
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

  async #draw(files, { sheet = "main", closed = false, journal = null }) {
    const token = ++this.#token;
    const host = document.createElement("div");
    host.className = "bookbinder-preview-host loading";
    this.#container.append(host);
    const theme = resolveTheme(files);
    const source = journal ?? { name: SAMPLE_TITLE(), pages: new Map() };
    const view = new BookView({ host, journal: source, theme, assets: makeAssets(files.theme.resources), onSpread: () => this.onSpread?.() });
    const pages = journal ? journalPages(journal) : samplePages(() => (sheet in theme.sheets ? sheet : undefined));
    const keep = closed ? undefined : (this.#view?.pageIds[0] ?? pages[0]?.id);
    await view.open(pages, keep);
    if (token !== this.#token) {
      view.destroy();
      host.remove();
      return;
    }
    this.#view?.destroy();
    this.#host?.remove();
    host.classList.remove("loading");
    host.addEventListener("click", event => {
      const node = event.composedPath()[0];
      if (this.onPick && node instanceof Element && !node.closest("button")) this.onPick(pickTarget(node));
    });
    [this.#view, this.#host] = [view, host];
  }
}
