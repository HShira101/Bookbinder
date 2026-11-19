import { BOOK_SHEET_CLASS, MODULE_ID, localize } from "./constants.mjs";
import { toggleMenu } from "./menu.mjs";
import { canSeeTheme } from "./permissions.mjs";
import { applyTemplate } from "./theme/storage.mjs";
import { listThemes, sourceOf } from "./theme/store.mjs";

const journalTheme = journal => journal.getFlag(MODULE_ID, "theme") ?? null;

export function applyTheme(journal, theme) {
  if (theme === journalTheme(journal)) return;
  return journal.update({
    [`flags.${MODULE_ID}.theme`]: theme,
    "flags.core.sheetClass": theme ? BOOK_SHEET_CLASS : ""
  });
}

export async function menuItems(current) {
  const listed = await listThemes();
  const world = listed.world.filter(entry => entry.available && canSeeTheme(game.user, entry.meta));
  const presets = listed.presets.filter(entry => entry.available);
  const active = current && ((await sourceOf(current))?.source === "preset" ? "preset" : "world");
  const entry = (theme, source) => ({ id: `${source}:${theme.slug}`, label: theme.name, active: source === active && theme.slug === current });
  const groups = [
    [localize("Theme.WorldGroup"), world.map(theme => entry(theme, "world"))],
    [localize("Theme.TemplateGroup"), presets.map(theme => entry(theme, "preset"))]
  ];
  const items = [{ id: "", label: localize("Theme.None"), active: !current }];
  for (const [label, group] of groups) if (group.length) items.push({ heading: true, label }, ...group);
  return items;
}

export async function applyChoice(journal, choice) {
  const [source, slug] = choice.split(/:(.+)/);
  return applyTheme(journal, source === "preset" ? await applyTemplate(slug) : slug || null);
}

async function showMenu(app, button) {
  const journal = app.document, current = journalTheme(journal);
  const items = await menuItems(current);
  const activeItem = items.find(item => item.active);
  toggleMenu({
    frame: app.element, anchor: button, items, current: activeItem?.id,
    onPick: choice => applyChoice(journal, choice)
  });
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
  button.addEventListener("click", () => showMenu(app, button));
  header.insertBefore(button, header.querySelector('[data-action="close"]'));
}
