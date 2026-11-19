import { MODULE_ID } from "../constants.mjs";

const THEME_FIELD = `flags.${MODULE_ID}.theme`;

export const usesTheme = (journal, slug) => journal.getFlag(MODULE_ID, "theme") === slug;

export function countSheetPages(journals, slug, sheet) {
  return journals.filter(journal => usesTheme(journal, slug))
    .reduce((count, journal) => count + journal.pages.filter(page => page.getFlag(MODULE_ID, "sheet") === sheet).length, 0);
}

async function compendiumUses(slug) {
  const uses = [];
  let unchecked = 0;
  for (const pack of game.packs.filter(candidate => candidate.documentName === "JournalEntry")) {
    try {
      const index = await pack.getIndex({ fields: [THEME_FIELD] });
      uses.push(...index.filter(entry => foundry.utils.getProperty(entry, THEME_FIELD) === slug).map(entry => ({ uuid: entry.uuid, name: entry.name, compendium: true })));
    } catch (error) {
      console.error(error);
      unchecked++;
    }
  }
  return { uses, unchecked };
}

export async function findUsage(slug) {
  const worldUses = game.journals.filter(journal => usesTheme(journal, slug)).map(journal => ({ uuid: journal.uuid, name: journal.name, compendium: false }));
  const { uses, unchecked } = await compendiumUses(slug);
  return { journals: [...worldUses, ...uses], count: worldUses.length + uses.length, unchecked };
}
