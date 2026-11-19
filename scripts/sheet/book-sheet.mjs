import { MODULE_ID, modulePath } from "../constants.mjs";
import { setting } from "../settings.mjs";
import { BookView } from "./book-view.mjs";

const { HandlebarsApplicationMixin, DocumentSheetV2 } = foundry.applications.api;

export class BookSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["bookbinder-sheet"],
    window: { resizable: true, icon: "fa-solid fa-book-open" },
    position: { width: 1240, height: 820 },
    actions: {
      toggleToc: BookSheet.#onToggleToc,
      goToPage: BookSheet.#onGoToPage
    }
  };

  static PARTS = {
    toc: { template: modulePath("templates/toc.hbs") },
    book: { template: modulePath("templates/book.hbs") }
  };

  static refreshPage(page) {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof BookSheet && app.document === page.parent) {
        app.#view?.invalidate(page.id);
        app.render();
      }
    }
  }

  #view = null;
  #tocCollapsed = setting("tocCollapsed");
  #saveBookmark = foundry.utils.debounce(pageId => game.user.update({ [`flags.${MODULE_ID}.lastPage.${this.document.id}`]: pageId }), 1000);

  get title() {
    return this.document.name;
  }

  get #pages() {
    return this.document.pages.contents
      .filter(page => page.testUserPermission(game.user, "OBSERVER"))
      .sort((a, b) => a.sort - b.sort);
  }

  get #bookmark() {
    return game.user.getFlag(MODULE_ID, "lastPage")?.[this.document.id] ?? null;
  }

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if (this.rendered) options.parts = ["toc"];
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      collapsed: this.#tocCollapsed,
      entries: this.#pages.map(page => ({ id: page.id, name: page.name, level: page.title?.level ?? 1 }))
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this.#view) await this.#view.refresh(this.#pages, options.pageId, options.anchor);
    else await this.#open(options);
    this.#markToc();
  }

  _onClose(options) {
    super._onClose(options);
    this.#view?.destroy();
    this.#view = null;
  }

  async #open({ pageId, anchor }) {
    const stage = this.element.querySelector(".bookbinder-stage");
    this.#view = new BookView({ host: stage, journal: this.document, onSpread: () => this.#onSpread() });
    this.element.addEventListener("keydown", event => this.#view?.onKey(event));
    await this.#view.open(this.#pages, pageId ?? this.#bookmark, anchor);
    stage.focus({ preventScroll: true });
  }

  #onSpread() {
    this.#markToc();
    const pageId = this.#view.pageIds[0] ?? null;
    if (pageId !== this.#bookmark) this.#saveBookmark(pageId);
  }

  #markToc() {
    const ids = this.#view?.pageIds ?? [];
    for (const button of this.element.querySelectorAll(".bookbinder-toc [data-page-id]")) {
      button.classList.toggle("bookbinder-active", ids.includes(button.dataset.pageId));
    }
  }

  static #onToggleToc() {
    this.#tocCollapsed = !this.#tocCollapsed;
    const toc = this.element.querySelector(".bookbinder-toc");
    toc.classList.toggle("bookbinder-collapsed", this.#tocCollapsed);
    toc.querySelector(".bookbinder-toc-toggle").ariaExpanded = String(!this.#tocCollapsed);
  }

  static #onGoToPage(event, target) {
    this.#view?.goToPage(target.dataset.pageId);
  }
}
