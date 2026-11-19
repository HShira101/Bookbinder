import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { registerSocket } from "./socket.mjs";
import { attachThemeButton } from "./theme-menu.mjs";
import { BookSheet } from "./sheet/book-sheet.mjs";
import { ensureWorldFolders, materializePending, registerStorageHandlers } from "./theme/storage.mjs";
import { forgetTheme } from "./theme/store.mjs";
import { DesignManager } from "./ui/manager.mjs";

Hooks.once("init", () => {
  registerSettings();
  game.settings.registerMenu(MODULE_ID, "designs", {
    name: "BOOKBINDER.Manager.MenuName", label: "BOOKBINDER.Manager.MenuLabel", hint: "BOOKBINDER.Manager.MenuHint", icon: "fa-solid fa-book", type: DesignManager, restricted: false
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(foundry.documents.JournalEntry, MODULE_ID, BookSheet, {
    label: "BOOKBINDER.Sheet.Label",
    makeDefault: false
  });
});

Hooks.once("setup", () => {
  registerSocket();
  registerStorageHandlers();
});

Hooks.once("ready", async () => {
  await ensureWorldFolders();
  await materializePending();
});

Hooks.on("renderDocumentSheetV2", attachThemeButton);

Hooks.on("updateJournalEntry", (journal, changes) => {
  if (foundry.utils.getProperty(changes, `flags.${MODULE_ID}.theme`)) BookSheet.reloadTheme(journal);
});

Hooks.on("bookbinder.themeChanged", slug => BookSheet.reloadSlug(slug));

Hooks.on("updateUser", (user, changes) => {
  const pending = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.pendingThemes`);
  if (pending === undefined) return;
  forgetTheme();
  materializePending();
});

for (const event of ["create", "update", "delete"]) {
  Hooks.on(`${event}JournalEntryPage`, page => BookSheet.refreshPage(page));
}
