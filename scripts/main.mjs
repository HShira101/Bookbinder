import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { attachThemeButton } from "./theme-menu.mjs";
import { BookSheet } from "./sheet/book-sheet.mjs";

Hooks.once("init", () => {
  registerSettings();
  foundry.applications.apps.DocumentSheetConfig.registerSheet(foundry.documents.JournalEntry, MODULE_ID, BookSheet, {
    label: "BOOKBINDER.Sheet.Label",
    makeDefault: false
  });
});

Hooks.on("renderDocumentSheetV2", attachThemeButton);

for (const event of ["create", "update", "delete"]) {
  Hooks.on(`${event}JournalEntryPage`, page => BookSheet.refreshPage(page));
}
