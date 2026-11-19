import { escapeHTML, localize } from "../constants.mjs";
import { moduleAsset } from "../theme/store.mjs";

const t = key => localize(`Sample.${key}`);
const items = (...keys) => keys.map(key => `<li>${t(key)}</li>`).join("");
const cells = (tag, ...keys) => `<tr>${keys.map(key => `<${tag}>${t(key)}</${tag}>`).join("")}</tr>`;
const wrap = html => `<div class="bookbinder-sample">${html}</div>`;

const PAGES = [
  () => `<div class="bookbinder-sample bookbinder-sample-title"><h1>${t("Title")}</h1><div><em>${t("Subtitle")}</em></div><hr><div class="by">${t("Author")}</div></div>`,
  () => `<h2>${t("Chapter1")}</h2><p>${t("Lead")}</p><p>${t("Inline")}</p><blockquote><p>${t("Quote")}</p><cite>— ${t("QuoteBy")}</cite></blockquote><p>${t("After")}</p>`,
  () => wrap(`<h3>${t("ListTitle")}</h3><p>${t("ListIntro")}</p><ul>${items("Ul1", "Ul2", "Ul3")}</ul><ol>${items("Ol1", "Ol2", "Ol3")}</ol><hr>`
    + `<table><thead>${cells("th", "Th1", "Th2", "Th3")}</thead><tbody>${cells("td", "Row11", "Row12", "Row13")}${cells("td", "Row21", "Row22", "Row23")}${cells("td", "Row31", "Row32", "Row33")}</tbody></table>`),
  () => wrap(`<h4>${t("FoundryTitle")}</h4><p>${t("Foundry")}</p><h5>${t("SecretTitle")}</h5><section class="secret"><p>${t("Secret")}</p></section>`
    + `<h6>${t("MapTitle")}</h6><figure><img src="${moduleAsset("img/book/figure.svg")}" alt=""><figcaption>${t("Caption")}</figcaption></figure>`),
  () => `<h2>${t("Chapter2")}</h2><p>${t("Prose1")}</p><p>${t("Prose2")}</p><p>${t("Prose3")}</p>`
];

const sheetPage = name => `<h1>${escapeHTML(name)}</h1><p>${t("Lead")}</p><blockquote><p>${t("Quote")}</p><cite>— ${t("QuoteBy")}</cite></blockquote>`
  + `<ul>${items("Ul1", "Ul2", "Ul3")}</ul><table><thead>${cells("th", "Th1", "Th2", "Th3")}</thead><tbody>${cells("td", "Row11", "Row12", "Row13")}${cells("td", "Row21", "Row22", "Row23")}</tbody></table>`;

const page = (id, name, html, sheet) => ({
  id, name, type: "sample", html, isOwner: false, title: { show: false }, getFlag: (scope, key) => (key === "sheet" ? sheet : undefined)
});

export const SAMPLE_TITLE = () => t("Title");
export const sheetPageId = key => `sample-sheet-${key}`;

export function samplePages(sheetNames) {
  const names = [t("Title"), t("Chapter1"), t("ListTitle"), t("FoundryTitle"), t("Chapter2")];
  return [
    ...PAGES.map((build, index) => page(`sample${index}`, names[index], build())),
    ...Object.entries(sheetNames).map(([key, name]) => page(sheetPageId(key), name, sheetPage(name), key))
  ];
}
