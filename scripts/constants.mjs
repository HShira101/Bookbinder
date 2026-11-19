export const MODULE_ID = "bookbinder";
export const BOOK_THEME = "book";
export const BOOK_SHEET_CLASS = `${MODULE_ID}.BookSheet`;

export const modulePath = file => `modules/${MODULE_ID}/${file}`;

export const localize = (key, data) => data
  ? game.i18n.format(`BOOKBINDER.${key}`, data)
  : game.i18n.localize(`BOOKBINDER.${key}`);

export const escapeHTML = text => Handlebars.escapeExpression(text ?? "");
