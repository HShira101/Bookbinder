import { BOOK_SHEET_CLASS, BOOK_THEME, MODULE_ID, localize } from "./constants.mjs";

const THEMES = [
  { id: null, label: "Theme.None" },
  { id: BOOK_THEME, label: "Theme.Book" }
];

const journalTheme =journal => journal.getFlag(MODULE_ID, "theme") ?? null;

function applyTheme(journal, theme) {
  if (theme === journalTheme(journal)) return;
  return journal.update({
    [`flags.${MODULE_ID}.theme`]: theme,
    "flags.core.sheetClass": theme ? BOOK_SHEET_CLASS : ""
  });
}

function menuHTML(current) {
  return THEMES.map(({ id, label }) => {
    const active = id === current;
    return `<li><button type="button" role="menuitemradio" aria-checked="${active}" data-theme="${id ?? ""}">`
      + `<i class="fa-solid fa-fw ${active ? "fa-check" : ""}"></i>${localize(label)}</button></li>`;
  }).join("");
}

function openMenu(app, button) {
  const frame = app.element, journal = app.document;
  const menu = document.createElement("menu");
  menu.className = "bookbinder-theme-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = menuHTML(journalTheme(journal));
  const frameBox = frame.getBoundingClientRect(), buttonBox = button.getBoundingClientRect();
  menu.style.top = `${buttonBox.bottom - frameBox.top}px`;
  menu.style.right = `${frameBox.right - buttonBox.right}px`;
  const close = () => {
    menu.remove();
    button.ariaExpanded = "false";
  };
  menu.addEventListener("click", event => {
    const choice = event.target.closest("[data-theme]");
    if (!choice) return;
    close();
    applyTheme(journal, choice.dataset.theme || null);
  });
  menu.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
    button.focus();
  });
  menu.addEventListener("focusout", event => {
    if (!menu.contains(event.relatedTarget) && event.relatedTarget !== button) close();
  });
  frame.append(menu);
  button.ariaExpanded = "true";
  menu.querySelector("[aria-checked=true]")?.focus();
}

export function attachThemeButton(app) {
  const journal = app.document, header = app.element?.querySelector(".window-header");
  if (journal?.documentName !== "JournalEntry" || !journal.isOwner || !header) return;
  if (header.querySelector(".bookbinder-theme-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-control icon fa-solid fa-book bookbinder-theme-button";
  button.dataset.tooltip = button.ariaLabel = localize("Theme.Apply");
  button.setAttribute("aria-haspopup", "menu");
  button.ariaExpanded = "false";
  button.addEventListener("click", () => {
    const menu = app.element.querySelector(".bookbinder-theme-menu");
    if (menu) menu.remove();
    else openMenu(app, button);
  });
  header.insertBefore(button, header.querySelector('[data-action="close"]'));
}
