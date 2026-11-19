import { MODULE_ID, localize, modulePath } from "../constants.mjs";
import { openMenu } from "../menu.mjs";
import { setting } from "../settings.mjs";
import { forgetTheme, loadTheme, makeAssets, reportProblems } from "../theme/store.mjs";
import { BookView } from "./book-view.mjs";

const { JournalEntrySheet } = foundry.applications.sheets.journal;
const BOOK_PART = { template: modulePath("templates/book.hbs"), scrollable: [] };

export class BookSheet extends JournalEntrySheet {
  static DEFAULT_OPTIONS = {
    classes: ["bookbinder-sheet"],
    window: { icon: "fa-solid fa-book-open" },
    position: { width: 1240, height: 820 }
  };

  static reloadTheme(journal) {
    for (const app of BookSheet.#instancesOf(journal)) app.#reload();
  }

  static refreshPage(page) {
    for (const app of BookSheet.#instancesOf(page.parent)) {
      app.#view?.invalidate(page.id);
      if (app.#book) app.render();
    }
  }

  static *#instancesOf(journal) {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof BookSheet && app.document === journal) yield app;
    }
  }

  #view = null;
  #loaded = null;
  #book = false;
  #saveBookmark = foundry.utils.debounce(pageId => game.user.update({ [`flags.${MODULE_ID}.lastPage.${this.document.id}`]: pageId }), 1000);

  get #pages() {
    return this.document.pages.contents
      .filter(page => page.testUserPermission(game.user, "OBSERVER"))
      .sort((a, b) => a.sort - b.sort);
  }

  get #bookmark() {
    return game.user.getFlag(MODULE_ID, "lastPage")?.[this.document.id] ?? null;
  }

  async #loadTheme() {
    const loaded = await loadTheme(this.document.getFlag(MODULE_ID, "theme"));
    reportProblems(loaded);
    this.#loaded = loaded;
  }

  async #reload() {
    forgetTheme(this.document.getFlag(MODULE_ID, "theme"));
    await this.#loadTheme();
    if (Boolean(this.#loaded.ok) !== this.#book) {
      await this.close();
      return this.render({ force: true });
    }
    if (this.#book) await this.render({ force: true, parts: ["pages"], bookbinderRebuild: true });
  }

  async render(options, _options) {
    if (!this.rendered) await this.#loadTheme();
    return super.render(options, _options);
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    this.#book = Boolean(this.#loaded?.ok) && "pages" in parts;
    if (this.#book) parts.pages = { ...parts.pages, ...BOOK_PART };
    return parts;
  }

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if (this.rendered && this.#book && !options.bookbinderRebuild) options.parts = (options.parts ?? ["sidebar", "pages"]).filter(part => part !== "pages");
  }

  _getHeaderControls() {
    const controls = super._getHeaderControls();
    return this.#book ? controls.filter(control => control.action !== "toggleMode") : controls;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.element.addEventListener("keydown", event => this.#view?.onKey(event));
    if (this.#book && setting("tocCollapsed") && this.sidebarExpanded) this.toggleSidebar();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.toggle("bookbinder-book-mode", this.#book);
    if (!this.#book) return;
    const stage = this.element.querySelector(".bookbinder-stage");
    if (this.#view && this.#view.host !== stage) {
      this.#view.destroy();
      this.#view = null;
    }
    if (this.#view) await this.#view.refresh(this.#pages, options.pageId, options.anchor);
    else await this.#open(options);
    this.#markToc();
  }

  _onClose(options) {
    super._onClose(options);
    this.#view?.destroy();
    this.#view = null;
  }

  goToPage(pageId, options = {}) {
    if (!this.#book || !this.#view) return super.goToPage(pageId, options);
    return this.#view.goToPage(pageId, options.anchor).then(() => this);
  }

  nextPage() {
    return this.#book ? this.#view?.turn(1) : super.nextPage();
  }

  previousPage() {
    return this.#book ? this.#view?.turn(-1) : super.previousPage();
  }

  async _renderPageViews(context, options) {
    if (!this.#book) return super._renderPageViews(context, options);
  }

  _observePages() {
    if (!this.#book) return super._observePages();
  }

  _observeHeadings() {
    if (!this.#book) return super._observeHeadings();
  }

  _onPageScroll(entries, observer) {
    if (!this.#book) return super._onPageScroll(entries, observer);
  }

  _synchronizeSidebar() {
    if (!this.#book) return super._synchronizeSidebar();
  }

  _updateButtonState() {
    if (!this.#book) return super._updateButtonState();
  }

  _activatePagesInView() {
    if (!this.#book) return super._activatePagesInView();
    this.#markToc();
  }

  #pickSheet(page, anchor) {
    const items = [{ id: "main", label: localize("Book.MainSheet") }, ...Object.entries(this.#loaded.theme.sheetNames).map(([id, label]) => ({ id, label }))];
    openMenu({
      frame: this.element, anchor, items, current: page.getFlag(MODULE_ID, "sheet") ?? "main",
      onPick: id => (id === "main" ? page.unsetFlag(MODULE_ID, "sheet") : page.setFlag(MODULE_ID, "sheet", id))
    });
  }

  async #open({ pageId, anchor }) {
    const stage = this.element.querySelector(".bookbinder-stage");
    const { theme } = this.#loaded;
    this.#view = new BookView({
      host: stage, journal: this.document, theme, assets: makeAssets(theme.resources),
      onSpread: () => this.#onSpread(), onSheet: (page, button) => this.#pickSheet(page, button)
    });
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
    for (const entry of this.element.querySelectorAll('[data-application-part="sidebar"] [data-page-id]')) {
      entry.classList.toggle("active", ids.includes(entry.dataset.pageId));
    }
  }
}
